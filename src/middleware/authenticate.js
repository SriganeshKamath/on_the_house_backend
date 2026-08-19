const { AppError } = require('../utils/app-error');
const { UNAUTHORIZED } = require('../constants/http-status');
const { verifyAccessToken } = require('../utils/jwt');

function authenticate(request, _response, next) {
  const authorization = request.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    next(new AppError('Authentication required.', UNAUTHORIZED));
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    next(new AppError('Authentication required.', UNAUTHORIZED));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.sub };
    next();
  } catch (_error) {
    next(new AppError('Authentication required.', UNAUTHORIZED));
  }
}

module.exports = { authenticate };
