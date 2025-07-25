/**
 * Product Model for ReTag Marketplace
 *
 * This model represents products (clothing items) that users want to sell
 * in the ReTag marketplace. It includes AI-powered analysis for pricing
 * and quality assessment, admin review workflow, and listing management.
 *
 * Product Lifecycle:
 * 1. User submits product with images and details
 * 2. AI analyzes images and suggests pricing
 * 3. Admin reviews and approves/rejects
 * 4. Approved products get listed for sale
 * 5. Products can be sold to buyers
 *
 * @author ReTag Team
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Product Interface Definition
 * Comprehensive interface for clothing items in the marketplace
 */
export interface IProduct extends Document {
  // Seller information
  seller: mongoose.Types.ObjectId;  // Reference to User who is selling

  // Product details provided by seller
  article: string;                  // Type of clothing (shirt, jeans, etc.)
  brand: string;                    // Brand name
  category: string;                 // User-selected category (Tops, Bottoms, etc.)
  gender?: string;                  // Target gender (Men, Women, Unisex)
  size?: string;                    // Size (S, M, L, XL, etc.)
  age?: string;                     // Age of the item
  wear_count?: number;              // How many times worn
  damage?: string;                  // Description of any damage
  images: string[];                 // Base64 encoded product images
  // AI-powered analysis results
  ai_analysis: {
    image_analysis: {
      caption: string;                                    // AI-generated description
      quality: 'excellent' | 'good' | 'fair' | 'poor';  // Quality assessment
      category: string;                                   // Detected category
      colors_detected?: string[];                         // AI-detected colors
      condition_score: number;                            // Condition score (0-100)
      features: string[];                                 // Detected features
    };
    price_suggestion: {
      suggested_price: number;        // AI-suggested price in INR
      reasoning: string;              // Explanation for the price
      market_comparison: string;      // Market analysis
      confidence_score: number;       // AI confidence (0-100)
      factors: string[];              // Factors affecting price
    };
    final_recommendation: string;     // Overall AI recommendation
  };

  // Product status in the workflow
  status: 'pending' | 'approved' | 'rejected' | 'listed' | 'sold';

  // Admin review details
  admin_review?: {
    final_price?: number;                    // Admin-approved final price (discounted price)
    mrp?: number;                           // Maximum Retail Price (original price)
    discount_percentage?: number;            // Discount percentage (0-100)
    pricing_type?: 'fixed' | 'percentage';  // How discount was set
    admin_notes?: string;                    // Admin comments
    reviewed_by?: mongoose.Types.ObjectId;   // Admin who reviewed
    reviewed_at?: Date;                      // Review timestamp
  };
  // Pickup logistics (for collecting item from seller)
  pickup_details?: {
    address: string;          // Pickup address
    phone: string;            // Contact phone for pickup
    preferred_date: string;   // Seller's preferred pickup date
    preferred_time: string;   // Seller's preferred pickup time
  };

  // Payment information (for paying seller after sale)
  payment_details?: {
    upi_id?: string;          // UPI ID for instant payments
    bank_account?: {          // Bank account details for NEFT/IMPS
      account_number: string; // Bank account number
      ifsc_code: string;      // IFSC code
      account_holder: string; // Account holder name
    };
  };

  // Listed product details (when approved and listed for sale)
  listed_product?: {
    title: string;            // Product title for marketplace
    description: string;      // Product description
    price: number;           // Final selling price (discounted price)
    mrp?: number;            // Maximum Retail Price (original price)
    discount_percentage?: number; // Discount percentage for display
    category: string;        // Product category
    tags: string[];          // Search tags
    listed_at: Date;         // When it was listed
    mainCategory?: string;   // Main category classification
  };

  // Timestamps (managed by Mongoose)
  created_at: Date;          // When product was submitted
  updated_at: Date;          // Last modification time
}

const ProductSchema = new Schema<IProduct>({
  seller: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  article: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Footwear', 'Accessories', 'Bags', 'Jewelry', 'Activewear', 'Formal', 'Casual', 'Other'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'kids', 'unisex'],
    required: false
  },
  size: {
    type: String,
    trim: true
  },
  age: {
    type: String,
    enum: ['<1', '1-2', '2-3', '>3']
  },
  wear_count: {
    type: Number,
    min: 0
  },
  damage: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  ai_analysis: {
    image_analysis: {
      caption: { type: String, required: true },
      quality: { 
        type: String, 
        enum: ['excellent', 'good', 'fair', 'poor'],
        required: true 
      },
      category: { type: String, required: true },
      colors_detected: [{ type: String }],
      condition_score: {
        type: Number,
        min: 1,
        max: 10,
        required: true
      },
      features: [{ type: String }]
    },
    price_suggestion: {
      suggested_price: { type: Number, required: true },
      reasoning: { type: String, required: true },
      market_comparison: { type: String, required: true },
      confidence_score: { 
        type: Number, 
        min: 0, 
        max: 1, 
        required: true 
      },
      factors: [{ type: String }]
    },
    final_recommendation: { type: String, required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'listed', 'sold'],
    default: 'pending'
  },
  admin_review: {
    final_price: { type: Number },
    mrp: { type: Number },
    discount_percentage: { type: Number, min: 0, max: 100 },
    pricing_type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    admin_notes: { type: String },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date }
  },
  pickup_details: {
    address: { type: String },
    phone: { type: String },
    preferred_date: { type: String },
    preferred_time: { type: String }
  },
  payment_details: {
    upi_id: { type: String },
    bank_account: {
      account_number: { type: String },
      ifsc_code: { type: String },
      account_holder: { type: String }
    }
  },
  listed_product: {
    title: { type: String },
    description: { type: String },
    price: { type: Number },
    mrp: { type: Number },
    discount_percentage: { type: Number, min: 0, max: 100 },
    category: { type: String },
    tags: [{ type: String }],
    listed_at: { type: Date },
    mainCategory: { type: String }
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  }
});

// Index for efficient queries
ProductSchema.index({ seller: 1, status: 1 });
ProductSchema.index({ status: 1, created_at: -1 });
ProductSchema.index({ 'ai_analysis.price_suggestion.suggested_price': 1 });

export default mongoose.model<IProduct>('Product', ProductSchema); 