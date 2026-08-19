const jwt = require('jsonwebtoken');
const env = require('../config/env');

function createAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

  if (typeof payload !== 'object' || payload === null || typeof payload.sub !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token payload.');
  }

  return payload;
}

module.exports = { createAccessToken, verifyAccessToken };
