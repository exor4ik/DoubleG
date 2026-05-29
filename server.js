const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
// Критично для Render: доверяем заголовкам прокси
app.enable('trust proxy'); 

const port = process.env.PORT || 9000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
});

// 1. Внутри PeerServer путь ВСЕГДА корневой '/'
const peerServer = ExpressPeerServer(server, {
  path: '/',             // ← СТРОГО '/'
  allow_discovery: true,
  proxied: true,         // ← Обязательно для Render
  debug: true,           // Включим логи, чтобы видеть подключения в Render
});

// 2. Монтируем его на '/peerjs' в Express
app.use('/peerjs', peerServer);

// Health checks для UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'egor-peerjs' });
});
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

peerServer.on('connection', (client) => {
  console.log(`✅ Peer connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`🔌 Peer disconnected: ${client.getId()}`);
});
