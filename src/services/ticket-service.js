const { generateTicket } = require('../game/ticket/ticket-generator');
const { validateTicket } = require('../evaluation/ticket/ticket-validator');
const { AppError } = require('../utils/app-error');
const { INTERNAL_SERVER_ERROR } = require('../constants/http-status');

class TicketService {
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
}

module.exports = { TicketService };
