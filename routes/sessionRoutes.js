// routes/sessionRoutes.js
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticate } = require('../middleware/auth');
const { isTrainer, isAdmin } = require('../middleware/roleCheck');

// @route   GET api/sessions
// @desc    Get all sessions
// @access  Public
router.get('/', sessionController.getAllSessions);

// @route   GET api/sessions/:id
// @desc    Get session by ID
// @access  Public
router.get('/:id', sessionController.getSessionById);

// @route   GET api/sessions/:id/analytics
// @desc    Get session analytics
// @access  Private (trainers only)
router.get('/:id/analytics', authenticate, isTrainer, sessionController.getSessionAnalytics);

// @route   POST api/sessions
// @desc    Create a session
// @access  Private (trainers only)
router.post('/', authenticate, isTrainer, sessionController.createSession);

// @route   PUT api/sessions/:id
// @desc    Update a session
// @access  Private (trainers only)
router.put('/:id', authenticate, isTrainer, sessionController.updateSession);

// @route   DELETE api/sessions/:id
// @desc    Delete a session
// @access  Private (trainers only)
router.delete('/:id', authenticate, isTrainer, sessionController.deleteSession);

// @route   POST api/sessions/:id/book
// @desc    Book a session
// @access  Private
router.post('/:id/book', authenticate, sessionController.bookSession);

// @route   POST api/sessions/:id/rate
// @desc    Rate a session
// @access  Private
router.post('/:id/rate', authenticate, sessionController.rateSession);

// @route   GET api/sessions/trainer/:trainerId
// @desc    Get all sessions by trainer
// @access  Public
router.get('/trainer/:trainerId', sessionController.getSessionsByTrainer);

// @route   PUT api/sessions/:id/status
// @desc    Update session status
// @access  Private (trainers only)
router.put('/:id/status', authenticate, isTrainer, sessionController.updateSessionStatus);

module.exports = router;
