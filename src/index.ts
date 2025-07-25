/**
 * ReTag Marketplace Backend Server
 *
 * This is the main entry point for the ReTag marketplace backend API.
 * ReTag is a thrift store marketplace that allows users to sell and buy
 * second-hand clothing with AI-powered pricing and quality assessment.
 *
 * Features:
 * - User authentication (Google OAuth + local auth)
 * - Product listing and management with AI analysis
 * - Payment processing via Razorpay
 * - Image upload and processing
 * - Admin panel for product approval
 *
 * @author ReTag Team
 * @version 1.0.0
 */

// Core dependencies
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import passport from 'passport';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

// Route imports
import authRoutes from './routes/auth';
import paymentRoutes from './routes/payments';
import sellRoutes from './routes/sell';
import contactRoutes from './routes/contact';
import userRoutes from './routes/user';

// Passport configuration
import './config/passport';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 8080;

/**
 * MIDDLEWARE CONFIGURATION
 */

// CORS configuration - allows frontend to communicate with backend
app.use(cors({
  origin: ['http://localhost:9002', 'http://127.0.0.1:9002'], // Frontend development URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'], // Allowed headers
  credentials: true, // Allow cookies and credentials
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Body parsing middleware - handles JSON and URL-encoded data
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies with 50MB limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Parse URL-encoded bodies with extended syntax

// Health check endpoint for monitoring and load balancers
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'ReTag API'
  });
});

// Initialize Passport.js for authentication
app.use(passport.initialize());

// Serve uploaded files statically (product images, user avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/**
 * API ROUTES CONFIGURATION
 */
app.use('/auth', authRoutes);        // Authentication routes (login, signup, OAuth)
app.use('/payments', paymentRoutes); // Payment processing routes (Razorpay integration)
app.use('/sell', sellRoutes);        // Product selling routes (upload, AI analysis)
app.use('/contact', contactRoutes);  // Contact form routes
app.use('/api/user', userRoutes);    // User profile management routes

/**
 * GLOBAL ERROR HANDLER
 * Catches all unhandled errors and returns consistent JSON responses
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Handle authentication errors specifically
  if (err && err.status === 401) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Log error for debugging (in production, use proper logging service)
  console.error('Global error handler:', err);

  // Return generic error response
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * DATABASE CONNECTION
 * Connect to MongoDB using Mongoose ODM
 */
mongoose.connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Exit if database connection fails
  });

/**
 * ROOT ENDPOINT
 * Simple endpoint to verify API is running
 */
app.get('/', (req, res) => {
  res.json({
    message: 'ReTag API is running!',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * START SERVER
 * Begin listening for incoming requests
 */
app.listen(PORT, () => {
  console.log(`🚀 ReTag API Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});