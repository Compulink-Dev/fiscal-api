const { logError } = require('../utils/logger');

module.exports = (err, req, res, next) => {
  // Safely attempt to log the error
  try {
    if (logError) {
      logError(err.stack || err.message);
    } else {
      console.error('Error:', err.stack || err.message);
    }
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }

  // Handle specific error types
  if (err.message.includes('ZIMRA API Error')) {
    return res.status(502).json({
      error: 'ZIMRA_API_ERROR',
      message: err.message
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid token'
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: 'DUPLICATE_KEY',
      message: `${field} already exists`,
      field
    });
  }

  // Default error handler
  res.status(err.statusCode || 500).json({
    error: 'SERVER_ERROR',
    message: err.message || 'An unexpected error occurred'
  });
};