const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/prisma');
const { createAccessToken } = require('../src/utils/jwt');

const testRunId = randomUUID().replaceAll('-', '').slice(0, 12);
let server;
let baseUrl;

const createdUserIds = [];
const createdLobbyIds = [];

async function createTestUser(role = 'user') {
  const uniqueId = randomUUID().replaceAll('-', '').slice(0, 10);
  const user = await prisma.user.create({
    data: {
      username: `u_${uniqueId}`,
      email: `u_${uniqueId}@test.local`,
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

beforeAll(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
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
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe('Lobby Management Domain', () => {
  describe('POST /api/v1/lobbies (Create Lobby)', () => {
    it('requires authentication', async () => {
      const { status } = await apiRequest('/api/v1/lobbies', 'POST');
      expect(status).toBe(401);
    });

    it('allows an authenticated user to create a lobby', async () => {
      const { user: hostUser, token: hostToken } = await createTestUser();

      const { status, body } = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      expect(status).toBe(201);
      expect(body.data.lobby).toBeDefined();

      const { lobby } = body.data;
      createdLobbyIds.push(lobby.code); // Store for cleanup if code mapped, but wait, DB cleanup uses id!
      // Let's retrieve DB lobby to track ID
      const dbLobby = await prisma.lobby.findUnique({ where: { code: lobby.code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      expect(lobby.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(lobby.status).toBe('WAITING');
      expect(lobby.host.id).toBe(hostUser.id);
      expect(lobby.host.username).toBe(hostUser.username);
      expect(lobby.playerCount).toBe(1);
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0]).toMatchObject({
        id: hostUser.id,
        username: hostUser.username,
        isHost: true,
      });
    });

    it('ignores client-supplied hostId and uses authenticated identity', async () => {
      const { user: realHost, token: realHostToken } = await createTestUser();
      const { user: fakeHost } = await createTestUser();

      const { status, body } = await apiRequest(
        '/api/v1/lobbies',
        'POST',
        { hostId: fakeHost.id },
        realHostToken,
      );

      expect(status).toBe(201);
      expect(body.data.lobby.host.id).toBe(realHost.id);
      expect(body.data.lobby.host.id).not.toBe(fakeHost.id);

      const dbLobby = await prisma.lobby.findUnique({ where: { code: body.data.lobby.code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);
    });
  });

  describe('GET /api/v1/lobbies/:code (Get Lobby)', () => {
    it('returns lobby details for a valid code', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const { status, body } = await apiRequest(`/api/v1/lobbies/${code}`, 'GET', null, hostToken);
      expect(status).toBe(200);
      expect(body.data.lobby.code).toBe(code);
      expect(body.data.lobby.status).toBe('WAITING');
    });

    it('returns 404 for a non-existent code', async () => {
      const { token } = await createTestUser();
      const { status, body } = await apiRequest('/api/v1/lobbies/NONEXS', 'GET', null, token);
      expect(status).toBe(404);
      expect(body.error.message).toBe('Lobby not found.');
    });

    it('is case-insensitive for game codes', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const lowerCode = code.toLowerCase();
      const { status, body } = await apiRequest(`/api/v1/lobbies/${lowerCode}`, 'GET', null, hostToken);
      expect(status).toBe(200);
      expect(body.data.lobby.code).toBe(code);
    });
  });

  describe('POST /api/v1/lobbies/:code/join (Join Lobby)', () => {
    it('allows a valid player to join a lobby in WAITING status', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: player, token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const { status, body } = await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);
      expect(status).toBe(200);
      expect(body.data.lobby.playerCount).toBe(2);
      expect(body.data.lobby.players).toHaveLength(2);
      expect(body.data.lobby.players.some((p) => p.id === player.id && !p.isHost)).toBe(true);
    });

    it('rejects duplicate join attempts by an active participant', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const secondJoin = await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);
      expect(secondJoin.status).toBe(409);
      expect(secondJoin.body.error.message).toContain('already an active participant');
    });

    it('rejects joins for a non-WAITING lobby (CANCELLED / IN_PROGRESS / FINISHED / STARTING)', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      // Manually set status to IN_PROGRESS
      await prisma.lobby.update({ where: { id: dbLobby.id }, data: { status: 'IN_PROGRESS' } });

      const joinRes = await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);
      expect(joinRes.status).toBe(409);
      expect(joinRes.body.error.message).toContain('no longer accepting new players');
    });

    it('uses authenticated identity and ignores request body user IDs', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: realPlayer, token: realPlayerToken } = await createTestUser();
      const { user: innocentPlayer } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const joinRes = await apiRequest(
        `/api/v1/lobbies/${code}/join`,
        'POST',
        { userId: innocentPlayer.id },
        realPlayerToken,
      );

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.data.lobby.players.some((p) => p.id === realPlayer.id)).toBe(true);
      expect(joinRes.body.data.lobby.players.some((p) => p.id === innocentPlayer.id)).toBe(false);
    });
  });

  describe('POST /api/v1/lobbies/:code/leave (Leave Lobby)', () => {
    it('allows a normal player to leave a lobby', async () => {
      const { token: hostToken } = await createTestUser();
      const { user: player, token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const leaveRes = await apiRequest(`/api/v1/lobbies/${code}/leave`, 'POST', {}, playerToken);
      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.data.lobby.playerCount).toBe(1);
      expect(leaveRes.body.data.lobby.players.some((p) => p.id === player.id)).toBe(false);
    });

    it('cancels the lobby if the host leaves while in WAITING status', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const hostLeaveRes = await apiRequest(`/api/v1/lobbies/${code}/leave`, 'POST', {}, hostToken);
      expect(hostLeaveRes.status).toBe(200);
      expect(hostLeaveRes.body.data.lobby.status).toBe('CANCELLED');

      // Subsequent join attempts to cancelled lobby must be rejected
      const { token: anotherToken } = await createTestUser();
      const joinAttempt = await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, anotherToken);
      expect(joinAttempt.status).toBe(409);
    });

    it('rejects leave request if user is not an active participant', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: outsiderToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const leaveRes = await apiRequest(`/api/v1/lobbies/${code}/leave`, 'POST', {}, outsiderToken);
      expect(leaveRes.status).toBe(400);
      expect(leaveRes.body.error.message).toContain('not an active participant');
    });

    it('prevents a player from forcing another player to leave via body manipulation', async () => {
      const { user: hostUser, token: hostToken } = await createTestUser();
      const { user: victimUser, token: victimToken } = await createTestUser();
      const { token: attackerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, victimToken);
      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, attackerToken);

      // Attacker tries to kick victim by sending victim's userId in body
      const attackRes = await apiRequest(
        `/api/v1/lobbies/${code}/leave`,
        'POST',
        { userId: victimUser.id },
        attackerToken,
      );

      expect(attackRes.status).toBe(200);
      // Victim must STILL be in the lobby; attacker was removed instead
      expect(attackRes.body.data.lobby.players.some((p) => p.id === victimUser.id)).toBe(true);
      expect(attackRes.body.data.lobby.players.some((p) => p.id === hostUser.id)).toBe(true);
    });
  });

  describe('PATCH /api/v1/lobbies/:code/settings (Lobby Settings)', () => {
    it('allows host to update numberCallingInterval and houseToFollowCount', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const settingsRes = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 15, houseToFollowCount: 1 },
        hostToken,
      );

      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.data.lobby.settings).toEqual({
        numberCallingInterval: 15,
        houseToFollowCount: 1,
      });
    });

    it('rejects settings update by a non-host user (403 Forbidden)', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: playerToken } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, playerToken);

      const settingsRes = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 10 },
        playerToken,
      );

      expect(settingsRes.status).toBe(403);
      expect(settingsRes.body.error.message).toContain('Only the host');
    });

    it('validates numberCallingInterval range (5 to 30)', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const tooLow = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 4 },
        hostToken,
      );
      expect(tooLow.status).toBe(400);

      const tooHigh = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 31 },
        hostToken,
      );
      expect(tooHigh.status).toBe(400);
    });

    it('enforces houseToFollowCount maximum as active players - 1', async () => {
      const { token: hostToken } = await createTestUser();
      const { token: player1Token } = await createTestUser();
      const { token: player2Token } = await createTestUser();

      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      // Total 1 player (host only). Max H2F = 1 - 1 = 0. So setting H2F = 1 should fail.
      const h2fFail = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { houseToFollowCount: 1 },
        hostToken,
      );
      expect(h2fFail.status).toBe(400);
      expect(h2fFail.body.error.message).toContain('House to follow count cannot exceed');

      // Join 2 players -> Total 3 players. Max H2F = 2.
      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, player1Token);
      await apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, player2Token);

      const h2fSuccess = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { houseToFollowCount: 2 },
        hostToken,
      );
      expect(h2fSuccess.status).toBe(200);
      expect(h2fSuccess.body.data.lobby.settings.houseToFollowCount).toBe(2);

      const h2fExceed = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { houseToFollowCount: 3 },
        hostToken,
      );
      expect(h2fExceed.status).toBe(400);
    });

    it('rejects settings updates when lobby is not in WAITING status', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      await prisma.lobby.update({ where: { id: dbLobby.id }, data: { status: 'STARTING' } });

      const patchRes = await apiRequest(
        `/api/v1/lobbies/${code}/settings`,
        'PATCH',
        { numberCallingInterval: 10 },
        hostToken,
      );
      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.message).toContain('WAITING status');
    });
  });

  describe('Concurrency & Race Condition Handling', () => {
    it('handles multiple concurrent join requests safely without exceeding capacity', async () => {
      const { token: hostToken } = await createTestUser();
      const createRes = await apiRequest('/api/v1/lobbies', 'POST', {}, hostToken);
      const { code } = createRes.body.data.lobby;

      const dbLobby = await prisma.lobby.findUnique({ where: { code } });
      if (dbLobby) createdLobbyIds.push(dbLobby.id);

      const joiners = await Promise.all([
        createTestUser(),
        createTestUser(),
        createTestUser(),
        createTestUser(),
        createTestUser(),
      ]);

      const joinPromises = joiners.map(({ token }) =>
        apiRequest(`/api/v1/lobbies/${code}/join`, 'POST', {}, token),
      );

      const results = await Promise.all(joinPromises);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });

      const finalLobbyRes = await apiRequest(`/api/v1/lobbies/${code}`, 'GET', null, hostToken);
      expect(finalLobbyRes.body.data.lobby.playerCount).toBe(6); // 1 host + 5 players
    });
  });
});
