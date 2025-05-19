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

  // ... (previous code)

  static async calculateFiscalCounters(deviceId, fiscalDayNo) {
    const receipts = await Receipt.find({
      device: deviceId,
      fiscalDayNo
    });

    const counters = {
      byTax: {},       // For tax-based counters
      byMoneyType: {}  // For payment method counters
    };

    receipts.forEach(receipt => {
      // Process tax-based counters
      receipt.taxes.forEach(tax => {
        const taxKey = `${tax.taxId}_${tax.taxPercent || 'exempt'}_${receipt.currency}`;
        
        if (!counters.byTax[taxKey]) {
          counters.byTax[taxKey] = {
            taxId: tax.taxId,
            taxPercent: tax.taxPercent,
            currency: receipt.currency,
            saleAmount: 0,
            saleTaxAmount: 0,
            creditNoteAmount: 0,
            creditNoteTaxAmount: 0,
            debitNoteAmount: 0,
            debitNoteTaxAmount: 0
          };
        }

        const counter = counters.byTax[taxKey];
        
        switch (receipt.receiptType) {
          case 'FiscalInvoice':
            counter.saleAmount += tax.salesAmountWithTax;
            counter.saleTaxAmount += tax.taxAmount;
            break;
          case 'CreditNote':
            counter.creditNoteAmount += tax.salesAmountWithTax;
            counter.creditNoteTaxAmount += tax.taxAmount;
            break;
          case 'DebitNote':
            counter.debitNoteAmount += tax.salesAmountWithTax;
            counter.debitNoteTaxAmount += tax.taxAmount;
            break;
        }
      });

      // Process payment method counters
      receipt.payments.forEach(payment => {
        const paymentKey = `${payment.moneyTypeCode}_${receipt.currency}`;
        
        if (!counters.byMoneyType[paymentKey]) {
          counters.byMoneyType[paymentKey] = {
            moneyType: payment.moneyTypeCode,
            currency: receipt.currency,
            amount: 0
          };
        }
        
        counters.byMoneyType[paymentKey].amount += payment.paymentAmount;
      });
    });

    // Convert to ZIMRA expected format
    const zimraCounters = [];

    // Add tax-based counters
    Object.values(counters.byTax).forEach(counter => {
      if (counter.saleAmount !== 0 || counter.saleTaxAmount !== 0) {
        zimraCounters.push({
          fiscalCounterType: 'SaleByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.saleAmount
        });

        zimraCounters.push({
          fiscalCounterType: 'SaleTaxByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.saleTaxAmount
        });
      }

      if (counter.creditNoteAmount !== 0 || counter.creditNoteTaxAmount !== 0) {
        zimraCounters.push({
          fiscalCounterType: 'CreditNoteByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.creditNoteAmount
        });

        zimraCounters.push({
          fiscalCounterType: 'CreditNoteTaxByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.creditNoteTaxAmount
        });
      }

      if (counter.debitNoteAmount !== 0 || counter.debitNoteTaxAmount !== 0) {
        zimraCounters.push({
          fiscalCounterType: 'DebitNoteByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.debitNoteAmount
        });

        zimraCounters.push({
          fiscalCounterType: 'DebitNoteTaxByTax',
          fiscalCounterCurrency: counter.currency,
          fiscalCounterTaxID: counter.taxId,
          fiscalCounterTaxPercent: counter.taxPercent,
          fiscalCounterValue: counter.debitNoteTaxAmount
        });
      }
    });

    // Add payment method counters
    Object.values(counters.byMoneyType).forEach(counter => {
      zimraCounters.push({
        fiscalCounterType: 'BalanceByMoneyType',
        fiscalCounterCurrency: counter.currency,
        fiscalCounterMoneyType: counter.moneyType,
        fiscalCounterValue: counter.amount
      });
    });

    return zimraCounters;
  }

  static async generateFiscalDaySignature(device, counters) {
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

    return {
      hash,
      signature
    };
  }

  static async validateFiscalDayClosure(deviceId, fiscalDayNo) {
    const receipts = await Receipt.find({
      device: deviceId,
      fiscalDayNo
    });

    // Check for validation errors that would prevent closure
    const hasRedErrors = receipts.some(r => 
      r.validationErrors.some(e => e.severity === 'Red')
    );

    const hasGreyErrors = receipts.some(r => 
      r.validationErrors.some(e => e.severity === 'Grey')
    );

    if (hasRedErrors) {
      throw new Error('Cannot close fiscal day with "Red" validation errors');
    }

    if (hasGreyErrors) {
      throw new Error('Cannot close fiscal day with "Grey" validation errors (missing previous receipts)');
    }

    // Verify receipt sequence
    const receiptCounters = receipts.map(r => r.counter).sort((a, b) => a - b);
    for (let i = 0; i < receiptCounters.length; i++) {
      if (receiptCounters[i] !== i + 1) {
        throw new Error(`Missing receipt in sequence. Expected ${i + 1}, found ${receiptCounters[i]}`);
      }
    }

    return true;
  }
}




module.exports = FiscalService;

