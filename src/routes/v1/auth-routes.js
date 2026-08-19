const { Router } = require('express');
const { register, login, getCurrentUser } = require('../../controllers/auth-controller');
const { authenticate } = require('../../middleware/authenticate');
const { validateBody } = require('../../validators/request-validator');
const { registerSchema, loginSchema } = require('../../validators/auth-validator');

const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.get('/me', authenticate, getCurrentUser);

module.exports = { authRouter };
