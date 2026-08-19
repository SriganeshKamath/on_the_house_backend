const { generateTicket } = require('../game/ticket/ticket-generator');
const { validateTicket } = require('../evaluation/ticket/ticket-validator');
const { AppError } = require('../utils/app-error');
const { INTERNAL_SERVER_ERROR, NOT_FOUND, FORBIDDEN, BAD_REQUEST } = require('../constants/http-status');
const { GameRepository } = require('../repositories/game-repository');
const { CalledNumberRepository } = require('../repositories/called-number-repository');
const { TicketRepository } = require('../repositories/ticket-repository');
const { LobbyRepository } = require('../repositories/lobby-repository');
const { emitTicketMarked } = require('../sockets/socket-emitter');

class TicketService {
  constructor(
    gameRepository = new GameRepository(),
    calledNumberRepository = new CalledNumberRepository(),
    ticketRepository = new TicketRepository(),
    lobbyRepository = new LobbyRepository()
  ) {
    this.gameRepository = gameRepository;
    this.calledNumberRepository = calledNumberRepository;
    this.ticketRepository = ticketRepository;
    this.lobbyRepository = lobbyRepository;
  }
  /**
   * Generates and validates a new 90-ball Housie ticket structure.
   */
  generateAndValidateTicket() {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts += 1;
      const ticketNumbers = generateTicket();
      const validation = validateTicket(ticketNumbers);

      if (validation.valid) {
        return ticketNumbers;
      }
    }

    throw new AppError('Failed to generate a valid ticket.', INTERNAL_SERVER_ERROR);
  }

  /**
   * Creates and persists a validated ticket for a GamePlayer inside a transaction boundary.
   */
  async createTicketForPlayer(tx, gamePlayerId) {
    const validTicketNumbers = this.generateAndValidateTicket();

    const ticket = await tx.ticket.create({
      data: {
        gamePlayerId,
      },
    });

    await tx.ticketNumber.createMany({
      data: validTicketNumbers.map((n) => ({
        ticketId: ticket.id,
        row: n.row,
        column: n.column,
        number: n.number,
        marked: false,
      })),
    });

    return tx.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        numbers: {
          orderBy: [
            { row: 'asc' },
            { column: 'asc' },
          ],
        },
      },
    });
  }

  async getTicket(code, userId) {
    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);
    
    if (!lobby) {
      throw new AppError('Lobby not found.', NOT_FOUND);
    }
    const game = await this.gameRepository.findByLobbyId(lobby.id);
    if (!game) {
      throw new AppError('Game not found.', NOT_FOUND);
    }

    const ticket = await this.ticketRepository.getTicketByGameAndUser(game.id, userId);
    if (!ticket) {
      throw new AppError('Ticket not found for this user in the specified game.', NOT_FOUND);
    }
    
    return this.mapTicketToResponse(ticket);
  }

  async markNumber(code, userId, number) {
    if (!Number.isInteger(number) || number < 1 || number > 90) {
      throw new AppError('Invalid number. Must be an integer between 1 and 90.', BAD_REQUEST);
    }

    const normalizedCode = code.trim().toUpperCase();
    const lobby = await this.lobbyRepository.findByCode(normalizedCode);
    if (!lobby) throw new AppError('Lobby not found.', NOT_FOUND);

    const game = await this.gameRepository.findByLobbyId(lobby.id);
    if (!game) throw new AppError('Game not found.', NOT_FOUND);

    if (game.status !== 'IN_PROGRESS') {
      throw new AppError('Game is not in progress.', FORBIDDEN);
    }

    const player = game.players.find((p) => p.userId === userId);
    if (!player) {
      throw new AppError('You are not a participant in this game.', FORBIDDEN);
    }
    
    if (player.status !== 'ACTIVE') {
      throw new AppError('Only active players can mark numbers.', FORBIDDEN);
    }

    const calledNumbers = await this.calledNumberRepository.findByGameId(game.id);
    const hasBeenCalled = calledNumbers.some((cn) => cn.number === number);
    if (!hasBeenCalled) {
      throw new AppError(`Number ${number} has not been called yet.`, BAD_REQUEST);
    }

    const ticket = await this.ticketRepository.getTicketByGameAndUser(game.id, userId);
    if (!ticket) {
      throw new AppError('Ticket not found.', NOT_FOUND);
    }

    const ticketNumber = ticket.numbers.find((n) => n.number === number);
    if (!ticketNumber) {
      throw new AppError(`Number ${number} is not on your ticket.`, BAD_REQUEST);
    }

    // Idempotent: return success if already marked
    if (ticketNumber.marked) {
      return { number, marked: true };
    }

    await this.ticketRepository.markTicketNumber(ticket.id, number);

    const payload = { number, marked: true };
    const { getIO } = require('../sockets');
    const io = getIO();
    if (io) {
      emitTicketMarked(io, userId, payload);
    }

    return payload;
  }

  mapTicketToResponse(ticket) {
    return {
      id: ticket.id,
      numbers: ticket.numbers.map((n) => ({
        row: n.row,
        column: n.column,
        number: n.number,
        marked: n.marked,
      })),
    };
  }
}

module.exports = { TicketService };
