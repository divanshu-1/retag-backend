import express from 'express';
import ContactForm from '../models/ContactForm';
import passport from 'passport';

const router = express.Router();

// Submit contact form (public route)
router.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, comment } = req.body;

    // Validate required fields
    if (!name || !email || !comment) {
      return res.status(400).json({ 
        message: 'Name, email, and comment are required' 
      });
    }

    // Create new contact form submission
    const contactForm = new ContactForm({
      name,
      email,
      phone,
      comment,
      status: 'new'
    });

    await contactForm.save();

    res.status(201).json({ 
      message: 'Contact form submitted successfully',
      id: contactForm._id
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all contact form submissions (admin only)
router.get('/submissions', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    
    // Check if user is admin
    if (user.email !== 'retagcontact00@gmail.com') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const submissions = await ContactForm.find()
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    res.json({ submissions });
  } catch (error) {
    console.error('Get contact submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update contact form status (admin only)
router.put('/submissions/:id/status', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    
    // Check if user is admin
    if (user.email !== 'retagcontact00@gmail.com') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const submission = await ContactForm.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json({ 
      message: 'Status updated successfully',
      submission 
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get contact form statistics (admin only)
router.get('/stats', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    
    // Check if user is admin
    if (user.email !== 'retagcontact00@gmail.com') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const stats = await ContactForm.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await ContactForm.countDocuments();

    res.json({ 
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      total
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
