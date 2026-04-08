'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Configure MongoDB connection using Mongoose.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle unexpected events after connection
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

  } catch (error) {
    logger.error('CRITICAL: Error connecting to MongoDB!');
    logger.error(`Message: ${error.message}`);
    logger.error(`Connection URI: ${process.env.MONGODB_URI ? 'Defined' : 'UNDEFINED'}`);
    process.exit(1);
  }
};

module.exports = connectDB;
