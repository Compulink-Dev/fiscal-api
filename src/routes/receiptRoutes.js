const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'temp/' });

// Online receipt submission
router.post('/', auth.authenticate, receiptController.createReceipt);

// Fiscal day management
router.post('/fiscal-day/open', auth.authenticate, receiptController.openFiscalDay);
router.post('/fiscal-day/close', auth.authenticate, receiptController.closeFiscalDay);

// Offline operations
router.post('/offline/batch', auth.authenticate, upload.single('file'), receiptController.processOfflineBatch);
router.get('/offline/generate/:deviceId/:fiscalDayNo', auth.authenticate, receiptController.generateOfflineFile);
router.post('/offline/sync/:deviceId', auth.authenticate, receiptController.syncOfflineReceipts);

module.exports = router;