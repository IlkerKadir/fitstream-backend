// middleware/roleCheck.js
// Role-based access control middleware

// Check if user is a trainer
exports.isTrainer = (req, res, next) => {
  if (req.user && (req.user.role === 'trainer' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Trainer access required' });
};

// Check if user is an admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
};

// Check if user is owner of the resource or admin
exports.isOwnerOrAdmin = (paramIdField) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' ||
        req.user._id.toString() === req.params[paramIdField]) {
      return next();
    }
    return res.status(403).json({ message: 'Access denied' });
  };
};
