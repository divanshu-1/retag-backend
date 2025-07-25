// Script to test payment verification flow
const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
const Order = require('../dist/models/Order').default;
require('dotenv').config();

async function testPaymentVerification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Find an order with status 'created' that has the T-shirt
    const order = await Order.findOne({ 
      status: 'created',
      'cart.productId': '68773d5ccb4a8235f64ebe23'
    });
    
    if (!order) {
      console.log('No created order found with the T-shirt');
      return;
    }

    console.log('Found order:');
    console.log(`Order ID: ${order._id}`);
    console.log(`Status: ${order.status}`);
    console.log(`Amount: ₹${order.amount}`);
    console.log(`Product IDs: ${order.cart.map(item => item.productId).join(', ')}`);

    // Simulate payment verification
    console.log('\nSimulating payment verification...');
    
    // Update order status to 'paid'
    await Order.findOneAndUpdate(
      { _id: order._id },
      {
        status: 'paid',
        razorpayPaymentId: 'test_payment_id_123'
      }
    );

    // Mark all products in the cart as sold
    const productIds = order.cart.map(item => item.productId);
    console.log('About to mark products as sold:', productIds);
    
    const updateResult = await Product.updateMany(
      { _id: { $in: productIds } },
      { status: 'sold' }
    );

    console.log('Update result:', updateResult);

    // Verify the update worked
    const updatedProducts = await Product.find({ _id: { $in: productIds } }).select('_id status');
    console.log('Products after update:', updatedProducts);

    // Check how many products are still listed
    const listedProducts = await Product.find({ status: 'listed' });
    console.log(`\nProducts still listed: ${listedProducts.length}`);
    
    const soldProducts = await Product.find({ status: 'sold' });
    console.log(`Products marked as sold: ${soldProducts.length}`);

    console.log('\nPayment verification simulation completed successfully!');

  } catch (error) {
    console.error('Error testing payment verification:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
testPaymentVerification();
