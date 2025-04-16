// controllers/userController.js
const User = require('../models/User');
const Session = require('../models/Session');
const { validationResult } = require('express-validator');

// Get all users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, profilePicture, phoneNumber } = req.body;

    // Create update object with only the fields that were provided
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (profilePicture) updateData.profilePicture = profilePicture;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    // For trainer profiles, update those fields if the user is a trainer
    if (req.user.role === 'trainer' && req.body.trainerProfile) {
      updateData.trainerProfile = {
        ...(req.user.trainerProfile || {}),
        ...req.body.trainerProfile
      };
    }

    // Update the user
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.remove();

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Update user tokens
exports.updateTokens = async (req, res, next) => {
  try {
    const { tokens, operation } = req.body;

    if (!tokens || isNaN(tokens) || tokens < 0) {
      return res.status(400).json({ message: 'Invalid token amount' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add or subtract tokens based on operation
    if (operation === 'add') {
      user.tokens += tokens;
    } else if (operation === 'subtract') {
      if (user.tokens < tokens) {
        return res.status(400).json({ message: 'User does not have enough tokens' });
      }
      user.tokens -= tokens;
    } else {
      // Set to specific value if no operation specified
      user.tokens = tokens;
    }

    await user.save();

    res.json({
      message: 'Tokens updated successfully',
      tokens: user.tokens
    });
  } catch (err) {
    next(err);
  }
};

// Get user's booked sessions
exports.getUserSessions = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate({
        path: 'bookedSessions.session',
        select: 'title trainer scheduledAt duration status',
        populate: {
          path: 'trainer',
          select: 'firstName lastName'
        }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format the response to be more user-friendly
    const bookedSessions = user.bookedSessions.map(booking => ({
      id: booking.session._id,
      title: booking.session.title,
      trainer: `${booking.session.trainer.firstName} ${booking.session.trainer.lastName}`,
      scheduledAt: booking.session.scheduledAt,
      duration: booking.session.duration,
      status: booking.session.status,
      bookedAt: booking.bookedAt
    }));

    res.json(bookedSessions);
  } catch (err) {
    next(err);
  }
};

// Update user preferences
exports.updatePreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update only the provided preferences
    if (req.body.categories) user.preferences.categories = req.body.categories;
    if (req.body.difficulty) user.preferences.difficulty = req.body.difficulty;
    if (req.body.preferredTrainers) user.preferences.preferredTrainers = req.body.preferredTrainers;

    // Update notification preferences if provided
    if (req.body.notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...req.body.notifications
      };
    }

    await user.save();

    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (err) {
    next(err);
  }
};
