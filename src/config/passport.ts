import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

// User serialization/deserialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: 'https://retag-backend-production.up.railway.app/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      // Extract profile picture URL
      const profilePicture = profile.photos && profile.photos.length > 0
        ? profile.photos[0].value
        : undefined;

      if (!user) {
        // Create new user with Google profile picture
        user = await User.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0].value,
          avatar: profilePicture, // Set Google profile picture as avatar
        });
      } else {
        // Update existing user's avatar if they don't have one or if Google picture has changed
        if (!user.avatar || user.avatar !== profilePicture) {
          user.avatar = profilePicture;
          await user.save();
        }
      }

      done(null, user);
    } catch (err) {
      done(err, undefined);
    }
  }
));

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET!,
}, async (jwt_payload, done) => {
  console.log('JWT PAYLOAD:', jwt_payload); // Debug log for JWT payload
  try {
    const user = await User.findById(jwt_payload.id);
    console.log('USER FOUND:', user); // Debug log for found user
    if (user) return done(null, user);
    else return done(null, false);
  } catch (err) {
    return done(err, false);
  }
}));