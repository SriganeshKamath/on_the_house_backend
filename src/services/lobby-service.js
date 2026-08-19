const { Prisma } = require('@prisma/client');
const { LobbyRepository } = require('../repositories/lobby-repository');
const { generateGameCode } = require('../utils/game-code.util');
const { AppError } = require('../utils/app-error');
const {
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
} = require('../constants/http-status');

const MAX_LOBBY_PLAYERS = 100;

function toLobbyResponse(lobby) {
  const activePlayers = lobby.players.filter((p) => p.leftAt === null);

  return {
    code: lobby.code,
    status: lobby.status,
    host: {
      id: lobby.host.id,
      username: lobby.host.username,
    },
    players: activePlayers.map((p) => ({
      id: p.user.id,
      username: p.user.username,
      isHost: p.user.id === lobby.hostId,
      joinedAt: p.joinedAt,
    })),
    playerCount: activePlayers.length,
    maxPlayers: MAX_LOBBY_PLAYERS,
    settings: {
      numberCallingInterval: lobby.numberCallingInterval,
      houseToFollowCount: lobby.houseToFollowCount,
    },
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
  };
}

class LobbyService {
  constructor(lobbyRepository = new LobbyRepository()) {
    this.lobbyRepository = lobbyRepository;
  }

  async createLobby(hostUserId, settingsData = {}) {
    const { numberCallingInterval, houseToFollowCount } = settingsData;

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts += 1;
      const code = generateGameCode();

      try {
        const lobby = await this.lobbyRepository.create({
          code,
          hostId: hostUserId,
          numberCallingInterval,
          houseToFollowCount,
        });

        return toLobbyResponse(lobby);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempts < maxAttempts
        ) {
          // Unique code collision, retry loop
          continue;
        }
        throw error;
      }
    }

    throw new AppError('Unable to generate unique game code. Please try again.', BAD_REQUEST);
  }

  async getLobbyByCode(code) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    return toLobbyResponse(lobby);
  }

  async joinLobby(code, userId) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    if (lobby.status !== 'WAITING') {
      throw new AppError('Lobby is no longer accepting new players.', CONFLICT);
    }

    const activePlayers = lobby.players.filter((p) => p.leftAt === null);

    if (activePlayers.some((p) => p.userId === userId)) {
      throw new AppError('User is already an active participant in this lobby.', CONFLICT);
    }

    if (activePlayers.length >= MAX_LOBBY_PLAYERS) {
      throw new AppError('Lobby has reached maximum player capacity.', CONFLICT);
    }

    await this.lobbyRepository.addOrReactivatePlayer(lobby.id, userId);

    const updatedLobby = await this.lobbyRepository.findById(lobby.id);
    return toLobbyResponse(updatedLobby);
  }

  async leaveLobby(code, userId) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    const activeParticipant = lobby.players.find(
      (p) => p.userId === userId && p.leftAt === null,
    );

    if (!activeParticipant) {
      throw new AppError('User is not an active participant in this lobby.', BAD_REQUEST);
    }

    if (userId === lobby.hostId) {
      // Host leaves before game start -> mark host left and cancel lobby
      await this.lobbyRepository.updatePlayerLeft(lobby.id, userId);
      const cancelledLobby = await this.lobbyRepository.updateStatus(lobby.id, 'CANCELLED');
      return toLobbyResponse(cancelledLobby);
    }

    await this.lobbyRepository.updatePlayerLeft(lobby.id, userId);
    const updatedLobby = await this.lobbyRepository.findById(lobby.id);
    return toLobbyResponse(updatedLobby);
  }

  async updateSettings(code, hostUserId, settingsData) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    if (lobby.hostId !== hostUserId) {
      throw new AppError('Only the host can modify lobby settings.', FORBIDDEN);
    }

    if (lobby.status !== 'WAITING') {
      throw new AppError('Lobby settings can only be modified while in WAITING status.', CONFLICT);
    }

    const activePlayersCount = lobby.players.filter((p) => p.leftAt === null).length;

    if (settingsData.houseToFollowCount !== undefined) {
      const maxH2F = activePlayersCount - 1;
      if (settingsData.houseToFollowCount > maxH2F) {
        throw new AppError(
          `House to follow count cannot exceed active players minus 1 (maximum allowed: ${maxH2F}).`,
          BAD_REQUEST,
        );
      }
    }

    const updateData = {};
    if (settingsData.numberCallingInterval !== undefined) {
      updateData.numberCallingInterval = settingsData.numberCallingInterval;
    }
    if (settingsData.houseToFollowCount !== undefined) {
      updateData.houseToFollowCount = settingsData.houseToFollowCount;
    }

    const updatedLobby = await this.lobbyRepository.updateSettings(lobby.id, updateData);
    return toLobbyResponse(updatedLobby);
  }
}

module.exports = { LobbyService, toLobbyResponse, MAX_LOBBY_PLAYERS };
