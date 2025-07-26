import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import aiService, { ProductAnalysis } from '../utils/aiService';
import Product from '../models/Product';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { cloudinaryStorage } from '../config/cloudinary';

const router = express.Router();

// Use Cloudinary storage for production, local storage for development
const useCloudinary = process.env.NODE_ENV === 'production' || process.env.USE_CLOUDINARY === 'true';

let upload: multer.Multer;

if (useCloudinary) {
  // Use Cloudinary storage
  upload = multer({ storage: cloudinaryStorage });
} else {
  // Use local disk storage for development
  const uploadsDir = path.join(__dirname, '../../uploads/');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  const localStorage = multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
      cb(null, uploadsDir);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  upload = multer({ storage: localStorage });
}

// Debug middleware for Multer
function logMulter(req: Request, res: Response, next: NextFunction) {
  console.log('MULTER RAN');
  next();
}
// Debug middleware for Passport
function logPassport(req: Request, res: Response, next: NextFunction) {
  console.log('PASSPORT RAN');
  next();
}

// Minimal test route for JWT auth isolation
router.get('/test', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ message: 'Test route hit', user: req.user });
});

// Submit a new sell request with AI analysis
router.post('/submit',
  logMulter,
  upload.array('images', 10),
  logPassport,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: any, user: any, info: any) => {
      if (err || !user) {
        console.log('PASSPORT AUTH FAILED', err, info);
        return res.status(401).json({ message: 'Unauthorized' });
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    console.log('SELL SUBMIT ROUTE HANDLER RAN');
    console.log('SELL SUBMIT USER (route):', req.user); // Debug user in route handler
    console.log('SELL SUBMIT HEADERS:', req.headers); // Debug incoming headers
    try {
      const {
        article,
        brand,
        category,
        gender,
        size,
        age,
        wear_count,
        damage
      } = req.body;
      console.log('Processing images...');
      const files = req.files as Express.Multer.File[];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!files || files.length === 0) {
        console.log('No images uploaded');
        return res.status(400).json({ message: 'At least one image is required' });
      }
      if (files.some(file => !allowedTypes.includes(file.mimetype))) {
        console.log('Invalid image type');
        return res.status(400).json({ message: 'Images must be JPEG or PNG files' });
      }
      let imageBase64 = '';
      try {
        const firstImagePath = files[0].path;
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(firstImagePath);
        imageBase64 = imageBuffer.toString('base64');
        console.log('Image processed to base64');
      } catch (imgErr) {
        console.error('Error processing image:', imgErr);
        return res.status(500).json({ message: 'Error processing image' });
      }
      // Process images based on storage type
      const processedImages = files.map(file => {
        if (useCloudinary) {
          // For Cloudinary, use the secure_url from the uploaded file
          return (file as any).path; // Cloudinary returns the full URL in file.path
        } else {
          // For local storage, use relative path
          return 'uploads/' + file.filename;
        }
      });
      let aiAnalysis;
      try {
        console.log('Running AI analysis...');
        aiAnalysis = await aiService.analyzeProduct([imageBase64], {
          article,
          brand,
          category,
          gender,
          size,
          age,
          wear_count,
          damage
        });
        console.log('AI analysis complete');
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        return res.status(500).json({ message: 'Failed to analyze product. Please try again.' });
      }
      try {
        console.log('Saving product to DB...');
        const product = await Product.create({
          seller: (req.user as any)._id,
          article,
          brand,
          category,
          gender,
          size,
          age,
          wear_count,
          damage,
          images: processedImages, // Store file paths
          ai_analysis: aiAnalysis,
          status: 'pending'
        });
        console.log('Product saved to DB:', product._id);
        res.status(201).json({
          message: 'Product submitted successfully',
          product: {
            id: product._id,
            ai_analysis: aiAnalysis,
            status: product.status
          }
        });
      } catch (dbError) {
        console.error('Error saving product to DB:', dbError);
        res.status(500).json({ message: 'Server error' });
      }
    } catch (error) {
      console.error('Error submitting product:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get user's sell submissions
router.get('/my-submissions', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const products = await Product.find({ 
      seller: (req.user as any)._id 
    })
    .select('-images') // Don't send images in list view
    .sort({ created_at: -1 });

    res.json({ products });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific submission details
router.get('/submission/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: (req.user as any)._id
    });

    if (!product) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept AI price suggestion and provide pickup details
router.post('/accept-offer/:id',
  [
    (req: Request, res: Response, next: NextFunction) => {
      console.log('AUTH HEADER:', req.headers.authorization); // Debug incoming token
      passport.authenticate('jwt', { session: false }, (err: any, user: any, info: any) => {
        if (err || !user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
        next();
      })(req, res, next);
    }
  ],
  async (req: Request, res: Response) => {
    console.log('ACCEPT OFFER USER:', req.user); // Debug user
    try {
      const { pickup_details, payment_details } = req.body;

      if (!pickup_details || !payment_details) {
        return res.status(400).json({ 
          message: 'Pickup and payment details are required' 
        });
      }

      const product = await Product.findOne({
        _id: req.params.id,
        seller: (req.user as any)._id,
        status: 'pending'
      });

      if (!product) {
        return res.status(404).json({ message: 'Submission not found or already processed' });
      }

      // Update product with pickup and payment details
      product.pickup_details = pickup_details;
      product.payment_details = payment_details;
      product.status = 'approved'; // Ready for admin review
      await product.save();

      res.json({
        message: 'Offer accepted successfully. We will contact you soon for pickup.',
        product: {
          id: product._id,
          status: product.status,
          suggested_price: product.ai_analysis.price_suggestion.suggested_price
        }
      });

    } catch (error) {
      console.error('Error accepting offer:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Reject AI price suggestion
router.post('/reject-offer/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { reason } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      seller: (req.user as any)._id,
      status: 'pending'
    });

    if (!product) {
      return res.status(404).json({ message: 'Submission not found or already processed' });
    }

    // Mark as rejected
    product.status = 'rejected';
    if (reason) {
      product.admin_review = {
        ...product.admin_review,
        admin_notes: `Rejected by seller: ${reason}`
      };
    }
    await product.save();

    res.json({
      message: 'Offer rejected successfully',
      product: {
        id: product._id,
        status: product.status
      }
    });

  } catch (error) {
    console.error('Error rejecting offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin routes (protected by admin middleware)
// Get all pending submissions for admin review
router.get('/admin/pending', passport.authenticate('jwt', { session: false }), async (req, res) => {
  if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  try {
    const products = await Product.find({ status: 'approved' })
      .populate('seller', 'name email phone paymentAccount')
      .sort({ created_at: -1 });

    res.json({ products });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin review and finalize price
router.post('/admin/review/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  try {
    const { final_price, mrp, discount_percentage, pricing_type, admin_notes, action } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve or reject' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (action === 'approve') {
      if (!final_price || final_price <= 0) {
        return res.status(400).json({ message: 'Final price is required for approval' });
      }

      product.status = 'listed';
      product.admin_review = {
        final_price,
        mrp: mrp || undefined,
        discount_percentage: discount_percentage || undefined,
        pricing_type: pricing_type || 'fixed',
        admin_notes,
        reviewed_by: (req.user as any)._id,
        reviewed_at: new Date()
      };

      // Set mainCategory based on gender
      let mainCategory = 'Unisex';
      if (product.gender === 'male') mainCategory = 'Men';
      else if (product.gender === 'female') mainCategory = 'Women';
      else if (product.gender === 'kids') mainCategory = 'Kids';
      else if (product.gender === 'unisex') mainCategory = 'Unisex';
      product.set('mainCategory', mainCategory, { strict: false });

      // Create listed product details
      product.listed_product = {
        title: `${product.brand} ${product.article}`,
        description: `${product.ai_analysis.image_analysis.caption}. ${product.ai_analysis.price_suggestion.reasoning}`,
        price: final_price,
        mrp: mrp || undefined,
        discount_percentage: discount_percentage || undefined,
        category: product.category, // Use user-selected category instead of AI-detected
        tags: [
          product.brand,
          product.article,
          product.gender,
          product.ai_analysis.image_analysis.quality,
          ...product.ai_analysis.image_analysis.features
        ].filter((tag): tag is string => Boolean(tag)),
        listed_at: new Date(),
        mainCategory
      };
    } else {
      product.status = 'rejected';
      product.admin_review = {
        admin_notes,
        reviewed_by: (req.user as any)._id,
        reviewed_at: new Date()
      };
    }

    await product.save();

    res.json({
      message: `Submission ${action}d successfully`,
      product: {
        id: product._id,
        status: product.status,
        final_price: product.admin_review?.final_price
      }
    });

  } catch (error) {
    console.error('Error reviewing submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all listed (published) products for admin (excludes sold products)
router.get('/admin/listed', passport.authenticate('jwt', { session: false }), async (req, res) => {
  if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  try {
    // Only return products with status 'listed' - sold products are automatically excluded
    const products = await Product.find({ status: 'listed' })
      .populate('seller', 'name email phone paymentAccount')
      .sort({ created_at: -1 });
    res.json({ products });
  } catch (error) {
    console.error('Error fetching listed products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint for all published products (excludes sold products)
router.get('/listed-public', async (req, res) => {
  try {
    // Only return products with status 'listed' - sold products are automatically excluded
    const products = await Product.find({ status: 'listed' })
      .populate('seller', 'name email phone')
      .sort({ created_at: -1 });
    res.json({ products });
  } catch (error) {
    console.error('Error fetching public listed products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all sold products for admin tracking
router.get('/admin/sold', passport.authenticate('jwt', { session: false }), async (req, res) => {
  if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  try {
    const products = await Product.find({ status: 'sold' })
      .populate('seller', 'name email phone')
      .sort({ updated_at: -1 }); // Sort by when they were sold (updated)
    res.json({ products });
  } catch (error) {
    console.error('Error fetching sold products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit product price for listed products
router.put('/admin/products/:id/edit-price', passport.authenticate('jwt', { session: false }), async (req, res) => {
  if ((req.user as any)?.email !== 'retagcontact00@gmail.com') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  try {
    const { price, mrp } = req.body;

    if (!price || price <= 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'listed') {
      return res.status(400).json({ message: 'Can only edit prices for listed products' });
    }

    // Calculate discount percentage if MRP is provided
    let discountPercentage = 0;
    if (mrp && mrp > price) {
      discountPercentage = Math.round(((mrp - price) / mrp) * 100);
    }

    // Update both admin_review and listed_product pricing
    if (product.admin_review) {
      product.admin_review.final_price = price;
      product.admin_review.mrp = mrp || undefined;
      product.admin_review.discount_percentage = discountPercentage || undefined;
    }

    if (product.listed_product) {
      product.listed_product.price = price;
      product.listed_product.mrp = mrp || undefined;
      product.listed_product.discount_percentage = discountPercentage || undefined;
    }

    await product.save();

    res.json({
      message: 'Product price updated successfully',
      product: {
        _id: product._id,
        price: price,
        mrp: mrp,
        discount_percentage: discountPercentage
      }
    });
  } catch (error) {
    console.error('Error updating product price:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;