// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Helper function to generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    role: user.role
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '7d' }
  );
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        message: 'User already exists'
      });
    }

    // Create new user
    user = new User({
      firstName,
      lastName,
      email,
      password,
      // Only allow user or trainer roles from registration
      role: ['user', 'trainer'].includes(role) ? role : 'user'
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user and token
    res.status(201).json({
      token,
      user: user.getPublicProfile()
    });
  } catch (err) {
    next(err);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Return user and token
    res.json({
      token,
      user: user.getPublicProfile()
    });
  } catch (err) {
    next(err);
  }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.getPublicProfile());
  } catch (err) {
    next(err);
  }
};
