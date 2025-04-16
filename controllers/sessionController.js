// controllers/sessionController.js
const Session = require('../models/Session');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all sessions
exports.getAllSessions = async (req, res, next) => {
  try {
    // Parse query parameters for filtering
    const { category, difficulty, trainer, status, search, upcoming } = req.query;

    // Build query
    const query = {};

    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (trainer) query.trainer = trainer;
    if (status) query.status = status;

    // For upcoming sessions
    if (upcoming === 'true') {
      query.scheduledAt = { $gt: new Date() };
    }

    // Text search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Execute query with population
    const sessions = await Session.find(query)
      .populate('trainer', 'firstName lastName profilePicture')
      .sort({ scheduledAt: 1 });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

// Get session by ID
exports.getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'firstName lastName profilePicture trainerProfile')
      .populate('participants.user', 'firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
};

// Create a session
exports.createSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      category,
      difficulty,
      scheduledAt,
      duration,
      tokenCost,
      maxParticipants,
      equipmentRequired,
      tags
    } = req.body;

    // Create new session
    const session = new Session({
      title,
      description,
      trainer: req.user.id,
      category,
      difficulty,
      scheduledAt,
      duration,
      tokenCost: tokenCost || 1,
      maxParticipants: maxParticipants || 0
    });

    // Add optional fields if provided
    if (equipmentRequired) session.equipmentRequired = equipmentRequired;
    if (tags) session.tags = tags;

    await session.save();

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

// Update a session
exports.updateSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer of this session
    if (session.trainer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this session' });
    }

    // Don't allow updates to sessions that have already started or completed
    if (session.status === 'live' || session.status === 'completed') {
      return res.status(400).json({ message: `Cannot update a ${session.status} session` });
    }

    // Update fields that were provided
    const {
      title,
      description,
      category,
      difficulty,
      scheduledAt,
      duration,
      tokenCost,
      maxParticipants,
      equipmentRequired,
      tags,
      status
    } = req.body;

    if (title) session.title = title;
    if (description) session.description = description;
    if (category) session.category = category;
    if (difficulty) session.difficulty = difficulty;
    if (scheduledAt) session.scheduledAt = scheduledAt;
    if (duration) session.duration = duration;
    if (tokenCost) session.tokenCost = tokenCost;
    if (maxParticipants !== undefined) session.maxParticipants = maxParticipants;
    if (equipmentRequired) session.equipmentRequired = equipmentRequired;
    if (tags) session.tags = tags;
    if (status && status !== 'live' && status !== 'completed') session.status = status;

    await session.save();

    res.json(session);
  } catch (err) {
    next(err);
  }
};

// Delete a session
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer of this session
    if (session.trainer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this session' });
    }

    // Don't allow deletion of sessions that have already started or completed
    if (session.status === 'live' || session.status === 'completed') {
      return res.status(400).json({ message: `Cannot delete a ${session.status} session` });
    }

    await session.remove();

    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Book a session
exports.bookSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if session is in the future
    if (new Date(session.scheduledAt) < new Date()) {
      return res.status(400).json({ message: 'Cannot book past sessions' });
    }

    // Check if session is cancelled
    if (session.status === 'cancelled') {
      return res.status(400).json({ message: 'This session has been cancelled' });
    }

    // Check if already booked
    const alreadyBooked = user.bookedSessions.some(booking =>
      booking.session.toString() === session._id.toString()
    );

    if (alreadyBooked) {
      return res.status(400).json({ message: 'Session already booked' });
    }

    // Check max participants
    if (session.maxParticipants > 0 && session.participants.length >= session.maxParticipants) {
      return res.status(400).json({ message: 'Session is full' });
    }

    // Check if user has enough tokens
    if (user.tokens < session.tokenCost) {
      return res.status(400).json({ message: 'Insufficient tokens' });
    }

    // Process booking
    user.tokens -= session.tokenCost;
    user.bookedSessions.push({ session: session._id });
    session.participants.push({ user: user._id });

    await user.save();
    await session.save();

    res.json({
      message: 'Session booked successfully',
      tokens: user.tokens
    });
  } catch (err) {
    next(err);
  }
};

// Rate a session
exports.rateSession = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const session = await Session.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if session is completed
    if (session.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed sessions' });
    }

    // Check if user was a participant
    const wasParticipant = session.participants.some(p =>
      p.user.toString() === req.user.id
    );

    if (!wasParticipant) {
      return res.status(403).json({ message: 'You must participate in the session to rate it' });
    }

    // Check if user already rated this session
    const alreadyRated = session.ratings.some(r =>
      r.user.toString() === req.user.id
    );

    if (alreadyRated) {
      // Update existing rating
      session.ratings.forEach(r => {
        if (r.user.toString() === req.user.id) {
          r.rating = rating;
          if (feedback) r.feedback = feedback;
          r.createdAt = new Date();
        }
      });
    } else {
      // Add new rating
      session.ratings.push({
        user: req.user.id,
        rating,
        feedback,
        createdAt: new Date()
      });

      // Add to user's completed sessions if not already there
      const alreadyCompleted = user.completedSessions.some(s =>
        s.session.toString() === session._id.toString()
      );

      if (!alreadyCompleted) {
        user.completedSessions.push({
          session: session._id,
          completedAt: new Date(),
          rating,
          feedback
        });

        await user.save();
      }
    }

    // Recalculate average rating
    session.calculateAverageRating();
    await session.save();

    // Update trainer rating
    const trainer = await User.findById(session.trainer);
    if (trainer && trainer.trainerProfile) {
      const trainerSessions = await Session.find({ trainer: trainer._id });

      // Calculate average rating across all sessions
      let totalRatings = 0;
      let ratingSum = 0;

      trainerSessions.forEach(s => {
        if (s.ratings && s.ratings.length > 0) {
          totalRatings += s.ratings.length;
          ratingSum += s.ratings.reduce((sum, r) => sum + r.rating, 0);
        }
      });

      if (totalRatings > 0) {
        trainer.trainerProfile.rating = (ratingSum / totalRatings).toFixed(1);
        trainer.trainerProfile.totalRatings = totalRatings;
        await trainer.save();
      }
    }

    res.json({
      message: 'Session rated successfully',
      rating,
      sessionRating: session.averageRating
    });
  } catch (err) {
    next(err);
  }
};

// Get all sessions by trainer
exports.getSessionsByTrainer = async (req, res, next) => {
  try {
    const { trainerId } = req.params;

    const sessions = await Session.find({ trainer: trainerId })
      .sort({ scheduledAt: -1 })
      .populate('trainer', 'firstName lastName profilePicture');

    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

// Update session status
exports.updateSessionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['scheduled', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer of this session
    if (session.trainer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this session' });
    }

    // Don't allow status changes for live or completed sessions
    if (session.status === 'live' || session.status === 'completed') {
      return res.status(400).json({ message: `Cannot change status of a ${session.status} session` });
    }

    session.status = status;
    await session.save();

    // If session is cancelled, refund tokens to users
    if (status === 'cancelled') {
      // Get all users who booked this session
      const users = await User.find({
        'bookedSessions.session': session._id
      });

      // Refund tokens to each user
      for (const user of users) {
        user.tokens += session.tokenCost;

        // Remove session from bookedSessions
        user.bookedSessions = user.bookedSessions.filter(
          booking => booking.session.toString() !== session._id.toString()
        );

        await user.save();
      }
    }

    res.json({
      message: `Session ${status === 'cancelled' ? 'cancelled' : 'updated'} successfully`,
      session
    });
  } catch (err) {
    next(err);
  }
};

// Get session analytics
exports.getSessionAnalytics = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'firstName lastName profilePicture')
      .populate('participants.user', 'firstName lastName email profilePicture')
      .populate('ratings.user', 'firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check authorization - only trainer of this session or admin can view analytics
    if (
      session.trainer._id.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message: 'Not authorized to view analytics for this session'
      });
    }

    // Calculate analytics
    const totalParticipants = session.participants.length;
    const attendedParticipants = session.participants.filter(p => p.joinedAt).length;
    const completedParticipants = session.participants.filter(
      p => p.joinedAt && p.duration && p.duration >= session.duration * 0.8
    ).length;

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    session.ratings.forEach(rating => {
      const ratingValue = Math.floor(rating.rating);
      if (ratingValue >= 1 && ratingValue <= 5) {
        ratingDistribution[ratingValue]++;
      }
    });

    // Create engagement metrics
    const chatCount = session.messages ? session.messages.length : 0;
    const questionsCount = session.messages ?
      session.messages.filter(m => m.message.includes('?')).length : 0;
    const reactionsCount = session.reactions ? session.reactions.length : 0;

    // Calculate dropoff points
    const dropoffPoints = [];
    const participantsDuration = {};

    // Group participants by leave time
    session.participants.forEach(p => {
      if (p.joinedAt && p.duration) {
        const durationMinutes = Math.floor(p.duration / 60);
        participantsDuration[durationMinutes] =
          (participantsDuration[durationMinutes] || 0) + 1;
      }
    });

    // Find significant dropoff points (where more than 5% of participants left)
    let remainingParticipants = attendedParticipants;
    for (let minute = 1; minute <= session.duration; minute++) {
      const leftAtThisMinute = participantsDuration[minute] || 0;
      if (leftAtThisMinute > 0) {
        const percentage = Math.round((leftAtThisMinute / attendedParticipants) * 100);
        if (percentage >= 5) {
          dropoffPoints.push({
            time: `${minute} minutes`,
            percentage
          });
        }
        remainingParticipants -= leftAtThisMinute;
      }
    }

    // Calculate session duration analytics
    const durations = session.participants
      .filter(p => p.duration)
      .map(p => p.duration / 60); // Convert to minutes

    const averageViewTime = durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;

    const peakAttendance = Math.round(session.duration / 3); // Estimate peak around 1/3 of session

    const analytics = {
      participants: {
        registered: totalParticipants,
        attended: attendedParticipants,
        completed: completedParticipants
      },
      ratings: {
        average: session.averageRating,
        total: session.ratings.length,
        distribution: ratingDistribution
      },
      timeAnalytics: {
        peakAttendance: `${peakAttendance} minutes`,
        averageViewTime: `${averageViewTime} minutes`,
        dropoffPoints
      },
      engagement: {
        chatMessages: chatCount,
        questions: questionsCount,
        reactions: reactionsCount
      }
    };

    // Return the session with analytics
    const result = session.toObject();
    result.analytics = analytics;

    res.json(result);
  } catch (err) {
    next(err);
  }
};
