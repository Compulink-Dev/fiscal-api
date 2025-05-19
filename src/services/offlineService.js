const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Receipt = require('../models/Receipt');
const Device = require('../models/Device');
const ZimraApiService = require('./zimraApiService');

class OfflineService {
  static async generateOfflineFile(deviceId, fiscalDayNo) {
    const device = await Device.findById(deviceId);
    if (!device) throw new Error('Device not found');

    const receipts = await Receipt.find({
      device: deviceId,
      fiscalDayNo,
      status: 'Pending'
    }).sort({ counter: 1 });

    if (receipts.length === 0) {
      throw new Error('No pending receipts for this fiscal day');
    }

    const fileContent = {
      header: {
        deviceID: device.deviceId,
        fiscalDayNo,
        fiscalDayOpened: device.currentFiscalDay.openedAt,
        fileSequence: 1
      },
      content: {
        receipts: receipts.map(r => this.formatReceiptForFile(r))
      }
    };

    // If closing fiscal day, add footer
    if (device.currentFiscalDay.status === 'CloseInitiated') {
      const counters = await this.calculateFiscalCounters(deviceId, fiscalDayNo);
      
      fileContent.footer = {
        fiscalDayCounters: counters,
        fiscalDayDeviceSignature: await this.generateFiscalDaySignature(device, counters),
        receiptCounter: receipts.length,
        fiscalDayClosed: new Date()
      };
    }

    const filePath = path.join(__dirname, '../temp', `offline_${deviceId}_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(fileContent));

    return {
      filePath,
      fileContent
    };
  }

  static formatReceiptForFile(receipt) {
    return {
      receiptType: receipt.receiptType,
      receiptCurrency: receipt.currency,
      receiptCounter: receipt.counter,
      receiptGlobalNo: receipt.globalNo,
      invoiceNo: receipt.invoiceNo,
      receiptDate: receipt.date,
      receiptLinesTaxInclusive: receipt.linesTaxInclusive,
      receiptLines: receipt.lines.map(line => ({
        receiptLineType: line.lineType,
        receiptLineNo: line.lineNo,
        receiptLineHSCode: line.hsCode,
        receiptLineName: line.name,
        receiptLinePrice: line.price,
        receiptLineQuantity: line.quantity,
        receiptLineTotal: line.total,
        taxCode: line.taxCode,
        taxPercent: line.taxPercent,
        taxID: line.taxId
      })),
      receiptTaxes: receipt.taxes.map(tax => ({
        taxCode: tax.taxCode,
        taxPercent: tax.taxPercent,
        taxID: tax.taxId,
        taxAmount: tax.taxAmount,
        salesAmountWithTax: tax.salesAmountWithTax
      })),
      receiptPayments: receipt.payments.map(payment => ({
        moneyTypeCode: payment.moneyTypeCode,
        paymentAmount: payment.paymentAmount
      })),
      receiptTotal: receipt.total,
      receiptPrintForm: receipt.printForm,
      receiptDeviceSignature: receipt.deviceSignature
    };
  }

  static async processOfflineFile(filePath) {
    const fileContent = JSON.parse(fs.readFileSync(filePath));
    const device = await Device.findOne({ deviceId: fileContent.header.deviceID });

    if (!device) {
      throw new Error('Device not found');
    }

    const zimraService = new ZimraApiService(device);
    const response = await zimraService.submitFile(fileContent);

    // Update receipts status
    if (fileContent.content?.receipts) {
      const receiptGlobalNos = fileContent.content.receipts.map(r => r.receiptGlobalNo);
      await Receipt.updateMany(
        { device: device._id, globalNo: { $in: receiptGlobalNos } },
        { $set: { status: 'Submitted' } }
      );
    }

    // Update fiscal day status if footer exists
    if (fileContent.footer) {
      device.currentFiscalDay.status = 'Closed';
      device.currentFiscalDay.closedAt = new Date(fileContent.footer.fiscalDayClosed);
      await device.save();
    }

    return response;
  }

  static async syncOfflineReceipts(deviceId) {
    const device = await Device.findById(deviceId);
    if (!device) throw new Error('Device not found');

    // Find all pending receipts for the device
    const pendingReceipts = await Receipt.find({
      device: deviceId,
      status: 'Pending',
      fiscalDayNo: device.currentFiscalDay.number
    });

    if (pendingReceipts.length === 0) return { message: 'No pending receipts to sync' };

    // Group receipts by fiscal day
    const receiptsByDay = pendingReceipts.reduce((acc, receipt) => {
      if (!acc[receipt.fiscalDayNo]) {
        acc[receipt.fiscalDayNo] = [];
      }
      acc[receipt.fiscalDayNo].push(receipt);
      return acc;
    }, {});

    // Process each fiscal day's receipts
    for (const [fiscalDayNo, receipts] of Object.entries(receiptsByDay)) {
      try {
        const { filePath } = await this.generateOfflineFile(deviceId, fiscalDayNo);
        await this.processOfflineFile(filePath);
        fs.unlinkSync(filePath); // Clean up
      } catch (error) {
        console.error(`Error syncing fiscal day ${fiscalDayNo}:`, error);
        throw error;
      }
    }

    return { message: 'Offline receipts synced successfully' };
  }
}

module.exports = OfflineService;