const { AppError } = require('../utils/app-error');
const { NOT_FOUND } = require('../constants/http-status');

function notFound(request, _response, next) {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, NOT_FOUND));
}

module.exports = { notFound };
