const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  description: { type: String, required: true },
  debit: { type: Number },
  credit: { type: Number },
  balance: { type: Number },
  bank: { type: String },
  sourceFile: { type: String },
  fileHash: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
