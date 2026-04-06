'use strict';

const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Must be registered LAST on the app instance.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Sanitize body for logging (don't log passwords)
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.confirmPassword;

  logger.error(`[${req.method}] ${req.originalUrl || req.path} - Status: ${status} - Error: ${message}`, {
    stack: err.stack,
    body: Object.keys(sanitizedBody).length ? sanitizedBody : undefined,
    query: Object.keys(req.query).length ? req.query : undefined,
    params: Object.keys(req.params).length ? req.params : undefined
  });

  res.status(status).json({
    error:   message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
