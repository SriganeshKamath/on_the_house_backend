const { Router } = require('express');
const { getHealth } = require('../../controllers/health-controller');

const healthRouter = Router();

healthRouter.get('/', getHealth);

module.exports = { healthRouter };
