const crypto = require('node:crypto');

// Exclude easily confused characters like O, 0, I, 1, L
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateGameCode(length = 6) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

module.exports = { generateGameCode };
