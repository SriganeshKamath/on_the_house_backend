const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { io: ioClient } = require('socket.io-client');
const { createApp } = require('../src/app');
const { createSocketServer } = require('../src/sockets');
const { prisma } = require('../src/config/prisma');
const { createAccessToken } = require('../src/utils/jwt');

let httpServer;
let ioServer;
let baseUrl;

const createdUserIds = [];
const createdLobbyIds = [];

async function createTestUser() {
  const uniqueId = randomUUID().replaceAll('-', '').slice(0, 10);
  const user = await prisma.user.create({
    data: {
      username: `s_${uniqueId}`,
      email: `s_${uniqueId}@test.local`,
      passwordHash: 'not-a-real-hash',
    },
  });
  createdUserIds.push(user.id);
  const token = createAccessToken(user.id);
  return { user, token };
}

async function apiRequest(path, method = 'GET', body = null, token = null) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const responseBody = await response.json();
  return { status: response.status, body: responseBody };
}

function connectSocket(token = null) {
  const options = {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  };
  if (token) {
    options.auth = { token };
  }
  return ioClient(baseUrl, options);
}

beforeAll(async () => {
  const app = createApp();
  httpServer = http.createServer(app);
  ioServer = createSocketServer(httpServer);
  app.set('io', ioServer);

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  if (createdLobbyIds.length > 0) {
    await prisma.lobbyPlayer.deleteMany({ where: { lobbyId: { in: createdLobbyIds } } });
    await prisma.lobby.deleteMany({ where: { id: { in: createdLobbyIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
  await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
});

describe('Real-Time Lobby Layer (Socket.IO)', () => {
  describe('Socket Authentication', () => {
    it('accepts connection for an authenticated socket', async () => {
      const { token } = await createTestUser();
      const client = connectSocket(token);

      await new Promise((resolve, reject) => {
        client.on('connect', resolve);
        client.on('connect_error', reject);
      });

      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it('rejects unauthenticated socket connections', async () => {
      const client = connectSocket(null);

      const error = await new Promise((resolve) => {
        client.on('connect_error', resolve);
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Authentication required.');
      client.disconnect();
    });

    it('rejects socket connections with invalid JWT signature', async () => {
      const client = connectSocket('invalid-jwt-token-string');

      const error = await new Promise((resolve) => {
        client.on('connect_error', resolve);
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Authentication required.');
      client.disconnect();
    });
  });

  describe('Lobby Subscriptions & Room Isolation', () => {
    it('allows an active lobby member to subscribe and receive initial lobby:state', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const client = connectSocket(hostToken);
      await new Promise((resolve) => client.on('connect', resolve));

      const statePromise = new Promise((resolve) => {
        client.on('lobby:state', resolve);
      });

      client.emit('lobby:subscribe', { code });
      const statePayload = await statePromise;

      expect(statePayload.lobby).toBeDefined();
      expect(statePayload.lobby.code).toBe(code);
      expect(statePayload.lobby.status).toBe('WAITING');

      client.disconnect();
    });

    it('rejects subscription for a non-member user', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: outsiderToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const outsiderClient = connectSocket(outsiderToken);
      await new Promise((resolve) => outsiderClient.on('connect', resolve));

      const errorPromise = new Promise((resolve) => {
        outsiderClient.on('lobby:error', resolve);
      });

      outsiderClient.emit('lobby:subscribe', { code });
      const errPayload = await errorPromise;

      expect(errPayload.error.message).toContain('Not an active member');
      outsiderClient.disconnect();
    });
  });

  describe('Real-Time Event Broadcasting', () => {
    it('broadcasts lobby:player-joined when a new player joins via REST', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: player, token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const hostSocket = connectSocket(hostToken);
      await new Promise((resolve) => hostSocket.on('connect', resolve));

      await new Promise((resolve) => {
        hostSocket.emit('lobby:subscribe', { code }, resolve);
      });

      const joinedEventPromise = new Promise((resolve) => {
        hostSocket.on('lobby:player-joined', resolve);
      });

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);
      const joinedPayload = await joinedEventPromise;

      expect(joinedPayload.lobby.playerCount).toBe(2);
      expect(joinedPayload.lobby.players.some((p) => p.id === player.id)).toBe(true);

      hostSocket.disconnect();
    });

    it('broadcasts lobby:player-left when a player leaves via REST', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: player, token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const hostSocket = connectSocket(hostToken);
      await new Promise((resolve) => hostSocket.on('connect', resolve));
      await new Promise((resolve) => hostSocket.emit('lobby:subscribe', { code }, resolve));

      const leftEventPromise = new Promise((resolve) => {
        hostSocket.on('lobby:player-left', resolve);
      });

      await apiRequest(`/api/v1/lobbies/${code}/leave`, 'POST', {}, playerToken);
      const leftPayload = await leftEventPromise;

      expect(leftPayload.lobby.playerCount).toBe(1);
      expect(leftPayload.lobby.players.some((p) => p.id === player.id)).toBe(false);

      hostSocket.disconnect();
    });

    it('broadcasts lobby:cancelled when host leaves while in WAITING status', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const playerSocket = connectSocket(playerToken);
      await new Promise((resolve) => playerSocket.on('connect', resolve));
      await new Promise((resolve) => playerSocket.emit('lobby:subscribe', { code }, resolve));

      const cancelledEventPromise = new Promise((resolve) => {
        playerSocket.on('lobby:cancelled', resolve);
      });

      await apiRequest(`/api/v1/lobbies/${code}/leave`, 'POST', {}, hostToken);
      const cancelledPayload = await cancelledEventPromise;

      expect(cancelledPayload.lobby.status).toBe('CANCELLED');

      playerSocket.disconnect();
    });

    it('broadcasts lobby:settings-updated when host modifies settings', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const playerSocket = connectSocket(playerToken);
      await new Promise((resolve) => playerSocket.on('connect', resolve));
      await new Promise((resolve) => playerSocket.emit('lobby:subscribe', { code }, resolve));

      const settingsEventPromise = new Promise((resolve) => {
        playerSocket.on('lobby:settings-updated', resolve);
      });

      await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 20 },
        hostToken,
      );

      const settingsPayload = await settingsEventPromise;
      expect(settingsPayload.lobby.settings.numberCallingInterval).toBe(20);

      playerSocket.disconnect();
    });
  });

  describe('Disconnect & Reconnection Policy', () => {
    it('does not destroy DB membership on socket disconnect and restores state on reconnect', async () => {
      const { user: player, token: playerToken } = await createTestUser();
      const { token: hostToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      // Connect socket
      let socket1 = connectSocket(playerToken);
      await new Promise((resolve) => socket1.on('connect', resolve));

      // Simulate network drop
      socket1.disconnect();

      // Verify DB membership is STILL ACTIVE
      const activeMemberCount = await prisma.lobbyPlayer.count({
        where: { lobbyId: dbLobby.id, userId: player.id, leftAt: null },
      });
      expect(activeMemberCount).toBe(1);

      // Reconnect socket and subscribe
      const socket2 = connectSocket(playerToken);
      await new Promise((resolve) => socket2.on('connect', resolve));

      const resubscribePromise = new Promise((resolve) => {
        socket2.on('lobby:state', resolve);
      });

      socket2.emit('lobby:subscribe', { code });
      const reconnectedState = await resubscribePromise;

      expect(reconnectedState.lobby.code).toBe(code);
      expect(reconnectedState.lobby.players.some((p) => p.id === player.id)).toBe(true);

      socket2.disconnect();
    });
  });
});
