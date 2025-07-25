/**
 * Authentication Routes for ReTag Marketplace
 *
 * This module handles all authentication-related endpoints including:
 * - Google OAuth authentication
 * - Local email/password authentication
 * - Password reset functionality with OTP
 * - JWT token management
 *
 * Security Features:
 * - Password strength validation
 * - OTP-based password reset
 * - JWT tokens with expiration
 * - Bcrypt password hashing
 *
 * @author ReTag Team
 */

import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import OTP from '../models/OTP';
import { generateOTP, sendOTPEmail, sendPasswordResetSuccessEmail } from '../utils/emailService';

const router = express.Router();

/**
 * Password Validation Function
 * Ensures passwords meet security requirements
 *
 * Requirements:
 * - At least 8 characters long
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 *
 * @param password - Password string to validate
 * @returns Object with validation result and error message
 */
const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  
  return { isValid: true };
};

// Check if user exists (for frontend to determine signup vs login)
router.post('/check-user', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  try {
    const user = await User.findOne({ email });
    res.json({ exists: !!user });
  } catch (err) {
    console.error('Error checking user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request password reset (send OTP)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    
    // Save OTP to database
    await OTP.create({
      email,
      otp,
      expiresAt,
    });
    
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    
    if (emailSent) {
      res.json({ message: 'OTP sent to your email address' });
    } else {
      res.status(500).json({ message: 'Failed to send OTP email' });
    }
  } catch (err) {
    console.error('Error in forgot password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP and reset password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }
  
  try {
    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    
    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      expiresAt: { $gt: new Date() },
      used: false,
    });
    
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password
    user.password = hashedPassword;
    await user.save();
    
    // Mark OTP as used
    otpRecord.used = true;
    await otpRecord.save();
    
    // Send success email
    await sendPasswordResetSuccessEmail(email);
    
    // Generate new JWT token
    const payload = { id: user._id, displayName: user.displayName, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
    
    res.json({ 
      message: 'Password reset successfully',
      token 
    });
  } catch (err) {
    console.error('Error in reset password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }), 
  (req, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        console.error('No user found in request after Google authentication');
        return res.redirect('http://localhost:9002/#auth-error=no-user');
      }
      const payload = { 
        id: user._id, // Ensure id is included
        displayName: user.displayName, 
        email: user.email,
        googleId: user.googleId 
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
      console.log('Google OAuth successful for user:', user.email);
      res.redirect(`http://localhost:9002/#token=${token}`);
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      res.redirect('http://localhost:9002/#auth-error=callback-error');
    }
});

// OAuth failure route
router.get('/failure', (req, res) => {
  console.error('Google OAuth authentication failed');
  res.redirect('http://localhost:9002/#auth-error=authentication-failed');
});

// Example protected route
router.get('/protected', (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any, info: any) => {
    if (err || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
}, (req, res) => {
  res.json({ message: 'You are authenticated!', user: req.user });
});

// Update user profile (requires JWT)
router.put('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { name, phone, gender, dob, avatar } = req.body;
  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        gender: user.gender,
        dob: user.dob,
        avatar: user.avatar,
        displayName: user.displayName,
        googleId: user.googleId,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Local signup
router.post('/signup', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ message: 'All fields required' });
  }
  
  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }
  
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = await User.create({ email, password: hashedPassword, displayName });
    const payload = { id: user._id, displayName: user.displayName, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Local login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'All fields required' });
  
  try {
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    
    const payload = { id: user._id, displayName: user.displayName, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;