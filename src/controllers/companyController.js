const Company = require('../models/Company');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private/Admin
exports.getCompanies = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single company
// @route   GET /api/companies/:id
// @access  Private/Admin
exports.getCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    return next(
      new ErrorResponse(`Company not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: company
  });
});

// @desc    Create new company
// @route   POST /api/companies
// @access  Private/Admin
exports.createCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.create(req.body);

  res.status(201).json({
    success: true,
    data: company
  });
});

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private/Admin
exports.updateCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!company) {
    return next(
      new ErrorResponse(`Company not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: company
  });
});

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private/Admin
exports.deleteCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByIdAndDelete(req.params.id);

  if (!company) {
    return next(
      new ErrorResponse(`Company not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get ZIMRA registration status
// @route   GET /api/companies/:id/zimra-status
// @access  Private/Admin
exports.getZimraStatus = asyncHandler(async (req, res, next) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    return next(
      new ErrorResponse(`Company not found with id of ${req.params.id}`, 404)
    );
  }

  // In a real implementation, this would query ZIMRA API
  res.status(200).json({
    success: true,
    data: {
      registered: company.zimraRegistered,
      tin: company.tin,
      vatNumber: company.vatNumber,
      lastSync: company.zimraLastSync
    }
  });
});

// @desc    Register company with ZIMRA
// @route   POST /api/companies/:id/register-zimra
// @access  Private/Admin
exports.registerWithZimra = asyncHandler(async (req, res, next) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    return next(
      new ErrorResponse(`Company not found with id of ${req.params.id}`, 404)
    );
  }

  // Validate required fields
  if (!company.tin || !company.address || !company.contacts) {
    return next(
      new ErrorResponse('Company must have TIN, address, and contacts to register with ZIMRA', 400)
    );
  }

  // In a real implementation, this would call ZIMRA API
  // Simulating successful registration
  company.zimraRegistered = true;
  company.zimraLastSync = new Date();
  await company.save();

  res.status(200).json({
    success: true,
    data: {
      message: 'Company registered with ZIMRA successfully',
      company
    }
  });
});