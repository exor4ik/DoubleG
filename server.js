const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
app.enable('trust proxy'); // Критично для Render

const port = process.env.PORT || 9000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
});

const peerServer = ExpressPeerServer(server, {
  path: '/',             // Внутренний путь PeerServer — строго корень
  allow_discovery: true,
  proxied: true,         // Обязательно для прокси Render
  debug: true,
});

// 🛠️ ИСПРАВЛЕНИЕ БАГА PEERJS:
// Перехватываем WebSocket-апгрейд и переписываем URL с '/peerjs' на '/'
app.use((req, res, next) => {
  if (req.url === '/peerjs' && req.headers.upgrade === 'websocket') {
    req.url = '/';
  }
  next();
});

// Монтируем PeerServer в корень
app.use('/', peerServer);

// Health check для UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

peerServer.on('connection', (client) => {
  console.log(`✅ Peer connected: ${client.getId()}`);
});
