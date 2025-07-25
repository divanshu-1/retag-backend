// Script to clear all orders from the database
const mongoose = require('mongoose');
const Order = require('../dist/models/Order').default;
require('dotenv').config();

async function clearOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Count existing orders
    const orderCount = await Order.countDocuments();
    console.log(`Found ${orderCount} orders in the database`);

    if (orderCount === 0) {
      console.log('No orders to delete');
      return;
    }

    // Delete all orders
    const result = await Order.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} orders`);

    // Verify deletion
    const remainingCount = await Order.countDocuments();
    console.log(`Remaining orders: ${remainingCount}`);

  } catch (error) {
    console.error('Error clearing orders:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
clearOrders();
