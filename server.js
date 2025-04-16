// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
require('./config/db')();

// IMPORTANT: Place CORS middleware BEFORE other middleware and routes
// More permissive CORS configuration for development
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware (make sure this is after the session middleware)
app.use(passport.initialize());
// Only use passport.session() if you need session-based authentication
// For JWT-only auth, this can be removed
app.use(passport.session());

// Initialize passport configuration
require('./config/passport')(passport);

// Simple health check endpoint that doesn't require authentication
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Debug endpoint to check auth status
app.get('/api/auth-test', require('./middleware/auth').authenticate, (req, res) => {
  res.json({
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      role: req.user.role,
      name: `${req.user.firstName} ${req.user.lastName}`
    }
  });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/packages', require('./routes/packageRoutes'));
app.use('/api/stream', require('./routes/streamRoutes'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
  });
}

// Global error handler
app.use(require('./middleware/errorHandler'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
