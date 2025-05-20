// models/Tracking.js
const mongoose = require('mongoose');

const TrackingSchema = new mongoose.Schema({
    fiscalCounters: {
        type: Object,
        default: {}
    },
    previousHash: {
        type: String,
        default: ''
    },
    lastReceiptGlobalNo: {
        type: Number,
        default: 104
    },
    lastReceiptCounter: {
        type: Number,
        default: 22
    },
    previousReceiptDate: {
        type: String,
        default: '2024-11-13T19:18:00'
    }
});

module.exports = mongoose.model('Tracking', TrackingSchema);