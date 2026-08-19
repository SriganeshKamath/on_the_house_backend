const { LobbyService } = require('../services/lobby-service');

const lobbyService = new LobbyService();

async function createLobby(request, response, next) {
  try {
    const lobby = await lobbyService.createLobby(request.user.id, request.validatedBody);
    response.status(201).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function getLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const lobby = await lobbyService.getLobbyByCode(code);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function joinLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const lobby = await lobbyService.joinLobby(code, request.user.id);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function leaveLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const lobby = await lobbyService.leaveLobby(code, request.user.id);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function updateSettings(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const lobby = await lobbyService.updateSettings(code, request.user.id, request.validatedBody);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLobby,
  getLobby,
  joinLobby,
  leaveLobby,
  updateSettings,
};
