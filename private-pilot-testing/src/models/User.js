const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  passwordHash: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  age: { type: Number, required: true, min: 16, max: 100 },
  bankAccountNumber: { type: String, required: true, minlength: 6, maxlength: 18 },
  hireReason: { type: String, default: "", maxlength: 500 },
  strongestSkills: { type: String, default: "", maxlength: 500 },
  challengeSolved: { type: String, default: "", maxlength: 500 }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
