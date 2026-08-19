module.exports = {
  test: {
    globals: true,
    env: {
      JWT_SECRET: 'test-only-jwt-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      BCRYPT_SALT_ROUNDS: '10',
    },
  },
};
