const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = {
  authenticate: (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },

  authorizeCompany: (req, res, next) => {
    if (req.user.role === 'admin') return next();
    if (req.user.companyId.toString() !== req.params.companyId) {
      return res.status(403).json({ message: 'Not authorized for this company' });
    }
    next();
  }
};