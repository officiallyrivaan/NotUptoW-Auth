// models/User.js
// The User schema. Passwords are NEVER stored here — only the bcrypt hash.
// The schema enforces uniqueness at the DB level (unique index on username)
// so even if the route-level check has a race condition, the DB will reject duplicates.

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const SALT_ROUNDS = 12; // Higher = slower to brute-force. 12 is a solid default.

const userSchema = new mongoose.Schema(
  {
    // Username: lowercase, trimmed, indexed for fast lookups
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,           // DB-level unique index
      trim:      true,
      lowercase: true,           // Store all usernames as lowercase
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, underscores, and hyphens'
      ]
    },

    // Hashed password only — plain text never touches this field
    passwordHash: {
      type:     String,
      required: true,
      select:   false  // NEVER returned in queries by default — must opt in with .select('+passwordHash')
    },

    // Useful for admin/analytics, not exposed to the client
    createdAt: {
      type:    Date,
      default: Date.now,
      immutable: true  // Can't be changed after creation
    }
  },
  {
    // Don't add updatedAt — we don't need it and it reduces attack surface
    timestamps: false,
    // Don't leak internal fields to JSON responses
    toJSON: {
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// ─── INSTANCE METHOD: verify a plain password against the stored hash ───────
// Usage: const ok = await user.comparePassword('userInputHere');
userSchema.methods.comparePassword = async function (plainPassword) {
  // passwordHash is select:false so it must be explicitly selected before calling this
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// ─── STATIC METHOD: hash a plain password ────────────────────────────────────
// Usage: const hash = await User.hashPassword('plainTextHere');
userSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

module.exports = mongoose.model('User', userSchema);
