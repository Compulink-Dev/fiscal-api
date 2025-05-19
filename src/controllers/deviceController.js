const Device = require('../models/Device');
const { generateCertificate } = require('../services/certifivcteService');
const { generateSignature, verifySignature } = require('../services/signatureService');
const bcrypt = require('bcrypt');

// 3.1 verifyTaxpayerInformation
exports.verifyTaxpayerInformation = async (req, res) => {
  try {
    const { deviceID, activationKey, deviceSerialNo } = req.body;
    
    const device = await Device.findOne({ deviceID });
    if (!device) {
      return res.status(404).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Device not found',
        status: 404,
        errorCode: 'DEV01'
      });
    }

    const isValid = await device.verifyActivationKey(activationKey);
    if (!isValid) {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Invalid activation key',
        status: 422,
        errorCode: 'DEV02'
      });
    }

    if (device.serialNo !== deviceSerialNo) {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Invalid device serial number',
        status: 422,
        errorCode: 'DEV03'
      });
    }

    if (device.status === 'Blacklisted') {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Device model is blacklisted',
        status: 422,
        errorCode: 'DEV04'
      });
    }

    if (device.status !== 'Active') {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Taxpayer is not active',
        status: 422,
        errorCode: 'DEV05'
      });
    }

    res.json({
      operationID: crypto.randomBytes(30).toString('hex'),
      taxPayerName: device.taxpayer.name,
      taxPayerTIN: device.taxpayer.tin,
      vatNumber: device.taxpayer.vatNumber,
      deviceBranchName: device.taxpayer.branchName,
      deviceBranchAddress: device.taxpayer.address,
      deviceBranchContacts: device.taxpayer.contacts
    });

  } catch (err) {
    next(err);
  }
};

// 3.2 registerDevice
exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceID, activationKey, certificateRequest } = req.body;
    
    const device = await Device.findOne({ deviceID });
    if (!device) {
      return res.status(404).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Device not found',
        status: 404,
        errorCode: 'DEV01'
      });
    }

    const isValid = await device.verifyActivationKey(activationKey);
    if (!isValid) {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Invalid activation key',
        status: 422,
        errorCode: 'DEV02'
      });
    }

    // Validate CSR (simplified)
    if (!certificateRequest || !certificateRequest.includes('BEGIN CERTIFICATE REQUEST')) {
      return res.status(422).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Invalid certificate request',
        status: 422,
        errorCode: 'DEV03'
      });
    }

    // Generate certificate (simplified)
    const { certificate, validTill } = await generateCertificate(certificateRequest);
    
    // Update device with certificate
    device.certificate = certificate;
    device.certificateValidTill = validTill;
    await device.save();

    res.json({
      operationID: crypto.randomBytes(30).toString('hex'),
      certificate
    });

  } catch (err) {
    next(err);
  }
};

// 3.4 getConfig
exports.getConfig = async (req, res, next) => {
  try {
    const { deviceID } = req.params;
    
    const device = await Device.findOne({ deviceID });
    if (!device) {
      return res.status(404).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Device not found',
        status: 404,
        errorCode: 'DEV01'
      });
    }

    // Get applicable taxes (simplified)
    const applicableTaxes = await getApplicableTaxes();

    res.json({
      operationID: crypto.randomBytes(30).toString('hex'),
      taxPayerName: device.taxpayer.name,
      taxPayerTIN: device.taxpayer.tin,
      vatNumber: device.taxpayer.vatNumber,
      deviceSerialNo: device.serialNo,
      deviceBranchName: device.taxpayer.branchName,
      deviceBranchAddress: device.taxpayer.address,
      deviceBranchContacts: device.taxpayer.contacts,
      deviceOperatingMode: device.operatingMode,
      taxPayerDayMaxHrs: device.config.dayMaxHours,
      taxpayerDayEndNotificationHrs: device.config.dayEndNotificationHours,
      applicableTaxes,
      certificateValidTill: device.certificateValidTill,
      qrUrl: device.config.qrUrl
    });

  } catch (err) {
    next(err);
  }
};

// Helper function to get applicable taxes
async function getApplicableTaxes() {
  // In a real implementation, this would query a tax database
  return [
    {
      taxID: 1,
      taxPercent: 15,
      taxName: 'VAT',
      taxValidFrom: new Date('2020-01-01'),
      taxValidTill: null
    },
    {
      taxID: 2,
      taxPercent: 0,
      taxName: 'Zero Rated',
      taxValidFrom: new Date('2020-01-01'),
      taxValidTill: null
    },
    {
      taxID: 3,
      taxName: 'Exempt',
      taxValidFrom: new Date('2020-01-01'),
      taxValidTill: null
    }
  ];
}