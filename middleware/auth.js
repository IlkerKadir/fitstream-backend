// middleware/auth.js
const passport = require('passport');

// Authentication middleware
exports.authenticate = (req, res, next) => {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        message: 'Authentication failed',
        details: info ? info.message : 'Invalid or missing token'
      });
    }

    // Set the user in the request object
    req.user = user;
    next();
  })(req, res, next);
};

// Check if user is authenticated (for routes that use session auth)
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Not authenticated' });
};
