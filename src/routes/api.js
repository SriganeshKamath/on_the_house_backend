const { Router } = require('express');
const { healthRouter } = require('./v1/health-routes');

const apiRouter = Router();

apiRouter.use('/v1/health', healthRouter);

module.exports = { apiRouter };
