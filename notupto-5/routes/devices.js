// routes/devices.js
// GET    /api/devices           — public
// GET    /api/devices/:id       — public
// POST   /api/devices           — editor+
// PUT    /api/devices/:id       — editor+
// DELETE /api/devices/:id       — editor+
// POST   /api/devices/seed      — editor+ (migrates hardcoded devices once)

const express  = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireEditor } = require('../middleware/auth');

const router = express.Router();

// ─── SCHEMA ──────────────────────────────────────────────────────────────────
const specSchema = new mongoose.Schema({
  feature:      { type: String, default: '' },
  claim:        { type: String, default: '' },
  real:         { type: String, default: '' },
  exaggeration: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  brand:           { type: String, required: true, trim: true },
  emoji:           { type: String, default: '📱' },
  category:        { type: String, default: 'Smartphone' },
  truthScore:      { type: Number, min: 0, max: 100, required: true },
  buyLink:         { type: String, default: 'https://example.com/buy-device' },
  specs:           { type: [specSchema], default: [] },
  specialFeatures: { type: [String], default: [] },
  createdBy:       { type: String, default: 'system' },
  updatedBy:       { type: String, default: 'system' },
}, { timestamps: true });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);

// ─── HARDCODED SEED DATA (mirrors the original frontend static array) ─────────
const SEED_DEVICES = [
  { name:"Galaxy S25 Ultra", brand:"Samsung", emoji:"📱", category:"Smartphone", truthScore:44, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Display Brightness",claim:"Up to 2600 nits",real:"~900 nits sustained (APL 100%)",exaggeration:"high"},{feature:"AI Processing",claim:"Up to 14× faster AI",real:"~2.1× real-world improvement",exaggeration:"high"},{feature:"Camera Resolution",claim:"200MP sensor",real:"~12MP effective output (pixel binning)",exaggeration:"high"},{feature:"Battery Life",claim:"Up to 27hrs video",real:"~19hrs mixed use",exaggeration:"medium"},{feature:"Charging Speed",claim:"Up to 45W fast charge",real:"~34W average",exaggeration:"medium"}]},
  { name:"iPhone 16 Pro Max", brand:"Apple", emoji:"🍎", category:"Smartphone", truthScore:58, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Brightness",claim:"Up to 2000 nits outdoor",real:"~1100 nits sustained",exaggeration:"medium"},{feature:"A18 Pro Performance",claim:"Up to 2× faster GPU",real:"~35% real-world gain",exaggeration:"medium"},{feature:"Battery",claim:"Up to 33hrs video",real:"~22hrs mixed use",exaggeration:"medium"},{feature:"Camera",claim:"4K 120fps ProRes",real:"Accurate — with storage caveat",exaggeration:"low"}]},
  { name:"MacBook Pro M4", brand:"Apple", emoji:"💻", category:"Laptop", truthScore:67, buyLink:"https://example.com/buy-device",
    specs:[{feature:"CPU Performance",claim:"Up to 3× faster than M1",real:"~1.9× sustained (thermals)",exaggeration:"medium"},{feature:"Battery Life",claim:"Up to 24hrs",real:"~17hrs typical workload",exaggeration:"medium"},{feature:"Unified Memory BW",claim:"Up to 120 GB/s",real:"~118 GB/s (mostly accurate)",exaggeration:"low"},{feature:"Neural Engine",claim:"Up to 38 TOPS",real:"Measured at 38 TOPS — accurate",exaggeration:"low"}]},
  { name:"Pixel 9 Pro XL", brand:"Google", emoji:"🔵", category:"Smartphone", truthScore:62, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Brightness",claim:"Up to 3000 nits",real:"~1400 nits sustained",exaggeration:"high"},{feature:"Tensor G4 AI",claim:"Up to 20× faster AI tasks",real:"~4× vs Tensor G3",exaggeration:"high"},{feature:"Battery",claim:"Up to 30hrs",real:"~23hrs mixed use",exaggeration:"medium"},{feature:"Camera Video",claim:"4K Zoom with no quality loss",real:"Slight softening at 8× zoom",exaggeration:"low"}]},
  { name:"ROG Phone 8 Pro", brand:"ASUS", emoji:"🎮", category:"Smartphone", truthScore:39, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Display Refresh",claim:"165Hz AMOLED",real:"165Hz — accurate",exaggeration:"low"},{feature:"Cooling",claim:"Up to 70% cooler gaming",real:"~18% temp reduction vs prior gen",exaggeration:"high"},{feature:"Battery",claim:"Up to 65W Ultra-fast",real:"Accurate in spec, ~48W average",exaggeration:"medium"},{feature:"Performance Boost",claim:"Up to 8% faster than Snapdragon 8 Gen 2",real:"~3% in real workloads",exaggeration:"high"}]},
  { name:"Surface Pro 11", brand:"Microsoft", emoji:"🪟", category:"Tablet", truthScore:55, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Battery Life",claim:"Up to 14hrs",real:"~10hrs typical",exaggeration:"medium"},{feature:"AI Performance",claim:"Up to 45 TOPS NPU",real:"Accurate — 45 TOPS verified",exaggeration:"low"},{feature:"Display",claim:"Up to 600 nits",real:"~580 nits sustained — mostly accurate",exaggeration:"low"},{feature:"Performance vs Core Ultra 5",claim:"Up to 90% faster",real:"~22% in sustained workloads",exaggeration:"high"}]},
  { name:"Xperia 1 VI", brand:"Sony", emoji:"🎵", category:"Smartphone", truthScore:70, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Camera Zoom",claim:"Optical 85-170mm equivalent",real:"Accurate range, verified",exaggeration:"low"},{feature:"Display Brightness",claim:"Up to 2000 nits",real:"~950 nits sustained",exaggeration:"medium"},{feature:"Battery",claim:"Up to 35hrs video",real:"~26hrs video streaming",exaggeration:"medium"},{feature:"Audio",claim:"Up to 360 Reality Audio",real:"Requires subscription, limited content",exaggeration:"low"}]},
  { name:"OnePlus 13", brand:"OnePlus", emoji:"⚡", category:"Smartphone", truthScore:48, buyLink:"https://example.com/buy-device",
    specs:[{feature:"Charging",claim:"100W SUPERVOOC",real:"Accurate — 0–100% in ~26min",exaggeration:"low"},{feature:"Brightness",claim:"Up to 4500 nits peak",real:"~1800 nits sustained",exaggeration:"high"},{feature:"Gaming Performance",claim:"Up to 50% cooler",real:"~12% temp reduction measured",exaggeration:"high"},{feature:"Camera",claim:"Hasselblad Master Edition",real:"Tuning only — hardware is standard",exaggeration:"medium"}]}
];

// ─── GET /api/devices ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: 1 });
    return res.status(200).json({ devices });
  } catch (err) {
    console.error('[GET /api/devices]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── GET /api/devices/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found.' });
    return res.status(200).json({ device });
  } catch (err) {
    console.error('[GET /api/devices/:id]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/devices/seed ───────────────────────────────────────────────────
// Migrates the hardcoded static devices into the DB.
// Safe to call multiple times — skips devices that already exist by name+brand.
router.post('/seed', requireAuth, requireEditor, async (req, res) => {
  try {
    const existing = await Device.find({}, 'name brand');
    const existingKeys = new Set(existing.map(d => d.name + '|' + d.brand));
    const toInsert = SEED_DEVICES.filter(d => !existingKeys.has(d.name + '|' + d.brand));

    if (!toInsert.length) {
      return res.status(200).json({ success: true, inserted: 0, message: 'All seed devices already exist.' });
    }

    const docs = toInsert.map(d => ({ ...d, createdBy: req.user.username, updatedBy: req.user.username }));
    await Device.insertMany(docs);

    return res.status(201).json({ success: true, inserted: docs.length });
  } catch (err) {
    console.error('[POST /api/devices/seed]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/devices ────────────────────────────────────────────────────────
router.post('/', requireAuth, requireEditor, async (req, res) => {
  try {
    const { name, brand, emoji, category, truthScore, buyLink, specs, specialFeatures } = req.body;

    if (!name || !brand) return res.status(400).json({ error: 'name and brand are required.' });
    const score = Number(truthScore);
    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'truthScore must be 0–100.' });
    }

    const device = await Device.create({
      name: name.trim(), brand: brand.trim(),
      emoji: emoji || '📱', category: category || 'Smartphone',
      truthScore: score,
      buyLink: buyLink || 'https://example.com/buy-device',
      specs:           Array.isArray(specs)           ? specs           : [],
      specialFeatures: Array.isArray(specialFeatures) ? specialFeatures : [],
      createdBy: req.user.username, updatedBy: req.user.username,
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
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found.' });

    const { name, brand, emoji, category, truthScore, buyLink, specs, specialFeatures } = req.body;
    if (name      !== undefined) device.name      = name.trim();
    if (brand     !== undefined) device.brand     = brand.trim();
    if (emoji     !== undefined) device.emoji     = emoji;
    if (category  !== undefined) device.category  = category;
    if (truthScore !== undefined) {
      const score = Number(truthScore);
      if (isNaN(score) || score < 0 || score > 100) return res.status(400).json({ error: 'truthScore must be 0–100.' });
      device.truthScore = score;
    }
    if (buyLink   !== undefined) device.buyLink   = buyLink;
    if (Array.isArray(specs))           device.specs           = specs;
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
