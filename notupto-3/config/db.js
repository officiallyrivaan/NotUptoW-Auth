// config/db.js
// Connects to MongoDB using the MONGO_URI from .env
// Called once at server startup. Exits the process on failure
// so you know immediately if the DB is misconfigured.

const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // These options silence deprecation warnings in mongoose 7+
      // No additional options needed — mongoose handles pooling automatically
    });

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

    // Log when connection drops so we notice in production
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1); // Hard exit — app can't run without a DB
  }
}

module.exports = connectDB;
