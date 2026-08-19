const { AppError } = require('../utils/app-error');
const { BAD_REQUEST } = require('../constants/http-status');

function validateBody(schema) {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.body);

    if (!parsed.success) {
      next(new AppError('Invalid request.', BAD_REQUEST));
      return;
    }

    request.validatedBody = parsed.data;
    next();
  };
}

module.exports = { validateBody };
