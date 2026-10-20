const mongoose = require('mongoose');

// One document per identifier ("mobile:9876543210" or "email:a@b.com").
// Only a keyed hash of the code is stored, never the code itself.
const OtpSchema = new mongoose.Schema({
  key:         { type: String, required: true, unique: true },
  mode:        { type: String, enum: ['mobile', 'email'], required: true },
  codeHash:    { type: String, required: true },
  expiresAt:   { type: Date, required: true },          // OTP validity (5 min)
  attempts:    { type: Number, default: 0 },            // wrong tries for current code
  sendCount:   { type: Number, default: 0 },            // sends in current hour window
  windowStart: { type: Date, required: true },
  lastSentAt:  { type: Date, required: true },
  purgeAt:     { type: Date, required: true }           // TTL cleanup, after the send window ends
});
OtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', OtpSchema);
