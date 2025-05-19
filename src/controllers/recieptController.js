const Receipt = require('../models/Receipt');
const Device = require('../models/Device');
const FiscalService = require('../services/fiscalService');
const ZimraApiService = require('../services/zimraApiService');
const { validationResult } = require('express-validator');

exports.createReceipt = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { companyId } = req.user;
    const device = await Device.findOne({ 
      _id: req.body.deviceId, 
      company: companyId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Get last receipt to determine next global number
    const lastReceipt = await Receipt.findOne({ device: device._id })
      .sort({ globalNo: -1 });
    
    const globalNo = lastReceipt ? lastReceipt.globalNo + 1 : 1;
    const counter = await Receipt.countDocuments({ 
      device: device._id,
      fiscalDayNo: device.currentFiscalDay.number
    }) + 1;

    const receiptData = {
      ...req.body,
      company: companyId,
      device: device._id,
      globalNo,
      counter,
      fiscalDayNo: device.currentFiscalDay.number,
      previousReceiptHash: lastReceipt?.deviceSignature.hash
    };

    // Generate device signature
    const hash = await FiscalService.generateReceiptHash(receiptData);
    const signature = await FiscalService.generateReceiptSignature(
      receiptData, 
      device.privateKey // In real app, this should be securely retrieved
    );

    receiptData.deviceSignature = {
      hash,
      signature
    };

    // Validate receipt
    receiptData.validationErrors = await FiscalService.processReceiptValidation(receiptData);

    const receipt = new Receipt(receiptData);
    await receipt.save();

    // Update device's last receipt number
    device.lastReceiptGlobalNo = globalNo;
    await device.save();

    // Submit to ZIMRA if in online mode
    if (device.operatingMode === 'Online') {
      try {
        const zimraService = new ZimraApiService(device);
        const zimraResponse = await zimraService.submitReceipt(receipt.toObject());
        
        receipt.zimraSignature = {
          receiptId: zimraResponse.receiptID,
          serverDate: zimraResponse.serverDate,
          signature: zimraResponse.receiptServerSignature.signature
        };
        receipt.status = 'Approved';
        await receipt.save();
      } catch (error) {
        console.error('ZIMRA submission error:', error);
        receipt.status = 'Rejected';
        await receipt.save();
      }
    }

    // Generate QR code
    const qrCode = FiscalService.generateQRCodeData(receipt, device);

    res.status(201).json({
      receipt,
      qrCode
    });

  } catch (error) {
    next(error);
  }
};

exports.openFiscalDay = async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    const { companyId } = req.user;

    const device = await Device.findOne({ 
      _id: deviceId, 
      company: companyId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (device.currentFiscalDay.status !== 'Closed') {
      return res.status(400).json({ message: 'Current fiscal day must be closed first' });
    }

    const lastFiscalDay = await Receipt.findOne({ device: device._id })
      .sort({ fiscalDayNo: -1 });
    
    const fiscalDayNo = lastFiscalDay ? lastFiscalDay.fiscalDayNo + 1 : 1;
    const openedAt = new Date();

    if (device.operatingMode === 'Online') {
      const zimraService = new ZimraApiService(device);
      const response = await zimraService.openFiscalDay(fiscalDayNo, openedAt);
      fiscalDayNo = response.fiscalDayNo; // Use ZIMRA-assigned number if device didn't provide one
    }

    device.currentFiscalDay = {
      number: fiscalDayNo,
      status: 'Opened',
      openedAt
    };
    await device.save();

    res.json({
      message: 'Fiscal day opened successfully',
      fiscalDayNo,
      openedAt
    });

  } catch (error) {
    next(error);
  }
};

exports.closeFiscalDay = async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    const { companyId } = req.user;

    const device = await Device.findOne({ 
      _id: deviceId, 
      company: companyId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (device.currentFiscalDay.status !== 'Opened') {
      return res.status(400).json({ message: 'No open fiscal day to close' });
    }

    // Calculate fiscal day counters
    const receipts = await Receipt.find({ 
      device: device._id,
      fiscalDayNo: device.currentFiscalDay.number
    });

    const counters = this.calculateFiscalCounters(receipts);

    // Generate signature
    const signatureData = {
      deviceID: device.deviceId,
      fiscalDayNo: device.currentFiscalDay.number,
      fiscalDayDate: device.currentFiscalDay.openedAt.toISOString().split('T')[0],
      fiscalDayCounters: counters
    };

    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('base64');
    
    const signature = crypto.createSign('SHA256')
      .update(hash)
      .sign(device.privateKey, 'base64');

    if (device.operatingMode === 'Online') {
      const zimraService = new ZimraApiService(device);
      await zimraService.closeFiscalDay(
        device.currentFiscalDay.number,
        counters,
        {
          hash,
          signature
        }
      );
    }

    device.currentFiscalDay.status = 'Closed';
    device.currentFiscalDay.closedAt = new Date();
    await device.save();

    res.json({
      message: 'Fiscal day closed successfully',
      fiscalDayNo: device.currentFiscalDay.number,
      closedAt: device.currentFiscalDay.closedAt
    });

  } catch (error) {
    next(error);
  }
};

function calculateFiscalCounters(receipts) {
  // Implement counter calculation according to ZIMRA specs
  const counters = {
    SaleByTax: {},
    SaleTaxByTax: {},
    CreditNoteByTax: {},
    CreditNoteTaxByTax: {},
    DebitNoteByTax: {},
    DebitNoteTaxByTax: {},
    BalanceByMoneyType: {}
  };

  receipts.forEach(receipt => {
    receipt.taxes.forEach(tax => {
      const taxKey = `${tax.taxId}_${tax.taxPercent || 'exempt'}`;
      
      if (receipt.receiptType === 'FiscalInvoice') {
        // Process sales
        counters.SaleByTax[taxKey] = (counters.SaleByTax[taxKey] || 0) + tax.salesAmountWithTax;
        counters.SaleTaxByTax[taxKey] = (counters.SaleTaxByTax[taxKey] || 0) + tax.taxAmount;
      } else if (receipt.receiptType === 'CreditNote') {
        // Process credit notes
        counters.CreditNoteByTax[taxKey] = (counters.CreditNoteByTax[taxKey] || 0) + tax.salesAmountWithTax;
        counters.CreditNoteTaxByTax[taxKey] = (counters.CreditNoteTaxByTax[taxKey] || 0) + tax.taxAmount;
      } else if (receipt.receiptType === 'DebitNote') {
        // Process debit notes
        counters.DebitNoteByTax[taxKey] = (counters.DebitNoteByTax[taxKey] || 0) + tax.salesAmountWithTax;
        counters.DebitNoteTaxByTax[taxKey] = (counters.DebitNoteTaxByTax[taxKey] || 0) + tax.taxAmount;
      }
    });

    receipt.payments.forEach(payment => {
      const paymentKey = payment.moneyTypeCode;
      counters.BalanceByMoneyType[paymentKey] = (counters.BalanceByMoneyType[paymentKey] || 0) + payment.paymentAmount;
    });
  });

  // Convert to ZIMRA expected format
  return Object.entries(counters).flatMap(([counterType, valuesByKey]) => {
    return Object.entries(valuesByKey).map(([key, value]) => {
      const [taxId, taxPercent] = key.split('_');
      return {
        fiscalCounterType: counterType,
        fiscalCounterCurrency: 'ZWL', // Should be determined from receipt
        fiscalCounterTaxID: taxId,
        fiscalCounterTaxPercent: taxPercent === 'exempt' ? undefined : parseFloat(taxPercent),
        fiscalCounterValue: value
      };
    });
  });
}

// ... (previous code)

exports.processOfflineBatch = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { file } = req;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = file.path;
    const result = await OfflineService.processOfflineFile(filePath);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'Offline batch processed successfully',
      result
    });

  } catch (error) {
    next(error);
  }
};

exports.generateOfflineFile = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { deviceId, fiscalDayNo } = req.params;

    const device = await Device.findOne({ 
      _id: deviceId,
      company: companyId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const { filePath, fileContent } = await OfflineService.generateOfflineFile(deviceId, fiscalDayNo);

    res.download(filePath, `offline_batch_${deviceId}_${fiscalDayNo}.json`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up the temporary file
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    next(error);
  }
};

exports.syncOfflineReceipts = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { deviceId } = req.params;

    const device = await Device.findOne({ 
      _id: deviceId,
      company: companyId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const result = await OfflineService.syncOfflineReceipts(deviceId);

    res.json({
      message: 'Offline receipts synchronized successfully',
      result
    });

  } catch (error) {
    next(error);
  }
};