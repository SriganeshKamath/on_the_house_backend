const { GameService } = require('../services/game-service');
const { getIO } = require('../sockets');
const { emitGameStarted } = require('../sockets/socket-emitter');

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

    if (!isAlreadyStarted) {
      const io = getSocketServer(request);
      emitGameStarted(io, lobbyId, game);
    }

    response.status(isAlreadyStarted ? 200 : 201).json({ data: { game } });
  } catch (error) {
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
