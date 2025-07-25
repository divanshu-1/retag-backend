// Script to restore the test product for testing
const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
require('dotenv').config();

async function restoreTestProduct() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Find the sold product and mark it as listed again
    const soldProduct = await Product.findOne({ 
      _id: '68773d5ccb4a8235f64ebe23',
      status: 'sold' 
    });
    
    if (soldProduct) {
      await Product.updateOne(
        { _id: '68773d5ccb4a8235f64ebe23' },
        { status: 'listed' }
      );
      console.log('Product restored to listed status for testing');
    } else {
      console.log('Product not found or already listed');
    }

    // Check current status
    const product = await Product.findById('68773d5ccb4a8235f64ebe23');
    if (product) {
      console.log(`Product status: ${product.status}`);
      console.log(`Product title: ${product.listed_product?.title}`);
    }

  } catch (error) {
    console.error('Error restoring product:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
restoreTestProduct();
