const { Router } = require('express');
const { healthRouter } = require('./v1/health-routes');
const { authRouter } = require('./v1/auth-routes');

const apiRouter = Router();

apiRouter.use('/v1/health', healthRouter);
apiRouter.use('/v1/auth', authRouter);

module.exports = { apiRouter };
