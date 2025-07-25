import express from 'express';
import passport from 'passport';
import User from '../models/User';
import Order from '../models/Order';

const router = express.Router();

// Get all addresses for the authenticated user
router.get('/addresses', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.addresses || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch addresses' });
  }
});

// Add a new address
router.post('/addresses', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name, phone, pincode, house, area, isDefault } = req.body;
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isDefault) {
      user.addresses?.forEach(addr => addr.isDefault = false);
    }
    user.addresses?.push({ name, phone, pincode, house, area, isDefault });
    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add address' });
  }
});

// Update an address
router.put('/addresses/:addressId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { addressId } = req.params;
    const { name, phone, pincode, house, area, isDefault } = req.body;
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const addr = user.addresses?.find(addr => addr._id && addr._id.toString() === addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    addr.name = name;
    addr.phone = phone;
    addr.pincode = pincode;
    addr.house = house;
    addr.area = area;
    if (isDefault) {
      user.addresses?.forEach(a => a.isDefault = false);
      addr.isDefault = true;
    }
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update address' });
  }
});

// Delete an address
router.delete('/addresses/:addressId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.addresses = user.addresses?.filter(addr => addr._id && addr._id.toString() !== addressId) || [];
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete address' });
  }
});

// Set default address
router.post('/addresses/:addressId/default', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.addresses?.forEach(addr => { if (addr._id) addr.isDefault = addr._id.toString() === addressId });
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to set default address' });
  }
});

// Get user's orders
router.get('/orders', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    console.log('Fetching orders for user:', (req.user as any)?._id);
    const orders = await Order.find({ user: (req.user as any)._id })
      .sort({ createdAt: -1 });
    console.log('Found orders:', orders.length);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get user's payment account
router.get('/payment-account', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.paymentAccount || null);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payment account' });
  }
});

// Set or update user's payment account
router.post('/payment-account', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { account_number, ifsc_code, account_holder } = req.body;

    if (!account_number || !ifsc_code || !account_holder) {
      return res.status(400).json({ message: 'All payment account fields are required' });
    }

    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.paymentAccount = {
      account_number,
      ifsc_code,
      account_holder
    };

    await user.save();
    res.json({ message: 'Payment account updated successfully', paymentAccount: user.paymentAccount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update payment account' });
  }
});

// Delete user's payment account
router.delete('/payment-account', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.paymentAccount = undefined;
    await user.save();
    res.json({ message: 'Payment account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete payment account' });
  }
});

export default router;
