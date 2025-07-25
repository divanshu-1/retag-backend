const mongoose = require('mongoose');
const User = require('../dist/models/User').default;
require('dotenv').config();

async function testGoogleAvatar() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find users with Google ID
    const googleUsers = await User.find({ googleId: { $exists: true } });
    console.log(`Found ${googleUsers.length} Google users:`);
    
    googleUsers.forEach(user => {
      console.log(`- ${user.email}: avatar = ${user.avatar ? 'YES' : 'NO'}`);
      if (user.avatar) {
        console.log(`  Avatar URL: ${user.avatar}`);
      }
    });

    // Close connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testGoogleAvatar();
