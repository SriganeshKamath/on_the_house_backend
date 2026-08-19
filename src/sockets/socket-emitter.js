function emitLobbyPlayerJoined(io, lobbyId, lobbyResponse) {
  if (!io) return;
  io.to(`lobby:${lobbyId}`).emit('lobby:player-joined', { lobby: lobbyResponse });
}

function emitLobbyPlayerLeft(io, lobbyId, lobbyResponse) {
  if (!io) return;
  io.to(`lobby:${lobbyId}`).emit('lobby:player-left', { lobby: lobbyResponse });
}

function emitLobbyCancelled(io, lobbyId, lobbyResponse) {
  if (!io) return;
  io.to(`lobby:${lobbyId}`).emit('lobby:cancelled', { lobby: lobbyResponse });
}

function emitLobbySettingsUpdated(io, lobbyId, lobbyResponse) {
  if (!io) return;
  io.to(`lobby:${lobbyId}`).emit('lobby:settings-updated', { lobby: lobbyResponse });
}

function emitGameStarted(io, lobbyId, gameResponse) {
  if (!io) return;
  io.to(`lobby:${lobbyId}`).emit('game:started', { game: gameResponse });
}

function emitNumberCalled(io, gameId, payload) {
  if (!io) return;
  io.to(`game:${gameId}`).emit('game:number-called', payload);
}

module.exports = {
  emitLobbyPlayerJoined,
  emitLobbyPlayerLeft,
  emitLobbyCancelled,
  emitLobbySettingsUpdated,
  emitGameStarted,
  emitNumberCalled,
};

