const { prisma } = require('../config/prisma');

class TicketRepository {
  async getTicketByGameAndUser(gameId, userId, tx = prisma) {
    return tx.ticket.findFirst({
      where: {
        gamePlayer: {
          gameId,
          userId,
        },
      },
      include: {
        gamePlayer: true,
        numbers: {
          orderBy: [
            { row: 'asc' },
            { column: 'asc' },
          ],
        },
      },
    });
  }

  async markTicketNumber(ticketId, number, tx = prisma) {
    return tx.ticketNumber.update({
      where: {
        ticketId_number: {
          ticketId,
          number,
        },
      },
      data: {
        marked: true,
      },
    });
  }
}

module.exports = { TicketRepository };
