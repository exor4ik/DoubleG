const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
app.enable('trust proxy'); // Критично для Render

const port = process.env.PORT || 9000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
});

// 🎯 ГЛАВНЫЙ СЕКРЕТ: Указываем ПОЛНЫЙ путь, который формирует клиент
const peerServer = ExpressPeerServer(server, {
  path: '/peer/peerjs',  // <--- Сервер принимает и HTTP, и WS на этом пути
  allow_discovery: true,
  proxied: true,
  debug: true,
});

// Монтируем в корень, так как '/peer/peerjs' уже зашит внутрь peerServer
app.use('/', peerServer);

// Health check
app.get('/', (req, res) => {
  res.send('🚀 Egor PeerJS Server is running!');
});

peerServer.on('connection', (client) => {
  console.log(`✅ Peer connected: ${client.getId()}`);
});
