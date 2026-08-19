const http = require('node:http');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/prisma');

const suffix = randomUUID().replaceAll('-', '');
const password = 'secure-password-for-integration-tests';
let server;
let baseUrl;
const userIds = [];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  return { response, body: await response.json() };
}

beforeAll(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe('authentication endpoints', () => {
  it('registers, authenticates, and protects the current-user endpoint', async () => {
    const username = `auth_${suffix.slice(0, 16)}`;
    const email = `auth-${suffix}@example.test`;

    const invalidEmail = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email: 'not-an-email', password }),
    });
    expect(invalidEmail.response.status).toBe(400);

    const missingField = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
    expect(missingField.response.status).toBe(400);

    const weakPassword = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password: 'short' }),
    });
    expect(weakPassword.response.status).toBe(400);

    const registration = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email: email.toUpperCase(), password }),
    });
    expect(registration.response.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({ username, email });
    expect(registration.body.data.user).not.toHaveProperty('passwordHash');
    userIds.push(registration.body.data.user.id);

    const storedUser = await prisma.user.findUnique({ where: { id: registration.body.data.user.id } });
    expect(storedUser.passwordHash).not.toBe(password);
    await expect(bcrypt.compare(password, storedUser.passwordHash)).resolves.toBe(true);

    const duplicateEmail = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: `other_${suffix.slice(0, 16)}`, email, password }),
    });
    expect(duplicateEmail.response.status).toBe(409);

    const duplicateUsername = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email: `other-${suffix}@example.test`, password }),
    });
    expect(duplicateUsername.response.status).toBe(409);

    const login = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email.toUpperCase(), password }),
    });
    expect(login.response.status).toBe(200);
    expect(login.body.data.user).not.toHaveProperty('passwordHash');
    expect(login.body.data.token).toEqual(expect.any(String));

    const usernameLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: username, password }),
    });
    expect(usernameLogin.response.status).toBe(200);

    const tokenPayload = jwt.decode(login.body.data.token);
    expect(Object.keys(tokenPayload).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(tokenPayload.sub).toBe(registration.body.data.user.id);

    const invalidPassword = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password: 'incorrect-password-for-test' }),
    });
    const unknownUser = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: `unknown_${suffix}`, password }),
    });
    expect(invalidPassword.response.status).toBe(401);
    expect(unknownUser.response.status).toBe(401);
    expect(invalidPassword.body.error.message).toBe(unknownUser.body.error.message);

    const validMe = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${login.body.data.token}` },
    });
    expect(validMe.response.status).toBe(200);
    expect(validMe.body.data.user).toEqual(registration.body.data.user);

    const missingToken = await request('/api/v1/auth/me');
    const malformedToken = await request('/api/v1/auth/me', { headers: { authorization: 'Bearer invalid' } });
    const invalidSignature = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${jwt.sign({ sub: storedUser.id }, 'different-test-secret-at-least-32-characters')}` },
    });
    const expiredToken = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${jwt.sign({ sub: storedUser.id }, process.env.JWT_SECRET, { expiresIn: '-1s' })}` },
    });
    expect(missingToken.response.status).toBe(401);
    expect(malformedToken.response.status).toBe(401);
    expect(invalidSignature.response.status).toBe(401);
    expect(expiredToken.response.status).toBe(401);

    const deletedUser = await prisma.user.create({
      data: {
        username: `gone_${suffix.slice(0, 16)}`,
        email: `deleted-${suffix}@example.test`,
        passwordHash: 'not-used-by-this-test',
      },
    });
    const deletedUserToken = jwt.sign({ sub: deletedUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await prisma.user.delete({ where: { id: deletedUser.id } });

    const deletedUserMe = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${deletedUserToken}` },
    });
    expect(deletedUserMe.response.status).toBe(401);
  }, 30000);
});
