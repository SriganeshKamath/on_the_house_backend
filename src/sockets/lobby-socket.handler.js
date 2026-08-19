const { LobbyRepository } = require('../repositories/lobby-repository');
const { toLobbyResponse } = require('../services/lobby-service');
const { codeParamSchema } = require('../validators/lobby-validator');

const lobbyRepository = new LobbyRepository();

function registerLobbyHandlers(io, socket) {
  socket.on('lobby:subscribe', async (payload, callback) => {
    try {
      const parsed = codeParamSchema.safeParse(payload);
      if (!parsed.success) {
        const errPayload = { error: { message: 'Invalid game code payload.' } };
        if (typeof callback === 'function') callback(errPayload);
        socket.emit('lobby:error', errPayload);
        return;
      }

      const { code } = parsed.data;
      const lobby = await lobbyRepository.findByCode(code);

      if (!lobby) {
        const errPayload = { error: { message: 'Lobby not found.' } };
        if (typeof callback === 'function') callback(errPayload);
        socket.emit('lobby:error', errPayload);
        return;
      }

      const activeParticipant = lobby.players.find(
        (p) => p.userId === socket.user.id && p.leftAt === null,
      );

      if (!activeParticipant) {
        const errPayload = { error: { message: 'Not an active member of this lobby.' } };
        if (typeof callback === 'function') callback(errPayload);
        socket.emit('lobby:error', errPayload);
        return;
      }

      const roomName = `lobby:${lobby.id}`;
      socket.join(roomName);

      const lobbyResponse = toLobbyResponse(lobby);
      const statePayload = { lobby: lobbyResponse };

      if (typeof callback === 'function') callback({ data: statePayload });
      socket.emit('lobby:state', statePayload);
    } catch (error) {
      const errPayload = { error: { message: 'Failed to subscribe to lobby.' } };
      if (typeof callback === 'function') callback(errPayload);
      socket.emit('lobby:error', errPayload);
    }
  });

  socket.on('lobby:unsubscribe', async (payload) => {
    try {
      const parsed = codeParamSchema.safeParse(payload);
      if (!parsed.success) return;

      const lobby = await lobbyRepository.findByCode(parsed.data.code);
      if (lobby) {
        socket.leave(`lobby:${lobby.id}`);
      }
    } catch (_err) {
      // Ignore unsubscribe failures
    }
  });
}

module.exports = { registerLobbyHandlers };
