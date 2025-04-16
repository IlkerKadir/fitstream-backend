// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { isAdmin, isOwnerOrAdmin } = require('../middleware/roleCheck');

// @route   GET api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', authenticate, isAdmin, userController.getAllUsers);

// @route   GET api/users/:id
// @desc    Get user by ID
// @access  Private (owner or admin)
router.get('/:id', authenticate, isOwnerOrAdmin('id'), userController.getUserById);

// @route   PUT api/users/:id
// @desc    Update user
// @access  Private (owner or admin)
router.put('/:id', authenticate, isOwnerOrAdmin('id'), userController.updateUser);

// @route   DELETE api/users/:id
// @desc    Delete user
// @access  Private (owner or admin)
router.delete('/:id', authenticate, isOwnerOrAdmin('id'), userController.deleteUser);

// @route   PUT api/users/:id/tokens
// @desc    Update user tokens
// @access  Private (owner or admin)
router.put('/:id/tokens', authenticate, isOwnerOrAdmin('id'), userController.updateTokens);

// @route   GET api/users/:id/sessions
// @desc    Get user's booked sessions
// @access  Private (owner or admin)
router.get('/:id/sessions', authenticate, isOwnerOrAdmin('id'), userController.getUserSessions);

// @route   PUT api/users/:id/preferences
// @desc    Update user preferences
// @access  Private (owner or admin)
router.put('/:id/preferences', authenticate, isOwnerOrAdmin('id'), userController.updatePreferences);

module.exports = router;
