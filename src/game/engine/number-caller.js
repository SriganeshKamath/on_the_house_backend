const { prisma } = require('../../config/prisma');
const { CalledNumberRepository } = require('../../repositories/called-number-repository');
const { GameRepository } = require('../../repositories/game-repository');

class NumberCaller {
  constructor(gameId, intervalMs, calledNumberRepository, gameRepository, socketEmitter, stopCallback) {
    this.gameId = gameId;
    this.intervalMs = intervalMs;
    this.calledNumberRepository = calledNumberRepository;
    this.gameRepository = gameRepository;
    this.socketEmitter = socketEmitter;
    this.stopCallback = stopCallback; // called when stopping due to completion or error
    this.timerId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  scheduleNext() {
    if (!this.isRunning) return;
    this.timerId = setTimeout(() => {
      this.executeCallOperation();
    }, this.intervalMs);
  }

  async executeCallOperation() {
    try {
      // 1. Verify game is IN_PROGRESS
      const game = await this.gameRepository.findById(this.gameId);
      if (!game || game.status !== 'IN_PROGRESS') {
        this.stop();
        if (this.stopCallback) this.stopCallback(this.gameId);
        return;
      }

      // 2. Fetch already called numbers
      const calledNumbers = await this.calledNumberRepository.findByGameId(this.gameId);
      if (calledNumbers.length >= 90) {
        this.stop();
        if (this.stopCallback) this.stopCallback(this.gameId);
        return; // All 90 numbers called
      }

      const calledSet = new Set(calledNumbers.map((cn) => cn.number));
      const availableNumbers = [];
      for (let i = 1; i <= 90; i++) {
        if (!calledSet.has(i)) {
          availableNumbers.push(i);
        }
      }

      if (availableNumbers.length === 0) {
        this.stop();
        if (this.stopCallback) this.stopCallback(this.gameId);
        return;
      }

      // 3. Select next number
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const nextNumber = availableNumbers[randomIndex];
      const nextSequence = calledNumbers.length + 1;

      // 4. Persist in transaction
      const calledRecord = await prisma.$transaction(async (tx) => {
        // Double check status in tx just to be absolutely safe (optional, but good for concurrency)
        const lockedGame = await tx.game.findUnique({ where: { id: this.gameId } });
        if (!lockedGame || lockedGame.status !== 'IN_PROGRESS') {
          throw new Error('GAME_NOT_IN_PROGRESS');
        }

        return await this.calledNumberRepository.createCalledNumber(tx, this.gameId, nextNumber, nextSequence);
      });

      // 5. Broadcast
      if (this.socketEmitter && this.socketEmitter.emitNumberCalled) {
        this.socketEmitter.emitNumberCalled(this.gameId, {
          gameId: this.gameId,
          number: calledRecord.number,
          sequence: calledRecord.sequence,
          calledAt: calledRecord.calledAt,
        });
      }

      // Schedule next
      this.scheduleNext();
    } catch (error) {
      if (error.message === 'GAME_NOT_IN_PROGRESS') {
        this.stop();
        if (this.stopCallback) this.stopCallback(this.gameId);
      } else if (error.code === 'P2002') {
        // Unique constraint violation means another process/thread called a number at this sequence.
        // We will just skip this turn and schedule the next, letting the loop retry.
        this.scheduleNext();
      } else {
        // Other errors, e.g. DB connection issues. We log and retry after interval to be resilient.
        console.error(`NumberCaller error for game ${this.gameId}:`, error);
        this.scheduleNext();
      }
    }
  }
}

module.exports = { NumberCaller };
