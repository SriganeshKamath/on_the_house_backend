const { GameService } = require('../services/game-service');
const { getIO } = require('../sockets');
const { emitGameStarted, emitNumberCalled } = require('../sockets/socket-emitter');
const { numberCallingService } = require('../services/number-calling-service');

const gameService = new GameService();

function getSocketServer(request) {
  return request.app.get('io') || getIO();
}

async function startGame(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { game, lobbyId, isAlreadyStarted } = await gameService.startGame(
      code,
      request.user.id,
    );

    const io = getSocketServer(request);
    if (!isAlreadyStarted) {
      emitGameStarted(io, lobbyId, game);
    }
    
    // Ensure the caller is running for the game
    if (!numberCallingService.isRunning(game.id) && game.status === 'IN_PROGRESS') {
      numberCallingService.setSocketEmitter({
        emitNumberCalled: (gId, payload) => emitNumberCalled(io || getIO(), gId, payload),
      });
      numberCallingService.start(game.id).catch((err) => console.error('Failed to start NumberCaller:', err));
    }

    response.status(isAlreadyStarted ? 200 : 201).json({ data: { game } });
  } catch (error) {
    console.error('START GAME ERROR:', error);
    next(error);
  }

}

async function getGame(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const game = await gameService.getGameByLobbyCode(code, request.user.id);
    response.status(200).json({ data: { game } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  startGame,
  getGame,
};
