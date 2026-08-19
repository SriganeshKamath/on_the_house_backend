const { LobbyService } = require('../services/lobby-service');
const { getIO } = require('../sockets');
const {
  emitLobbyPlayerJoined,
  emitLobbyPlayerLeft,
  emitLobbyCancelled,
  emitLobbySettingsUpdated,
} = require('../sockets/socket-emitter');

const lobbyService = new LobbyService();

function getSocketServer(request) {
  return request.app.get('io') || getIO();
}

async function createLobby(request, response, next) {
  try {
    const { lobby } = await lobbyService.createLobby(request.user.id, request.validatedBody);
    response.status(201).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function getLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { lobby } = await lobbyService.getLobbyByCode(code);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function joinLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { lobby, lobbyId } = await lobbyService.joinLobby(code, request.user.id);
    const io = getSocketServer(request);
    emitLobbyPlayerJoined(io, lobbyId, lobby);
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function leaveLobby(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { lobby, lobbyId } = await lobbyService.leaveLobby(code, request.user.id);
    const io = getSocketServer(request);
    if (lobby.status === 'CANCELLED') {
      emitLobbyCancelled(io, lobbyId, lobby);
    } else {
      emitLobbyPlayerLeft(io, lobbyId, lobby);
    }
    response.status(200).json({ data: { lobby } });
  } catch (error) {
    next(error);
  }
}

async function updateSettings(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { lobby, lobbyId } = await lobbyService.updateSettings(
      code,
      request.user.id,
      request.validatedBody,
    );
    const io = getSocketServer(request);
    emitLobbySettingsUpdated(io, lobbyId, lobby);
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
