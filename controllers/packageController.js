// controllers/packageController.js
const Package = require('../models/Package');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all packages
exports.getAllPackages = async (req, res, next) => {
  try {
    // Only return active packages for regular users
    const query = req.user && req.user.role === 'admin' ? {} : { active: true };

    const packages = await Package.find(query).sort({ tokenAmount: 1 });
    res.json(packages);
  } catch (err) {
    next(err);
  }
};

// Get package by ID
exports.getPackageById = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Only allow admin to see inactive packages
    if (!pkg.active && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json(pkg);
  } catch (err) {
    next(err);
  }
};

// Create a package
exports.createPackage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      tokenAmount,
      price,
      currency,
      isPromotion,
      discountPercentage,
      validUntil,
      active
    } = req.body;

    // Basic validation
    if (!name || !tokenAmount || !price) {
      return res.status(400).json({ message: 'Name, token amount, and price are required' });
    }

    // Create new package
    const pkg = new Package({
      name,
      description,
      tokenAmount,
      price,
      currency: currency || 'USD',
      isPromotion: isPromotion || false,
      discountPercentage: discountPercentage || 0,
      validUntil: validUntil || null,
      active: active !== undefined ? active : true
    });

    await pkg.save();

    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
};

// Update a package
exports.updatePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    const {
      name,
      description,
      tokenAmount,
      price,
      currency,
      isPromotion,
      discountPercentage,
      validUntil,
      active
    } = req.body;

    // Update fields if provided
    if (name) pkg.name = name;
    if (description !== undefined) pkg.description = description;
    if (tokenAmount) pkg.tokenAmount = tokenAmount;
    if (price) pkg.price = price;
    if (currency) pkg.currency = currency;
    if (isPromotion !== undefined) pkg.isPromotion = isPromotion;
    if (discountPercentage !== undefined) pkg.discountPercentage = discountPercentage;
    if (validUntil !== undefined) pkg.validUntil = validUntil;
    if (active !== undefined) pkg.active = active;

    await pkg.save();

    res.json(pkg);
  } catch (err) {
    next(err);
  }
};

// Delete a package
exports.deletePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Instead of hard delete, just set to inactive
    pkg.active = false;
    await pkg.save();

    res.json({ message: 'Package deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

// Purchase a token package
exports.purchasePackage = async (req, res, next) => {
  try {
    const { paymentMethod, paymentDetails } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method is required' });
    }

    // Find the package
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Check if package is active
    if (!pkg.active) {
      return res.status(400).json({ message: 'This package is not available for purchase' });
    }

    // Check if promotion is still valid
    if (pkg.isPromotion && pkg.validUntil && new Date(pkg.validUntil) < new Date()) {
      return res.status(400).json({ message: 'This promotion has expired' });
    }

    // Create transaction record
    const transaction = new Transaction({
      user: req.user.id,
      package: pkg._id,
      tokenAmount: pkg.tokenAmount,
      amount: pkg.price,
      currency: pkg.currency,
      paymentMethod,
      status: 'pending',
      paymentDetails
    });

    // In a real app, we would process payment here
    // For this mock implementation, we'll just assume payment succeeded
    transaction.status = 'completed';

    // Add tokens to user's account
    const user = await User.findById(req.user.id);
    user.tokens += pkg.tokenAmount;

    // Save transaction and user updates
    await transaction.save();
    await user.save();

    res.json({
      message: 'Purchase successful',
      transaction,
      tokens: user.tokens
    });
  } catch (err) {
    next(err);
  }
};
