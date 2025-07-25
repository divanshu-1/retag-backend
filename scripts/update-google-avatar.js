const mongoose = require('mongoose');
const User = require('../dist/models/User').default;
require('dotenv').config();

async function updateGoogleAvatar() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find your user by email
    const userEmail = 'divanshuarora60@gmail.com'; // Update this to your current email
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`User with email ${userEmail} not found`);
      return;
    }

    console.log(`Found user: ${user.email}`);
    console.log(`Current avatar: ${user.avatar || 'None'}`);

    // Restore the original Google profile picture
    const originalGoogleAvatar = 'https://lh3.googleusercontent.com/a/ACg8ocIAQ7lQx0Ga89FzOtIK4-qaxi0kVDj4GCGR9ztO4SXef_fgOiOHPw=s96-c';

    // Update the user's avatar
    user.avatar = originalGoogleAvatar;
    await user.save();

    console.log(`✅ Updated avatar for ${user.email}`);
    console.log(`New avatar URL: ${user.avatar}`);

    // Close connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateGoogleAvatar();
