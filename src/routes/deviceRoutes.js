const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/auth');

// Public endpoints (no certificate required)
router.post('/verify-taxpayer', deviceController.verifyTaxpayerInformation);
router.post('/register', deviceController.registerDevice);
router.get('/server-certificate', deviceController.getServerCertificate);

// Authenticated endpoints (require valid device certificate)
router.get('/:deviceID/config', authMiddleware.deviceAuth, deviceController.getConfig);
router.get('/:deviceID/status', authMiddleware.deviceAuth, deviceController.getStatus);
router.post('/:deviceID/ping', authMiddleware.deviceAuth, deviceController.ping);

module.exports = router;