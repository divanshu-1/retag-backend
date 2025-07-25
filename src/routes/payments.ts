// server/src/routes/payments.ts
import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';
import User from '../models/User';
import Product from '../models/Product';
import passport from 'passport';
dotenv.config();


const router = express.Router();

// Test endpoint to verify logging works
router.get('/test', (req, res) => {
    console.log('=== TEST ENDPOINT HIT ===');
    res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Test endpoint to create a dummy order for testing
router.post('/test-order', async (req, res) => {
    try {
        const { cart } = req.body;
        const defaultCart = [{
            productId: 'test-product-1',
            name: 'Test Product',
            price: '₹100',
            quantity: 1
        }];

        const testOrder = new Order({
            user: new mongoose.Types.ObjectId(),
            address: {
                name: 'Test User',
                phone: '1234567890',
                pincode: '123456',
                house: 'Test House',
                area: 'Test Area'
            },
            cart: cart || defaultCart,
            amount: 100,
            razorpayOrderId: `order_test_${Date.now()}`,
            status: 'created'
        });

        await testOrder.save();
        res.json({ success: true, orderId: testOrder.razorpayOrderId, cart: testOrder.cart });
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});

console.log("DEBUG KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("DEBUG KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET);


const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Route to create an order
router.post('/create-order', passport.authenticate('jwt', { session: false }), async (req, res) => {
    console.log('=== CREATE ORDER ENDPOINT HIT ===');
    const { addressId, cart, amount: frontendAmount } = req.body;
    console.log('Create order request:', { addressId, cart, frontendAmount });
    if (!Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate cart subtotal for validation
    let cartSubtotal = 0;
    try {
        cartSubtotal = cart.reduce((acc, item) => {
            const price = parseFloat((item.price || '0').replace('₹', ''));
            return acc + price * (item.quantity || 1);
        }, 0);
        if (cartSubtotal <= 0) throw new Error('Invalid cart total');
    } catch (e) {
        return res.status(400).json({ error: 'Invalid cart data' });
    }

    // Validate that frontend amount is reasonable (cart subtotal + convenience charges)
    const convenienceCharges = 29; // Should match frontend
    const expectedAmount = cartSubtotal + convenienceCharges;

    // Use frontend amount if provided and reasonable, otherwise use calculated amount
    let finalAmount = frontendAmount;
    if (!frontendAmount || Math.abs(frontendAmount - expectedAmount) > 1) {
        console.log('Frontend amount invalid or missing, using calculated amount');
        console.log('Frontend amount:', frontendAmount, 'Expected:', expectedAmount);
        finalAmount = expectedAmount;
    }

    console.log('Final amount for Razorpay:', finalAmount);
    try {
        // Fetch address from user
        const user = await User.findById((req.user as any)._id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const address = user.addresses?.find(addr => addr._id && addr._id.toString() === addressId);
        if (!address) return res.status(404).json({ error: 'Address not found' });
        // Create Razorpay order
        const options = {
            amount: Math.round(finalAmount * 100), // in paise
            currency: 'INR',
            receipt: `receipt_order_${new Date().getTime()}`
        };
        const order = await instance.orders.create(options);

        // Calculate estimated delivery date (7-8 days from now)
        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7); // 7 days from order date

        // Save order in DB
        const dbOrder = await Order.create({
            user: user._id,
            address: {
                name: address.name,
                phone: address.phone,
                pincode: address.pincode,
                house: address.house,
                area: address.area,
            },
            cart: cart.map(item => ({
                productId: item.id || item._id || '',
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.images ? item.images[0] : undefined,
            })),
            amount: finalAmount,
            status: 'created',
            razorpayOrderId: order.id,
            estimatedDeliveryDate,
        });
        res.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            dbOrderId: dbOrder._id,
        });
    } catch (error) {
        res.status(500).send('Error creating order');
    }
});

// Route to verify the payment
router.post('/verify', async (req, res) => {
    console.log('=== PAYMENT VERIFICATION ENDPOINT HIT ===');
    const { order_id, payment_id, signature } = req.body;
    console.log('Payment verification request:', { order_id, payment_id, signature });
    console.log('Request body:', req.body);

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!);
    hmac.update(order_id + "|" + payment_id);
    const generated_signature = hmac.digest('hex');

    console.log('Signature verification:', {
        received_signature: signature,
        generated_signature: generated_signature,
        match: generated_signature === signature
    });

    if (generated_signature === signature) {
        try {
            // Find the order to get the cart items
            const order = await Order.findOne({ razorpayOrderId: order_id });
            if (!order) {
                console.log('Order not found for order_id:', order_id);
                // Let's also check what orders exist
                const allOrders = await Order.find({}).select('razorpayOrderId').limit(5);
                console.log('Recent orders in DB:', allOrders);
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                    debug: { order_id, recentOrders: allOrders.map(o => o.razorpayOrderId) }
                });
            }

            // Update order status to 'paid' and add payment ID
            await Order.findOneAndUpdate(
                { razorpayOrderId: order_id },
                {
                    status: 'paid',
                    razorpayPaymentId: payment_id
                }
            );

            // Mark all products in the cart as sold
            const productIds = order.cart.map(item => item.productId);
            console.log('About to mark products as sold:', productIds);

            // Filter out only valid ObjectIds (database products)
            const validObjectIds = productIds.filter(id => {
                try {
                    return mongoose.Types.ObjectId.isValid(id) && id.length === 24;
                } catch {
                    return false;
                }
            });

            console.log('Valid ObjectIds for database update:', validObjectIds);
            console.log('Skipping static product IDs:', productIds.filter(id => !validObjectIds.includes(id)));

            // Only update database products, skip static products
            if (validObjectIds.length > 0) {
                const updateResult = await Product.updateMany(
                    { _id: { $in: validObjectIds } },
                    { status: 'sold' }
                );

                console.log(`Update result:`, updateResult);
                console.log(`Marked ${validObjectIds.length} database products as sold:`, validObjectIds);

                // Verify the update worked
                const updatedProducts = await Product.find({ _id: { $in: validObjectIds } }).select('_id status');
                console.log('Products after update:', updatedProducts);
            } else {
                console.log('No database products to update (all products are static)');
            }

            // Payment is successful
            res.json({ success: true, message: "Payment has been verified" });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({
                success: false,
                message: "Error updating order status",
                error: error instanceof Error ? error.message : 'Unknown error',
                debug: { order_id, payment_id }
            });
        }
    } else {
        console.log('Signature verification failed');
        res.status(400).json({
            success: false,
            message: "Payment verification failed - signature mismatch",
            debug: {
                received_signature: signature,
                generated_signature_length: generated_signature.length,
                order_id,
                payment_id
            }
        });
    }
});

// Admin endpoint to manually verify/complete orders
router.post('/admin/complete-order/:orderId', passport.authenticate('jwt', { session: false }), async (req, res) => {
    if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    try {
        const { orderId } = req.params;

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'paid') {
            return res.status(400).json({ success: false, message: "Order already completed" });
        }

        // Update order status to 'paid'
        await Order.findByIdAndUpdate(orderId, {
            status: 'paid',
            razorpayPaymentId: 'manual_verification'
        });

        // Mark all products in the cart as sold
        const productIds = order.cart.map(item => item.productId);
        console.log('Admin manually marking products as sold:', productIds);

        const updateResult = await Product.updateMany(
            { _id: { $in: productIds } },
            { status: 'sold' }
        );

        console.log(`Admin completed order ${orderId}, marked ${productIds.length} products as sold`);

        res.json({
            success: true,
            message: "Order completed successfully",
            productsUpdated: updateResult.modifiedCount
        });
    } catch (error) {
        console.error('Error completing order manually:', error);
        res.status(500).json({ success: false, message: "Error completing order" });
    }
});

export default router;
