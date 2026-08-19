const { NumberCaller } = require('../game/engine/number-caller');
const { CalledNumberRepository } = require('../repositories/called-number-repository');
const { GameRepository } = require('../repositories/game-repository');

class NumberCallingService {
  constructor(
    gameRepository = new GameRepository(),
    calledNumberRepository = new CalledNumberRepository(),
    socketEmitter = null
  ) {
    this.gameRepository = gameRepository;
    this.calledNumberRepository = calledNumberRepository;
    this.socketEmitter = socketEmitter;
    this.activeCallers = new Map();
  }

  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  async start(gameId) {
    if (this.activeCallers.has(gameId)) {
      return; // Caller is already running for this game
    }

    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot start number caller for game in ${game.status} status`);
    }

    // Interval is stored in settings in seconds. Convert to ms.
    const intervalSeconds = game.settings?.numberCallingInterval || 10;
    const intervalMs = intervalSeconds * 1000;

    const stopCallback = (stoppedGameId) => {
      this.activeCallers.delete(stoppedGameId);
    };

    const caller = new NumberCaller(
      gameId,
      intervalMs,
      this.calledNumberRepository,
      this.gameRepository,
      this.socketEmitter,
      stopCallback
    );

    this.activeCallers.set(gameId, caller);
    caller.start();
  }

  stop(gameId) {
    const caller = this.activeCallers.get(gameId);
    if (caller) {
      caller.stop();
      this.activeCallers.delete(gameId);
    }
  }

  isRunning(gameId) {
    const caller = this.activeCallers.get(gameId);
    return caller ? caller.isRunning : false;
  }

  async getCalledNumbers(gameId) {
    return this.calledNumberRepository.findByGameId(gameId);
  }
}

// Export as a singleton so activeCallers map is shared across the app
const numberCallingService = new NumberCallingService();

module.exports = { NumberCallingService, numberCallingService };
