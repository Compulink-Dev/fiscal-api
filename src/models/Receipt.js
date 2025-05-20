// models/Receipt.js
const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema({
    // Define your receipt schema based on your requirements
    deviceID: String,
    receiptType: String,
    receiptCurrency: String,
    receiptGlobalNo: String,
    receiptCounter: String,
    receiptDate: Date,
    receiptTotal: Number,
    receiptTaxes: Array,
    paymentMethod: String,
    // Add other fields as needed
}, { timestamps: true });

module.exports = mongoose.model('Receipt', ReceiptSchema);