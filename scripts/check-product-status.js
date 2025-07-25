// Script to check product statuses in the database
const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
const Order = require('../dist/models/Order').default;
require('dotenv').config();

async function checkProductStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Check product statuses
    const statusCounts = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n=== Product Status Summary ===');
    statusCounts.forEach(status => {
      console.log(`${status._id}: ${status.count} products`);
    });

    // Show recent products with their status
    console.log('\n=== Recent Products ===');
    const recentProducts = await Product.find()
      .sort({ updated_at: -1 })
      .limit(10)
      .select('_id article brand status listed_product.title updated_at');

    recentProducts.forEach(product => {
      console.log(`ID: ${product._id}`);
      console.log(`Article: ${product.article}`);
      console.log(`Brand: ${product.brand}`);
      console.log(`Status: ${product.status}`);
      console.log(`Title: ${product.listed_product?.title || 'N/A'}`);
      console.log(`Updated: ${product.updated_at}`);
      console.log('---');
    });

    // Check recent orders
    console.log('\n=== Recent Orders ===');
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id status cart amount createdAt');

    recentOrders.forEach(order => {
      console.log(`Order ID: ${order._id}`);
      console.log(`Status: ${order.status}`);
      console.log(`Amount: ₹${order.amount}`);
      console.log(`Items: ${order.cart.length}`);
      console.log(`Product IDs: ${order.cart.map(item => item.productId).join(', ')}`);
      console.log(`Created: ${order.createdAt}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error checking product status:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
checkProductStatus();
