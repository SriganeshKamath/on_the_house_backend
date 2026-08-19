const { prisma } = require('../config/prisma');

const GAME_INCLUDE = Object.freeze({
  settings: true,
  players: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      ticket: {
        include: {
          numbers: {
            orderBy: [
              { row: 'asc' },
              { column: 'asc' },
            ],
          },
        },
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  },
  calledNumbers: {
    orderBy: {
      sequence: 'asc',
    },
  },
  prizeClaims: {
    orderBy: {
      claimedAt: 'asc',
    },
  },
});

class GameRepository {
  async findByLobbyId(lobbyId, tx = prisma) {
    return tx.game.findUnique({
      where: { lobbyId },
      include: GAME_INCLUDE,
    });
  }

  async findById(id, tx = prisma) {
    return tx.game.findUnique({
      where: { id },
      include: GAME_INCLUDE,
    });
  }

  async createGameWithPlayersAndSettings(tx, { lobbyId, numberCallingInterval, houseToFollowCount, userIds }) {
    const game = await tx.game.create({
      data: {
        lobbyId,
        status: 'STARTING',
        settings: {
          create: {
            numberCallingInterval,
            houseToFollowCount,
          },
        },
        players: {
          create: userIds.map((userId) => ({
            userId,
            status: 'ACTIVE',
            score: 0,
          })),
        },
      },
      include: GAME_INCLUDE,
    });

    return game;
  }

  async updateStatus(tx, gameId, status, extraData = {}) {
    return tx.game.update({
      where: { id: gameId },
      data: {
        status,
        ...extraData,
      },
      include: GAME_INCLUDE,
    });
  }
}

module.exports = { GameRepository, GAME_INCLUDE };
