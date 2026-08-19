const { Server } = require('socket.io');
const { getCorsOptions } = require('../config/cors');

function createSocketServer(httpServer) {
  return new Server(httpServer, {
    cors: getCorsOptions(),
  });
}

module.exports = { createSocketServer };
