const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
// 🚨 КРИТИЧНО для Render: доверяем прокси, иначе WebSocket не установится
app.enable('trust proxy'); 

const port = process.env.PORT || 9000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
});

// ✅ ПРАВИЛЬНЫЙ СПОСОБ: указываем путь ВНУТРИ PeerServer и монтируем в КОРЕНЬ '/'
const peerServer = ExpressPeerServer(server, {
  path: '/peerjs', 
  allow_discovery: true,
  proxied: true, // Обязательно для Render/Heroku
});

app.use('/', peerServer); // Монтируем в корень, ничего не обрезая!

// Health check для UptimeRobot
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
