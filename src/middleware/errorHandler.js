const { logError } = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logError(err.stack || err.message);

  // Handle ZIMRA API errors
  if (err.message.includes('ZIMRA API Error')) {
    return res.status(502).json({
      error: 'ZIMRA_API_ERROR',
      message: err.message
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid token'
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: 'DUPLICATE_KEY',
      message: `${field} already exists`,
      field
    });
  }

  // Default error handler
  res.status(500).json({
    error: 'SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
};