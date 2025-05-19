const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  deviceId: { type: Number, required: true },
  serialNumber: { type: String, required: true },
  modelName: { type: String, required: true },
  modelVersion: { type: String },
  branchName: { type: String },
  branchAddress: {
    province: String,
    city: String,
    street: String,
    houseNo: String
  },
  operatingMode: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
  certificate: { type: String },
  certificateValidTill: { type: Date },
  isActive: { type: Boolean, default: true },
  currentFiscalDay: {
    number: { type: Number },
    status: { type: String, enum: ['Opened', 'Closed', 'CloseInitiated', 'CloseFailed'], default: 'Closed' },
    openedAt: { type: Date },
    closedAt: { type: Date }
  },
  lastReceiptGlobalNo: { type: Number, default: 0 }
});

module.exports = mongoose.model('Device', DeviceSchema);