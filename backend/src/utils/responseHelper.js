'use strict';

/**
 * Standard Success Response
 */
const success = (res, data, status = 200) => {
  return res.status(status).json({
    success: true,
    data
  });
};

/**
 * Standard Error Response (for cases where next(err) is not used)
 */
const error = (res, message, status = 500, errorCode = 'INTERNAL_ERROR') => {
  return res.status(status).json({
    success: false,
    error: errorCode,
    message
  });
};

module.exports = {
  success,
  error
};
