const { Server } = require('socket.io');
const { getCorsOptions } = require('../config/cors');
const { socketAuthMiddleware } = require('./socket-auth.middleware');
const { registerLobbyHandlers } = require('./lobby-socket.handler');

let ioInstance = null;

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: getCorsOptions(),
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket);
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

module.exports = { createSocketServer, getIO };
