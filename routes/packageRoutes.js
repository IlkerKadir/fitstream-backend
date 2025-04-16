// routes/packageRoutes.js
const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// @route   GET api/packages
// @desc    Get all packages
// @access  Public
router.get('/', packageController.getAllPackages);

// @route   GET api/packages/:id
// @desc    Get package by ID
// @access  Public
router.get('/:id', packageController.getPackageById);

// @route   POST api/packages
// @desc    Create a package
// @access  Private (admin only)
router.post('/', authenticate, isAdmin, packageController.createPackage);

// @route   PUT api/packages/:id
// @desc    Update a package
// @access  Private (admin only)
router.put('/:id', authenticate, isAdmin, packageController.updatePackage);

// @route   DELETE api/packages/:id
// @desc    Delete a package
// @access  Private (admin only)
router.delete('/:id', authenticate, isAdmin, packageController.deletePackage);

// @route   POST api/packages/:id/purchase
// @desc    Purchase a token package
// @access  Private
router.post('/:id/purchase', authenticate, packageController.purchasePackage);

module.exports = router;
