/**
 * User Model for ReTag Marketplace
 *
 * This model represents users in the ReTag system, supporting both
 * Google OAuth authentication and local email/password authentication.
 * Users can be both buyers and sellers in the marketplace.
 *
 * @author ReTag Team
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * User Interface Definition
 * Extends Mongoose Document to include all user-related fields
 */
export interface IUser extends Document {
  googleId?: string;        // Google OAuth ID (optional, only for OAuth users)
  email: string;           // User's email address (required, unique)
  displayName: string;     // Display name shown in UI
  password?: string;       // Hashed password (optional, only for local auth users)
  name?: string;          // Full name (optional)
  phone?: string;         // Phone number for order delivery
  gender?: 'Male' | 'Female' | 'Other'; // Gender preference
  dob?: Date;             // Date of birth
  avatar?: string;        // Profile picture URL or base64
  addresses?: Array<{     // Delivery addresses for orders
    _id?: string;         // MongoDB ObjectId for address
    name: string;         // Recipient name
    phone: string;        // Contact phone
    pincode: string;      // Postal code
    house: string;        // House/building details
    area: string;         // Area/locality
    isDefault?: boolean;  // Whether this is the default address
  }>;
  paymentAccount?: {      // Payment receiving account for selling items
    account_number: string;   // Bank account number
    ifsc_code: string;       // IFSC code
    account_holder: string;  // Account holder name
    createdAt?: Date;        // When the account was added
    updatedAt?: Date;        // When the account was last updated
  };
}

/**
 * Address Schema
 * Nested schema for user delivery addresses
 */
const AddressSchema = new Schema({
  name: { type: String, required: true },        // Recipient name
  phone: { type: String, required: true },       // Contact phone number
  pincode: { type: String, required: true },     // Postal/ZIP code
  house: { type: String, required: true },       // House number, building name
  area: { type: String, required: true },        // Area, locality, landmark
  isDefault: { type: Boolean, default: false },  // Default address flag
}, { _id: true }); // Enable _id for each address

/**
 * Payment Account Schema
 * Schema for user's payment receiving account (for selling items)
 */
const PaymentAccountSchema = new Schema({
  account_number: { type: String, required: true },   // Bank account number
  ifsc_code: { type: String, required: true },        // IFSC code
  account_holder: { type: String, required: true },   // Account holder name
}, {
  _id: false,     // Don't create _id for payment account (only one per user)
  timestamps: true // Add createdAt and updatedAt
});

/**
 * User Schema Definition
 * Main schema for user documents in MongoDB
 */
const UserSchema = new Schema<IUser>({
  // Authentication fields
  googleId: {
    type: String,
    unique: true,
    sparse: true  // Allows multiple null values (for non-OAuth users)
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,  // Store emails in lowercase
    trim: true        // Remove whitespace
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,     // Hashed password using bcrypt (only for local users)
    select: false     // Don't include password in queries by default
  },

  // Profile fields
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    trim: true
  },
  dob: { type: Date },
  avatar: { type: String }, // URL or base64 encoded image

  // Address management
  addresses: {
    type: [AddressSchema],
    default: [],
    validate: {
      validator: function(addresses: any[]) {
        // Ensure only one default address
        const defaultCount = addresses.filter(addr => addr.isDefault).length;
        return defaultCount <= 1;
      },
      message: 'Only one address can be set as default'
    }
  },

  // Payment account for receiving money from selling items
  paymentAccount: {
    type: PaymentAccountSchema,
    default: undefined  // No payment account by default
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password; // Never include password in JSON output
      return ret;
    }
  }
});

/**
 * Indexes for better query performance
 */
UserSchema.index({ email: 1 });      // Index on email for login queries
UserSchema.index({ googleId: 1 });   // Index on googleId for OAuth queries

export default mongoose.model<IUser>('User', UserSchema);