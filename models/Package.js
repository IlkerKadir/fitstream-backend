// models/Package.js
const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  tokenAmount: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isPromotion: {
    type: Boolean,
    default: false
  },
  discountPercentage: {
    type: Number,
    default: 0
  },
  validUntil: Date,
  active: {
    type: Boolean,
    default: true
  },
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
packageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Package = mongoose.model('Package', packageSchema);

module.exports = Package;
