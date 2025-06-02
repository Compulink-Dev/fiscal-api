// middleware/tenantMiddleware.js
const mongoose = require('mongoose');
const User = require('../models/User');

const tenantMiddleware = async (req, res, next) => {
  try {
    // Get user from authentication (assuming JWT is used)
    const userId = req.user.id;
    const user = await User.findById(userId).select('tenantId');
    
    if (!user || !user.tenantId) {
      return res.status(403).json({ error: 'Unauthorized - No tenant assigned' });
    }

    // Check if connection already exists for this tenant
    const tenantDbName = `tenant_${user.tenantId}`;
    const tenantDbUri = `${process.env.MONGO_URI}/${tenantDbName}?retryWrites=true&w=majority`;
    
    if (!mongoose.connections.some(conn => conn.name === tenantDbName)) {
      // Create new connection if it doesn't exist
      await mongoose.createConnection(tenantDbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false
      });
    }

    // Attach tenant connection to request
    req.tenantConnection = mongoose.connections.find(conn => conn.name === tenantDbName);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = tenantMiddleware;