const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Company = require('../models/Company');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

exports.authenticate = async (req, res, next) => {
  // Your authentication logic
  if (!roles.includes(req.user.role)) {
    return next(
      new ErrorResponse(
        `User role ${req.user.role} is not authorized to access this route`,
        403
      )
    );
  }
  next();
};

// Device authentication middleware
exports.deviceAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Device not authorized', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const device = await Device.findById(decoded.id);

    if (!device) {
      return next(new ErrorResponse('No device found with this ID', 404));
    }

    req.device = device;
    next();
  } catch (err) {
    return next(new ErrorResponse('Device not authorized', 401));
  }
};

// Company ownership check
exports.checkCompanyOwnership = async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }

  const company = await Company.findById(req.params.companyId);

  if (!company) {
    return next(
      new ErrorResponse(`No company with the id of ${req.params.companyId}`),
      404
    );
  }

  // Make sure user is company owner or admin
  if (company.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this company`,
        401
      )
    );
  }

  next();
};