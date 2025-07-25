// Script to test marking a product as sold
const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
require('dotenv').config();

async function testMarkSold() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retag');
    console.log('Connected to MongoDB');

    // Find a listed product
    const listedProduct = await Product.findOne({ status: 'listed' });
    
    if (!listedProduct) {
      console.log('No listed products found to test with');
      return;
    }

    console.log('Found listed product:');
    console.log(`ID: ${listedProduct._id}`);
    console.log(`Article: ${listedProduct.article}`);
    console.log(`Brand: ${listedProduct.brand}`);
    console.log(`Current Status: ${listedProduct.status}`);

    // Mark it as sold
    console.log('\nMarking product as sold...');
    const updateResult = await Product.updateOne(
      { _id: listedProduct._id },
      { status: 'sold' }
    );

    console.log('Update result:', updateResult);

    // Verify the update
    const updatedProduct = await Product.findById(listedProduct._id);
    console.log(`New Status: ${updatedProduct.status}`);

    // Check if it appears in listed-public endpoint
    const listedProducts = await Product.find({ status: 'listed' });
    console.log(`\nProducts still listed: ${listedProducts.length}`);
    
    const soldProducts = await Product.find({ status: 'sold' });
    console.log(`Products marked as sold: ${soldProducts.length}`);

    // Revert the change for testing
    console.log('\nReverting change for testing...');
    await Product.updateOne(
      { _id: listedProduct._id },
      { status: 'listed' }
    );
    console.log('Product status reverted to listed');

  } catch (error) {
    console.error('Error testing mark sold:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
testMarkSold();
