const bcrypt = require('bcrypt');
const { Prisma } = require('@prisma/client');
const env = require('../config/env');
const { UserRepository } = require('../repositories/user-repository');
const { AppError } = require('../utils/app-error');
const { createAccessToken } = require('../utils/jwt');
const { CONFLICT, UNAUTHORIZED } = require('../constants/http-status');

function toUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

class AuthService {
  constructor(userRepository = new UserRepository()) {
    this.userRepository = userRepository;
  }

  async register({ username, email, password }) {
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.userRepository.create({ username, email, passwordHash });
      return toUserResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Username or email is already in use.', CONFLICT);
      }

      throw error;
    }
  }

  async login({ identifier, password }) {
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier.toLowerCase())
      : await this.userRepository.findByUsername(identifier);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Invalid credentials.', UNAUTHORIZED);
    }

    return {
      token: createAccessToken(user.id),
      user: toUserResponse(user),
    };
  }

  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('Authentication required.', UNAUTHORIZED);
    }

    return toUserResponse(user);
  }
}

module.exports = { AuthService, toUserResponse };
