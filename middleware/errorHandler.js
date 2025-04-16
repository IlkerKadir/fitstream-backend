// middleware/errorHandler.js
// Global error handling middleware
module.exports = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Custom error codes and messages
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  // Include auth-related details if available
  const authError = err.name === 'JsonWebTokenError' ||
                    err.name === 'TokenExpiredError' ||
                    err.name === 'NotBeforeError';

  // Send different responses based on environment
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      type: authError ? 'AuthenticationError' : err.name,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details || null
      })
    }
  });
};
