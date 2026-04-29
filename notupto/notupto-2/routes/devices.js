// routes/devices.js
// Mounted at /api/devices in server.js
//
// GET    /api/devices           — public (all users)
// POST   /api/devices           — editor+ only
// PUT    /api/devices/:id       — editor+ only
// DELETE /api/devices/:id       — editor+ only

const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireEditor } = require('../middleware/auth');

const router = express.Router();

// ─── DEVICE MODEL ────────────────────────────────────────────────────────────
// Defined inline to keep the file count low.
// Matches the shape used in the frontend devices array.

const specSchema = new mongoose.Schema({
  feature:      { type: String, required: true },
  claim:        { type: String, required: true },
  real:         { type: String, required: true },
  exaggeration: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  brand:          { type: String, required: true, trim: true },
  emoji:          { type: String, default: '📱' },
  category:       { type: String, default: 'Smartphone' },
  truthScore:     { type: Number, min: 0, max: 100, required: true },
  buyLink:        { type: String, default: 'https://example.com/buy-device' },
  specs:          { type: [specSchema], default: [] },
  specialFeatures:{ type: [String], default: [] },
  // Track who added/edited this device
  createdBy:      { type: String },
  updatedBy:      { type: String },
}, { timestamps: true });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);

// ─── GET /api/devices ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    return res.status(200).json({ devices });
  } catch (err) {
    console.error('[GET /api/devices]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/devices ────────────────────────────────────────────────────────
router.post('/', requireAuth, requireEditor, async (req, res) => {
  try {
    const { name, brand, emoji, category, truthScore, buyLink, specs, specialFeatures } = req.body;

    if (!name || !brand || truthScore === undefined) {
      return res.status(400).json({ error: 'name, brand, and truthScore are required.' });
    }
    if (typeof truthScore !== 'number' || truthScore < 0 || truthScore > 100) {
      return res.status(400).json({ error: 'truthScore must be a number between 0 and 100.' });
    }

    const device = await Device.create({
      name:            name.trim(),
      brand:           brand.trim(),
      emoji:           emoji || '📱',
      category:        category || 'Smartphone',
      truthScore,
      buyLink:         buyLink || 'https://example.com/buy-device',
      specs:           Array.isArray(specs) ? specs : [],
      specialFeatures: Array.isArray(specialFeatures) ? specialFeatures : [],
      createdBy:       req.user.username,
      updatedBy:       req.user.username,
    });

    return res.status(201).json({ success: true, device });
  } catch (err) {
    console.error('[POST /api/devices]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── PUT /api/devices/:id ─────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    const { name, brand, emoji, category, truthScore, buyLink, specs, specialFeatures } = req.body;

    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found.' });

    if (name !== undefined)            device.name            = name.trim();
    if (brand !== undefined)           device.brand           = brand.trim();
    if (emoji !== undefined)           device.emoji           = emoji;
    if (category !== undefined)        device.category        = category;
    if (truthScore !== undefined)      device.truthScore      = truthScore;
    if (buyLink !== undefined)         device.buyLink         = buyLink;
    if (Array.isArray(specs))          device.specs           = specs;
    if (Array.isArray(specialFeatures)) device.specialFeatures = specialFeatures;
    device.updatedBy = req.user.username;

    await device.save();
    return res.status(200).json({ success: true, device });
  } catch (err) {
    console.error('[PUT /api/devices/:id]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── DELETE /api/devices/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found.' });

    await Device.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/devices/:id]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
