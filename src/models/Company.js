const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompanySchema = new Schema({
  name: { type: String, required: true },
  tin: { type: String, required: true, unique: true },
  vatNumber: { type: String },
  address: {
    province: String,
    city: String,
    street: String,
    houseNo: String
  },
  contacts: {
    phoneNo: String,
    email: String
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', CompanySchema);