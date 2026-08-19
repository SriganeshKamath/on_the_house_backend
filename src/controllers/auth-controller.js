const { AuthService } = require('../services/auth-service');

const authService = new AuthService();

async function register(request, response, next) {
  try {
    const user = await authService.register(request.validatedBody);
    response.status(201).json({ data: { user } });
  } catch (error) {
    next(error);
  }
}

async function login(request, response, next) {
  try {
    const session = await authService.login(request.validatedBody);
    response.status(200).json({ data: session });
  } catch (error) {
    next(error);
  }
}

async function getCurrentUser(request, response, next) {
  try {
    const user = await authService.getCurrentUser(request.user.id);
    response.status(200).json({ data: { user } });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getCurrentUser };
