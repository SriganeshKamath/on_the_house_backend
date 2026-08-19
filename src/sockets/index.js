const { Server } = require('socket.io');
const { getCorsOptions } = require('../config/cors');
const { socketAuthMiddleware } = require('./socket-auth.middleware');
const { registerLobbyHandlers } = require('./lobby-socket.handler');
const { registerTicketHandlers } = require('./ticket-socket.handler');

let ioInstance = null;

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: getCorsOptions(),
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    // Join a private room for the user to receive private events like ticket:marked
    socket.join(`user:${socket.user.id}`);
    
    registerLobbyHandlers(io, socket);
    registerTicketHandlers(io, socket);
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

module.exports = { createSocketServer, getIO };
