class TicketService {
  /**
   * Creates a ticket for a GamePlayer inside a Prisma transaction boundary.
   * Detailed layout logic will be expanded in the Ticket Generation phase.
   */
  async createTicketForPlayer(tx, gamePlayerId) {
    // Basic valid ticket structure: 15 unique numbers across 3 rows and 9 columns
    const initialNumbers = [
      // Row 0
      { row: 0, column: 0, number: 5 },
      { row: 0, column: 2, number: 21 },
      { row: 0, column: 4, number: 43 },
      { row: 0, column: 6, number: 62 },
      { row: 0, column: 8, number: 85 },
      // Row 1
      { row: 1, column: 1, number: 14 },
      { row: 1, column: 3, number: 36 },
      { row: 1, column: 5, number: 51 },
      { row: 1, column: 7, number: 73 },
      { row: 1, column: 8, number: 89 },
      // Row 2
      { row: 2, column: 0, number: 8 },
      { row: 2, column: 2, number: 27 },
      { row: 2, column: 4, number: 49 },
      { row: 2, column: 6, number: 68 },
      { row: 2, column: 7, number: 79 },
    ];

    const ticket = await tx.ticket.create({
      data: {
        gamePlayerId,
        numbers: {
          create: initialNumbers,
        },
      },
      include: {
        numbers: {
          orderBy: [
            { row: 'asc' },
            { column: 'asc' },
          ],
        },
      },
    });

    return ticket;
  }
}

module.exports = { TicketService };
