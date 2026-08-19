const { randomUUID } = require('node:crypto');
const { prisma } = require('../src/config/prisma');

const testId = randomUUID();
const username = `schema_${testId.replaceAll('-', '')}`;
let userId;
let lobbyId;
let gameId;

async function removeTestRecords() {
  if (!gameId) {
    return;
  }

  await prisma.prizeClaim.deleteMany({ where: { gameId } });
  await prisma.ticketNumber.deleteMany({ where: { ticket: { gamePlayer: { gameId } } } });
  await prisma.ticket.deleteMany({ where: { gamePlayer: { gameId } } });
  await prisma.calledNumber.deleteMany({ where: { gameId } });
  await prisma.gameSettings.deleteMany({ where: { gameId } });
  await prisma.gamePlayer.deleteMany({ where: { gameId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.lobbyPlayer.deleteMany({ where: { lobbyId } });
  await prisma.lobby.deleteMany({ where: { id: lobbyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

afterAll(async () => {
  await removeTestRecords();
  await prisma.$disconnect();
});

describe('Prisma domain schema', () => {
  it('persists the core relationship graph and enforces key claim constraints', async () => {
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@example.test`,
        passwordHash: 'integration-test-only-not-a-password',
      },
    });
    userId = user.id;

    const lobby = await prisma.lobby.create({
      data: {
        code: `TEST${testId.replaceAll('-', '').slice(0, 8)}`.toUpperCase(),
        hostId: user.id,
        numberCallingInterval: 10,
        houseToFollowCount: 1,
      },
    });
    lobbyId = lobby.id;

    await prisma.lobbyPlayer.create({ data: { lobbyId: lobby.id, userId: user.id } });

    const game = await prisma.game.create({
      data: {
        lobbyId: lobby.id,
        settings: { create: { numberCallingInterval: 10, houseToFollowCount: 1 } },
        players: { create: { userId: user.id } },
      },
      include: { players: true },
    });
    gameId = game.id;
    const gamePlayer = game.players[0];

    const ticket = await prisma.ticket.create({
      data: {
        gamePlayerId: gamePlayer.id,
        numbers: {
          create: [
            { row: 0, column: 0, number: 1 },
            { row: 1, column: 1, number: 12 },
            { row: 2, column: 2, number: 23 },
          ],
        },
      },
      include: { numbers: true },
    });

    await prisma.calledNumber.create({ data: { gameId: game.id, number: 1, sequence: 1 } });
    await expect(
      prisma.calledNumber.create({ data: { gameId: game.id, number: 1, sequence: 2 } }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.prizeClaim.create({
      data: { gameId: game.id, gamePlayerId: gamePlayer.id, prizeType: 'FIRST_ROW', points: 10 },
    });
    await expect(
      prisma.prizeClaim.create({
        data: { gameId: game.id, gamePlayerId: gamePlayer.id, prizeType: 'SECOND_ROW', points: 10 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const persistedGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { settings: true, players: { include: { ticket: { include: { numbers: true } } } } },
    });

    expect(persistedGame.settings).toMatchObject({ numberCallingInterval: 10, houseToFollowCount: 1 });
    expect(persistedGame.players[0].ticket.id).toBe(ticket.id);
    expect(persistedGame.players[0].ticket.numbers).toHaveLength(3);
  }, 30000);
});
