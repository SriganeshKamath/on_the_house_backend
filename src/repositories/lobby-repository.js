const { prisma } = require('../config/prisma');

const LOBBY_INCLUDE = Object.freeze({
  host: {
    select: {
      id: true,
      username: true,
    },
  },
  players: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  },
});

class LobbyRepository {
  async create({ code, hostId, numberCallingInterval, houseToFollowCount }) {
    return prisma.$transaction(async (tx) => {
      const lobby = await tx.lobby.create({
        data: {
          code,
          hostId,
          numberCallingInterval: numberCallingInterval ?? null,
          houseToFollowCount: houseToFollowCount ?? null,
          players: {
            create: {
              userId: hostId,
            },
          },
        },
        include: LOBBY_INCLUDE,
      });

      return lobby;
    });
  }

  async findByCode(code) {
    return prisma.lobby.findUnique({
      where: { code: code.toUpperCase() },
      include: LOBBY_INCLUDE,
    });
  }

  async findById(id) {
    return prisma.lobby.findUnique({
      where: { id },
      include: LOBBY_INCLUDE,
    });
  }

  async findLobbyPlayer(lobbyId, userId) {
    return prisma.lobbyPlayer.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });
  }

  async countActivePlayers(lobbyId) {
    return prisma.lobbyPlayer.count({
      where: {
        lobbyId,
        leftAt: null,
      },
    });
  }

  async addOrReactivatePlayer(lobbyId, userId) {
    return prisma.lobbyPlayer.upsert({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
      create: {
        lobbyId,
        userId,
        joinedAt: new Date(),
        leftAt: null,
      },
      update: {
        leftAt: null,
        joinedAt: new Date(),
      },
    });
  }

  async updatePlayerLeft(lobbyId, userId) {
    return prisma.lobbyPlayer.update({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  async updateStatus(lobbyId, status) {
    return prisma.lobby.update({
      where: { id: lobbyId },
      data: { status },
      include: LOBBY_INCLUDE,
    });
  }

  async updateSettings(lobbyId, data) {
    return prisma.lobby.update({
      where: { id: lobbyId },
      data,
      include: LOBBY_INCLUDE,
    });
  }
}

module.exports = { LobbyRepository, LOBBY_INCLUDE };
