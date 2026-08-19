const { Router } = require('express');
const { healthRouter } = require('./v1/health-routes');
const { authRouter } = require('./v1/auth-routes');
const { lobbyRouter } = require('./v1/lobby-routes');

const apiRouter = Router();

apiRouter.use('/v1/health', healthRouter);
apiRouter.use('/v1/auth', authRouter);
apiRouter.use('/v1/lobbies', lobbyRouter);

module.exports = { apiRouter };

