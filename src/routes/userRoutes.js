const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const {
  registerValidator,
  loginValidator,
  updateDetailsValidator,
  updatePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} = require('../utils/userValidator');
const { validate } = require('../utils/validators'); // Middleware for validating requests

const router = express.Router();

// User registration
router.post('/register', registerValidator, validate, register);

// User login
router.post('/login', loginValidator, validate, login);

// User logout
router.get('/logout', logout);

// Get current logged in user
router.get('/me', getMe);

// Update user details
router.put('/updatedetails', updateDetailsValidator, validate, updateDetails);

// Update password
router.put('/updatepassword', updatePasswordValidator, validate, updatePassword);

// Forgot password
router.post('/forgotpassword', forgotPasswordValidator, validate, forgotPassword);

// Reset password
router.put('/resetpassword/:resettoken', resetPasswordValidator, validate, resetPassword);

module.exports = router;