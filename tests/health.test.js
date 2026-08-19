const http = require('node:http');
const { createApp } = require('../src/app');

let server;

afterEach(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    server = undefined;
  }
});

describe('GET /api/v1/health', () => {
  it('returns the service health status', async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
