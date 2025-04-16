// Update models/Session.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Existing fields...
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  tokenCost: {
    type: Number,
    required: true,
    default: 1
  },
  maxParticipants: {
    type: Number,
    default: 0 // 0 means unlimited
  },

  // Enhance the participants field with more detailed tracking
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date
    },
    leaveAt: {
      type: Date
    },
    duration: {
      type: Number // in seconds
    },
    // Track engagement statistics
    messages: {
      type: Number,
      default: 0
    },
    reactions: {
      type: Number,
      default: 0
    }
  }],

  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },

  // Enhanced streaming details
  streamingDetails: {
    streamId: String,
    channelName: String,
    resourceId: String,
    sid: String,
    startedAt: Date,
    endedAt: Date,
    recordingUrl: String
  },

  thumbnail: String,
  equipmentRequired: [String],
  tags: [String],

  // Track detailed ratings
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Add fields for analytics
  averageRating: {
    type: Number,
    default: 0
  },

  // Store chat messages
  messages: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Store reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['thumbsUp', 'heart', 'star', 'clap', 'fire']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update timestamps
sessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for participant count
sessionSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Calculate average rating when a new rating is added
sessionSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    return;
  }

  const sum = this.ratings.reduce((total, rating) => total + rating.rating, 0);
  this.averageRating = (sum / this.ratings.length).toFixed(1);
};

// Record a participant joining the session
sessionSchema.methods.recordParticipantJoin = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );

  const now = new Date();

  if (participantIndex >= 0) {
    // Update existing participant
    this.participants[participantIndex].joinedAt = now;
    // Clear leave time if they're rejoining
    this.participants[participantIndex].leaveAt = undefined;
  } else {
    // Add new participant
    this.participants.push({
      user: userId,
      joinedAt: now,
      messages: 0,
      reactions: 0
    });
  }
};

// Record a participant leaving the session
sessionSchema.methods.recordParticipantLeave = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );

  if (participantIndex >= 0 && this.participants[participantIndex].joinedAt) {
    const now = new Date();
    this.participants[participantIndex].leaveAt = now;

    // Calculate session duration
    const joinTime = new Date(this.participants[participantIndex].joinedAt);
    const durationSeconds = Math.floor((now - joinTime) / 1000);

    // Update or add to existing duration
    const existingDuration = this.participants[participantIndex].duration || 0;
    this.participants[participantIndex].duration = existingDuration + durationSeconds;
  }
};

// Add a message to the session
sessionSchema.methods.addMessage = function(userId, message) {
  this.messages.push({
    user: userId,
    message,
    timestamp: new Date()
  });

  // Increment message count for the participant
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );

  if (participantIndex >= 0) {
    this.participants[participantIndex].messages =
      (this.participants[participantIndex].messages || 0) + 1;
  }
};

// Add a reaction to the session
sessionSchema.methods.addReaction = function(userId, type) {
  this.reactions.push({
    user: userId,
    type,
    timestamp: new Date()
  });

  // Increment reaction count for the participant
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );

  if (participantIndex >= 0) {
    this.participants[participantIndex].reactions =
      (this.participants[participantIndex].reactions || 0) + 1;
  }
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
