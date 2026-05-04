// models/GuestAcceptance.js
// Tracks T&C acceptance for non-logged-in users by IP.

const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  ip:           { type: String, required: true },
  acceptedAt:   { type: Date, default: Date.now },
  userAgent:    { type: String, default: '' }
}, { timestamps: false });

// One record per IP — upsert on accept
guestSchema.index({ ip: 1 }, { unique: true });

module.exports = mongoose.models.GuestAcceptance || mongoose.model('GuestAcceptance', guestSchema);
