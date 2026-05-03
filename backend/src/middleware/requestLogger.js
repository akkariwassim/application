'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Middleware to add a unique request ID to each request
 * and log the incoming request details.
 */
function requestLogger(req, res, next) {
  req.id = uuidv4();
  const start = Date.now();

  // Log request start
  logger.info(`[REQ] ${req.id} - ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response finish to log duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[RES] ${req.id} - ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
