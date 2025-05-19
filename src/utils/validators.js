const { check } = require('express-validator');

exports.registerValidator = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check(
    'password',
    'Please enter a password with 6 or more characters'
  ).isLength({ min: 6 }),
  check('role', 'Please specify a valid role').isIn(['user', 'admin', 'company_admin']),
  check('company', 'Company ID is required').not().isEmpty()
];

exports.loginValidator = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

exports.updateDetailsValidator = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail()
];

exports.updatePasswordValidator = [
  check('currentPassword', 'Current password is required').not().isEmpty(),
  check('newPassword', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];

exports.forgotPasswordValidator = [
  check('email', 'Please include a valid email').isEmail()
];

exports.resetPasswordValidator = [
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];