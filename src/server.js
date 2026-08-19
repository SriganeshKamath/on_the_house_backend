const http = require('node:http');
const env = require('./config/env');
const { createApp } = require('./app');
const { createSocketServer } = require('./sockets');

function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);
  app.set('io', io);

  return { app, httpServer, io };
}


if (require.main === module) {
  const { httpServer } = createServer();

  httpServer.listen(env.PORT, () => {
    console.info(`HTTP server listening on port ${env.PORT}`);
  });
}

module.exports = { createServer };
