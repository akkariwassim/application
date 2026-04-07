'use strict';

const mongoose = require('mongoose');
const winston = require('winston');

/**
 * Configure MongoDB connection using Mongoose.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    winston.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle unexpected closure
    mongoose.connection.on('error', (err) => {
      winston.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      winston.warn('MongoDB disconnected');
    });

  } catch (error) {
    winston.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
