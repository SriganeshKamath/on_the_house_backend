const env = require('./env');

function getCorsOptions() {
  if (!env.CORS_ORIGIN && env.NODE_ENV !== 'production') {
    return { origin: true, credentials: true };
  }

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  };
}

module.exports = { getCorsOptions };
