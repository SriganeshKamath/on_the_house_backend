const { prisma } = require('../config/prisma');
const { GameRepository } = require('../repositories/game-repository');
const { LobbyRepository, LOBBY_INCLUDE } = require('../repositories/lobby-repository');
const { TicketService } = require('./ticket-service');
const { AppError } = require('../utils/app-error');
const {
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
} = require('../constants/http-status');

function toGameResponse(game, requestingUserId) {
  const requestingPlayer = game.players.find((p) => p.userId === requestingUserId);

  let myTicket = null;
  if (requestingPlayer && requestingPlayer.ticket) {
    myTicket = {
      id: requestingPlayer.ticket.id,
      numbers: requestingPlayer.ticket.numbers.map((n) => ({
        row: n.row,
        column: n.column,
        number: n.number,
        marked: n.marked,
      })),
    };
  }

  return {
    id: game.id,
    lobbyCode: game.lobby ? game.lobby.code : undefined,
    status: game.status,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    settings: game.settings
      ? {
          numberCallingInterval: game.settings.numberCallingInterval,
          houseToFollowCount: game.settings.houseToFollowCount,
        }
      : null,
    players: game.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.user.username,
      status: p.status,
      score: p.score,
    })),
    myTicket,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

class GameService {
  constructor(
    gameRepository = new GameRepository(),
    lobbyRepository = new LobbyRepository(),
    ticketService = new TicketService(),
  ) {
    this.gameRepository = gameRepository;
    this.lobbyRepository = lobbyRepository;
    this.ticketService = ticketService;
  }

  async startGame(code, hostUserId) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    if (lobby.hostId !== hostUserId) {
      throw new AppError('Only the host can start the game.', FORBIDDEN);
    }

    if (lobby.status === 'IN_PROGRESS') {
      const existingGame = await this.gameRepository.findByLobbyId(lobby.id);
      if (existingGame) {
        return {
          game: toGameResponse(existingGame, hostUserId),
          lobbyId: lobby.id,
          isAlreadyStarted: true,
        };
      }
    }

    if (lobby.status !== 'WAITING') {
      throw new AppError('Lobby is not in WAITING status.', CONFLICT);
    }

    const activePlayers = lobby.players.filter((p) => p.leftAt === null);

    if (!activePlayers.some((p) => p.userId === hostUserId)) {
      throw new AppError('Host must be an active participant to start the game.', BAD_REQUEST);
    }

    if (activePlayers.length < 2) {
      throw new AppError('At least 2 active players are required to start the game.', BAD_REQUEST);
    }

    const interval = lobby.numberCallingInterval ?? 10;
    if (interval < 5 || interval > 30) {
      throw new AppError('Number calling interval must be between 5 and 30 seconds.', BAD_REQUEST);
    }

    const h2f = lobby.houseToFollowCount ?? 1;
    const maxH2F = activePlayers.length - 1;
    if (h2f < 1 || h2f > maxH2F) {
      throw new AppError(
        `House to follow count must be between 1 and active players minus 1 (maximum allowed: ${maxH2F}).`,
        BAD_REQUEST,
      );
    }

    const gameResult = await prisma.$transaction(async (tx) => {
      const lockedLobby = await tx.lobby.findUnique({
        where: { id: lobby.id },
        include: LOBBY_INCLUDE,
      });

      if (!lockedLobby || lockedLobby.status !== 'WAITING') {
        throw new AppError('Lobby is no longer in WAITING status.', CONFLICT);
      }

      await tx.lobby.update({
        where: { id: lobby.id },
        data: { status: 'STARTING' },
      });

      const activeUserIds = activePlayers.map((p) => p.userId);

      const game = await this.gameRepository.createGameWithPlayersAndSettings(tx, {
        lobbyId: lobby.id,
        numberCallingInterval: interval,
        houseToFollowCount: h2f,
        userIds: activeUserIds,
      });

      for (const player of game.players) {
        await this.ticketService.createTicketForPlayer(tx, player.id);
      }

      const startedGame = await this.gameRepository.updateStatus(tx, game.id, 'IN_PROGRESS', {
        startedAt: new Date(),
      });

      await tx.lobby.update({
        where: { id: lobby.id },
        data: { status: 'IN_PROGRESS' },
      });

      return startedGame;
    });

    // Re-fetch fully populated game with relations & lobby code
    const finalGame = await this.gameRepository.findById(gameResult.id);

    return {
      game: toGameResponse(finalGame, hostUserId),
      lobbyId: lobby.id,
      isAlreadyStarted: false,
    };
  }

  async getGameByLobbyCode(code, requestingUserId) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);

    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }

    const game = await this.gameRepository.findByLobbyId(lobby.id);

    if (!game) {
      throw new AppError('Game has not been started for this lobby.', NOT_FOUND);
    }

    return toGameResponse(game, requestingUserId);
  }
}

module.exports = { GameService, toGameResponse };
