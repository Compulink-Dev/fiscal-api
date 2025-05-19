const crypto = require('crypto');
const { ZIMRA_QR_URL } = require('../config/zimra');
const Receipt = require('../models/Receipt');
const Device = require('../models/Device');

class FiscalService {
  static async generateReceiptHash(receipt) {
    const device = await Device.findById(receipt.device);
    
    const hashData = [
      device.deviceId.toString(),
      receipt.receiptType.toUpperCase(),
      receipt.currency,
      receipt.globalNo.toString(),
      receipt.date.toISOString(),
      Math.round(receipt.total * 100).toString(), // Convert to cents
      this.formatTaxesForSignature(receipt.taxes),
      receipt.previousReceiptHash || ''
    ].join('');

    return crypto.createHash('sha256').update(hashData).digest('base64');
  }

  static formatTaxesForSignature(taxes) {
    return taxes
      .sort((a, b) => a.taxId - b.taxId || (a.taxCode || '').localeCompare(b.taxCode || ''))
      .map(tax => [
        tax.taxCode || '',
        tax.taxPercent !== undefined ? tax.taxPercent.toFixed(2) : '',
        Math.round(tax.taxAmount * 100).toString(),
        Math.round(tax.salesAmountWithTax * 100).toString()
      ].join(''))
      .join('');
  }

  static async generateReceiptSignature(receipt, privateKey) {
    const hash = await this.generateReceiptHash(receipt);
    const signer = crypto.createSign('SHA256');
    signer.update(hash);
    signer.end();
    return signer.sign(privateKey, 'base64');
  }

  static generateQRCodeData(receipt, device) {
    const receiptDate = receipt.date;
    const formattedDate = [
      receiptDate.getDate().toString().padStart(2, '0'),
      (receiptDate.getMonth() + 1).toString().padStart(2, '0'),
      receiptDate.getFullYear().toString()
    ].join('');

    const deviceId = device.deviceId.toString().padStart(10, '0');
    const globalNo = receipt.globalNo.toString().padStart(10, '0');
    
    // Generate MD5 hash of device signature (first 16 chars)
    const qrData = crypto.createHash('md5')
      .update(receipt.deviceSignature.signature)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    return `${ZIMRA_QR_URL}/${deviceId}/${formattedDate}/${globalNo}/${qrData}`;
  }

  static async processReceiptValidation(receipt) {
    const validationErrors = [];
    
    // Implement validation rules according to ZIMRA specs
    // Example validations:
    
    // RCPT010 - Currency validation
    if (!this.isValidCurrency(receipt.currency)) {
      validationErrors.push({
        code: 'RCPT010',
        message: 'Invalid currency code',
        severity: 'Red'
      });
    }
    
    // RCPT011 - Receipt counter sequence
    const prevReceipt = await Receipt.findOne({ 
      device: receipt.device,
      fiscalDayNo: receipt.fiscalDayNo
    }).sort({ counter: -1 });
    
    if (prevReceipt && receipt.counter !== prevReceipt.counter + 1) {
      validationErrors.push({
        code: 'RCPT011',
        message: 'Receipt counter is not sequential',
        severity: 'Red'
      });
    }
    
    // Add more validations as needed
    
    return validationErrors;
  }

  static isValidCurrency(currency) {
    // Implement actual currency validation
    return /^[A-Z]{3}$/.test(currency);
  }
}

module.exports = FiscalService;