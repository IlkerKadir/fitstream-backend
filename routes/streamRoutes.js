// routes/streamRoutes.js
const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');
const { authenticate } = require('../middleware/auth');
const { isTrainer } = require('../middleware/roleCheck');

// @route   GET api/stream/:sessionId
// @desc    Get streaming details for a session
// @access  Private
router.get('/:sessionId', authenticate, streamController.getStreamingDetails);

// @route   POST api/stream/:sessionId/start
// @desc    Start a streaming session
// @access  Private (trainers only)
router.post('/:sessionId/start', authenticate, isTrainer, streamController.startStream);

// @route   POST api/stream/:sessionId/end
// @desc    End a streaming session
// @access  Private (trainers only)
router.post('/:sessionId/end', authenticate, isTrainer, streamController.endStream);

// @route   POST api/stream/:sessionId/join
// @desc    Join a streaming session
// @access  Private
router.post('/:sessionId/join', authenticate, streamController.joinStream);

// @route   POST api/stream/:sessionId/leave
// @desc    Leave a streaming session
// @access  Private
router.post('/:sessionId/leave', authenticate, streamController.leaveStream);

// @route   GET api/stream/:sessionId/participants
// @desc    Get participants in a stream
// @access  Private (trainers only)
router.get('/:sessionId/participants', authenticate, isTrainer, streamController.getStreamParticipants);

// @route   POST api/stream/:sessionId/message
// @desc    Send a message in a stream
// @access  Private
router.post('/:sessionId/message', authenticate, streamController.sendMessage);

// @route   POST api/stream/:sessionId/reaction
// @desc    Send a reaction in a stream
// @access  Private
router.post('/:sessionId/reaction', authenticate, streamController.sendReaction);

module.exports = router;
