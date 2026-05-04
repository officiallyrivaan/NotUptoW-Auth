// models/User.js

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const SALT_ROUNDS = 12;

// Roles in ascending order of privilege
// 'user'      — read only (default)
// 'editor'    — can add/edit/delete devices
// 'moderator' — can add/edit/delete devices
// 'owner'     — everything + permissions page (PERMANENT, username === 'owner')
const VALID_ROLES      = ['owner', 'moderator', 'editor', 'user'];
const EDITOR_ROLES     = ['owner', 'moderator', 'editor']; // can mutate devices
const ASSIGNABLE_ROLES = ['moderator', 'editor', 'user'];  // owner cannot be assigned via API

const userSchema = new mongoose.Schema(
  {
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
    },

    passwordHash: {
      type:     String,
      required: true,
      select:   false
    },

    role: {
      type:    String,
      enum:    VALID_ROLES,
      default: 'user'
    },

    termsAccepted: {
      type:    Boolean,
      default: false
    },

    createdAt: {
      type:      Date,
      default:   Date.now,
      immutable: true
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// ── CRITICAL: enforce owner role whenever username === 'owner' ────────────────
// Runs on every save. Prevents any code path from changing the owner's role.
userSchema.pre('save', function (next) {
  if (this.username === 'owner') {
    this.role = 'owner'; // always reset — cannot be overridden
  }
  next();
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

// Expose role constants to routes
userSchema.statics.VALID_ROLES      = VALID_ROLES;
userSchema.statics.EDITOR_ROLES     = EDITOR_ROLES;
userSchema.statics.ASSIGNABLE_ROLES = ASSIGNABLE_ROLES;

// Helper: resolve correct role for a username (enforces owner rule at read time too)
userSchema.statics.resolveRole = function (username, storedRole) {
  if (username === 'owner') return 'owner';
  return storedRole || 'user';
};

module.exports = mongoose.model('User', userSchema);
