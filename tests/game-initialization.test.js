const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { io: ioClient } = require('socket.io-client');
const { createApp } = require('../src/app');
const { createSocketServer } = require('../src/sockets');
const { prisma } = require('../src/config/prisma');
const { createAccessToken } = require('../src/utils/jwt');
const { TicketService } = require('../src/services/ticket-service');

let httpServer;
let ioServer;
let baseUrl;

const createdUserIds = [];
const createdLobbyIds = [];

async function createTestUser() {
  const uniqueId = randomUUID().replaceAll('-', '').slice(0, 10);
  const user = await prisma.user.create({
    data: {
      username: `g_${uniqueId}`,
      email: `g_${uniqueId}@test.local`,
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
    const games = await prisma.game.findMany({ where: { lobbyId: { in: createdLobbyIds } } });
    const gameIds = games.map((g) => g.id);

    if (gameIds.length > 0) {
      await prisma.prizeClaim.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.ticketNumber.deleteMany({ where: { ticket: { gamePlayer: { gameId: { in: gameIds } } } } });
      await prisma.ticket.deleteMany({ where: { gamePlayer: { gameId: { in: gameIds } } } });
      await prisma.calledNumber.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.gameSettings.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.gamePlayer.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
    }

    await prisma.lobbyPlayer.deleteMany({ where: { lobbyId: { in: createdLobbyIds } } });
    await prisma.lobby.deleteMany({ where: { id: { in: createdLobbyIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
  await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
});

describe('Game Initialization Domain', () => {
  describe('POST /api/v1/lobbies/:code/start (Start Game)', () => {
    it('allows the host to start a valid lobby with 2+ active players', async () => {
      const { user: host, token: hostToken } = await createTestUser();
      const { user: player1, token: player1Token } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, player1Token);

      // Connect host socket to verify real-time game:started event
      const hostSocket = connectSocket(hostToken);
      await new Promise((resolve) => hostSocket.on('connect', resolve));
      await new Promise((resolve) => hostSocket.emit('lobby:subscribe', { code }, resolve));

      const gameStartedEventPromise = new Promise((resolve) => {
        hostSocket.on('game:started', resolve);
      });

      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(startRes.status).toBe(201);
      expect(startRes.body.data.game).toBeDefined();

      const { game } = startRes.body.data;
      expect(game.status).toBe('IN_PROGRESS');
      expect(game.players).toHaveLength(2);
      expect(game.settings).toEqual({
        numberCallingInterval: 10,
        houseToFollowCount: 1,
      });

      // Ticket privacy check: host receives host's own ticket in myTicket
      expect(game.myTicket).toBeDefined();
      expect(game.myTicket.numbers).toHaveLength(15);

      // Check DB state
      const dbGame = await prisma.game.findUnique({
        where: { lobbyId: dbLobby.id },
        include: { settings: true, players: { include: { ticket: { include: { numbers: true } } } } },
      });
      expect(dbGame.status).toBe('IN_PROGRESS');
      expect(dbGame.players).toHaveLength(2);
      expect(dbGame.players.every((p) => p.ticket !== null)).toBe(true);

      const dbUpdatedLobby = await prisma.lobby.findUnique({ where: { id: dbLobby.id } });
      expect(dbUpdatedLobby.status).toBe('IN_PROGRESS');

      // Verify real-time socket broadcast
      const eventPayload = await gameStartedEventPromise;
      expect(eventPayload.game.id).toBe(game.id);

      hostSocket.disconnect();
    });

    it('enforces ticket privacy: player ticket is not exposed to other players', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: player1, token: player1Token } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, player1Token);

      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(startRes.status).toBe(201);

      // Fetch game as Player 1 via GET /api/v1/lobbies/:code/game
      const getGameRes = await apiRequest(`/api/v1/lobbies/${code}/game`, 'GET', null, player1Token);
      expect(getGameRes.status).toBe(200);
      expect(getGameRes.body.data.game.myTicket).toBeDefined();

      // Ensure players array only exposes public player info (no private tickets embedded for all)
      const publicPlayers = getGameRes.body.data.game.players;
      publicPlayers.forEach((p) => {
        expect(p).not.toHaveProperty('ticket');
        expect(p).toHaveProperty('username');
        expect(p).toHaveProperty('score');
      });
    });

    it('rejects start attempts by non-host users (403 Forbidden)', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, playerToken);
      expect(startRes.status).toBe(403);
      expect(startRes.body.error.message).toContain('Only the host can start');
    });

    it('rejects start attempt if active players < 2', async () => {
      const { token: hostToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      // Only host is in lobby (1 player)
      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(startRes.status).toBe(400);
      expect(startRes.body.error.message).toContain('At least 2 active players');
    });

    it('rejects start attempts on non-WAITING lobbies (CANCELLED / FINISHED / STARTING)', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      // Manually set status to CANCELLED
      await prisma.lobby.update({ where: { id: dbLobby.id }, data: { status: 'CANCELLED' } });

      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(startRes.status).toBe(409);
      expect(startRes.body.error.message).toContain('WAITING status');
    });

    it('is idempotent for duplicate start requests on an already started game', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const firstStart = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(firstStart.status).toBe(201);

      const secondStart = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(secondStart.status).toBe(200); // 200 OK for idempotent second call
      expect(secondStart.body.data.game.id).toBe(firstStart.body.data.game.id);

      const gamesCount = await prisma.game.count({ where: { lobbyId: dbLobby.id } });
      expect(gamesCount).toBe(1);
    });

    it('rolls back transaction atomically if ticket generation fails', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      // Spy on TicketService to throw error
      const spy = vi.spyOn(TicketService.prototype, 'createTicketForPlayer').mockImplementationOnce(async () => {
        throw new Error('Simulated ticket generation failure.');
      });

      const startRes = await apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken);
      expect(startRes.status).toBe(500);

      spy.mockRestore();

      // Verify complete atomic rollback in PostgreSQL
      const dbGame = await prisma.game.findUnique({ where: { lobbyId: dbLobby.id } });
      expect(dbGame).toBeNull();

      const dbLobbyAfter = await prisma.lobby.findUnique({ where: { id: dbLobby.id } });
      expect(dbLobbyAfter.status).toBe('WAITING'); // Lobby returned to WAITING
    });
  });

  describe('Concurrency & Simultaneous Start Requests', () => {
    it('creates exactly one Game under simultaneous start requests', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const [res1, res2] = await Promise.all([
        apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken),
        apiRequest(`/api/v1/lobbies/${code}/start`, 'POST', {}, hostToken),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 201]);

      const gamesCount = await prisma.game.count({ where: { lobbyId: dbLobby.id } });
      expect(gamesCount).toBe(1);
    });
  });
});
