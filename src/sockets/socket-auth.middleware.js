const { verifyAccessToken } = require('../utils/jwt');

function socketAuthMiddleware(socket, next) {
  const tokenFromAuthObj = socket.handshake.auth ? socket.handshake.auth.token : null;
  const authHeader = socket.handshake.headers ? socket.handshake.headers.authorization : null;

  let token = tokenFromAuthObj;

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  }

  if (!token) {
    const error = new Error('Authentication required.');
    error.data = { statusCode: 401 };
    next(error);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    socket.user = { id: payload.sub };
    next();
  } catch (_err) {
    const error = new Error('Authentication required.');
    error.data = { statusCode: 401 };
    next(error);
  }
}

module.exports = { socketAuthMiddleware };
