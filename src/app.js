const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { getCorsOptions } = require('./config/cors');
const { apiRouter } = require('./routes/api');
const { notFound } = require('./middleware/not-found');
const { errorHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
