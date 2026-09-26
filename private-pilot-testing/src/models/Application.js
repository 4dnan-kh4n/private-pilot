const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  shareToken: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  age: { type: Number, required: true, min: 16, max: 100 },
  accountNumber: { type: String, required: true, minlength: 6, maxlength: 18 },
  hireReason: { type: String, default: "", maxlength: 500 }
}, { timestamps: true });

module.exports = mongoose.models.Application || mongoose.model("Application", applicationSchema);
