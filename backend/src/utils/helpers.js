'use strict';

/**
 * General utility helpers
 */

/**
 * Parse an integer from a string, returning a default if invalid.
 */
function safeInt(val, defaultVal = 0) {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Pick only specified keys from an object.
 */
function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    if (k in obj) acc[k] = obj[k];
    return acc;
  }, {});
}

/**
 * Convert camelCase keys to snake_case (shallow).
 */
function toSnakeCase(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      v
    ])
  );
}

/**
 * Return a sanitised error message (never expose internal details in production).
 */
function safeErrorMessage(err, fallback = 'Internal server error') {
  if (process.env.NODE_ENV !== 'production') return err.message || fallback;
  return fallback;
}

module.exports = { safeInt, pick, toSnakeCase, safeErrorMessage };
