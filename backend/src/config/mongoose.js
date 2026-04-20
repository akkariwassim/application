'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Configure MongoDB connection using Mongoose.
 */
const connectDB = async () => {
  const options = {
    serverSelectionTimeoutMS: 5000,
    autoIndex: true,
    maxPoolSize: 10,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('❌ CRITICAL: Error connecting to MongoDB!');
    logger.error(`Message: ${error.message}`);
    // Don't exit immediately, let mongoose handle initial connection retries if configured
    // but here we want to fail fast on start if URI is wrong.
    throw error; 
  }

  // ── Connection Event Listeners ────────────────────────────────
  mongoose.connection.on('error', (err) => {
    logger.error(`[MongoDB Error]: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected.');
  });
};

module.exports = connectDB;
