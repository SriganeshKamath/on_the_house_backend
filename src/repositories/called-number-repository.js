const { prisma } = require('../config/prisma');

class CalledNumberRepository {
  async findByGameId(gameId, tx = prisma) {
    return tx.calledNumber.findMany({
      where: { gameId },
      orderBy: { sequence: 'asc' },
    });
  }

  async countByGameId(gameId, tx = prisma) {
    return tx.calledNumber.count({
      where: { gameId },
    });
  }

  async createCalledNumber(tx, gameId, number, sequence) {
    return tx.calledNumber.create({
      data: {
        gameId,
        number,
        sequence,
      },
    });
  }
}

module.exports = { CalledNumberRepository };
