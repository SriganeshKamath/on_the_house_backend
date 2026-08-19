const env = require('../config/env');
const { BAD_REQUEST, INTERNAL_SERVER_ERROR } = require('../constants/http-status');

function errorHandler(error, _request, response, _next) {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(BAD_REQUEST).json({ error: { message: 'Invalid JSON request body.' } });
    return;
  }

  const statusCode = error.isOperational ? error.statusCode : INTERNAL_SERVER_ERROR;
  const message = error.isOperational ? error.message : 'Internal server error.';

  if (env.NODE_ENV !== 'test' && statusCode === INTERNAL_SERVER_ERROR) {
    console.error(error);
  }

  response.status(statusCode).json({
    error: {
      message,
    },
  });
}

module.exports = { errorHandler };
