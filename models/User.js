// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: String,
  role: {
    type: String,
    enum: ['user', 'trainer', 'admin'],
    default: 'user'
  },
  tokens: {
    type: Number,
    default: 0
  },
  bookedSessions: [{
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session'
    },
    bookedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedSessions: [{
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session'
    },
    completedAt: Date,
    rating: Number,
    feedback: String
  }],
  preferences: {
    categories: [String],
    difficulty: String,
    preferredTrainers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sessionReminders: {
        type: Boolean,
        default: true
      },
      promotions: {
        type: Boolean,
        default: false
      }
    }
  },
  // Trainer-specific fields
  trainerProfile: {
    bio: String,
    specialties: [String],
    experience: String,
    hourlyRate: Number,
    rating: {
      type: Number,
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  // Common fields
  phoneNumber: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get user's public profile (no sensitive info)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();

  delete userObject.password;

  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
