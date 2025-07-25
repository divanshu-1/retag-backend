// Script to fix orders that were paid but not verified properly
const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
const Order = require('../dist/models/Order').default;
require('dotenv').config();

async function fixCompletedOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Find orders with status 'created' (these might be completed but not verified)
    const createdOrders = await Order.find({ status: 'created' });
    
    console.log(`Found ${createdOrders.length} orders with status 'created'`);

    if (createdOrders.length === 0) {
      console.log('No orders to fix');
      return;
    }

    console.log('\nOrders that might need fixing:');
    createdOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}`);
      console.log(`   Amount: ₹${order.amount}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Product IDs: ${order.cart.map(item => item.productId).join(', ')}`);
      console.log('');
    });

    // Ask user which orders to mark as paid and mark products as sold
    console.log('This script can help you manually mark orders as paid and products as sold.');
    console.log('You should only do this for orders where payment was actually completed.');
    console.log('\nTo mark an order as completed, you can:');
    console.log('1. Update the order status to "paid"');
    console.log('2. Mark the products as "sold"');
    console.log('\nFor safety, this script will not automatically fix orders.');
    console.log('Please review the orders above and use the admin panel or contact support.');

  } catch (error) {
    console.error('Error checking orders:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
fixCompletedOrders();
