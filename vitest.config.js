module.exports = {
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      JWT_SECRET: 'test-only-jwt-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      BCRYPT_SALT_ROUNDS: '10',
    },
  },
};


