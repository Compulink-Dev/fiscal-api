const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReceiptLineSchema = new Schema({
  lineType: { type: String, enum: ['Sale', 'Discount'], required: true },
  lineNo: { type: Number, required: true },
  hsCode: { type: String },
  name: { type: String, required: true },
  price: { type: Number },
  quantity: { type: Number, required: true },
  total: { type: Number, required: true },
  taxCode: { type: String },
  taxPercent: { type: Number },
  taxId: { type: Number }
});

const ReceiptTaxSchema = new Schema({
  taxCode: { type: String },
  taxPercent: { type: Number },
  taxId: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  salesAmountWithTax: { type: Number, required: true }
});

const PaymentSchema = new Schema({
  moneyTypeCode: { type: String, required: true },
  paymentAmount: { type: Number, required: true }
});

const ReceiptSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  device: { type: Schema.Types.ObjectId, ref: 'Device', required: true },
  receiptType: { type: String, enum: ['FiscalInvoice', 'CreditNote', 'DebitNote'], required: true },
  currency: { type: String, required: true },
  counter: { type: Number, required: true },
  globalNo: { type: Number, required: true },
  invoiceNo: { type: String, required: true },
  date: { type: Date, required: true },
  linesTaxInclusive: { type: Boolean, required: true },
  lines: [ReceiptLineSchema],
  taxes: [ReceiptTaxSchema],
  payments: [PaymentSchema],
  total: { type: Number, required: true },
  printForm: { type: String },
  deviceSignature: {
    hash: { type: String, required: true },
    signature: { type: String, required: true }
  },
  zimraSignature: {
    receiptId: { type: String },
    serverDate: { type: Date },
    signature: { type: String }
  },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  validationErrors: [{
    code: { type: String },
    message: { type: String },
    severity: { type: String, enum: ['Grey', 'Yellow', 'Red'] }
  }],
  fiscalDayNo: { type: Number, required: true },
  previousReceiptHash: { type: String }
}, { timestamps: true });

module.exports = (connection) => {
  return connection.model('Receipt', ReceiptSchema);
};