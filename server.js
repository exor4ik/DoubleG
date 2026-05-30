const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Render.com работает за reverse proxy — обязательно
app.enable('trust proxy');

// CORS нужен для WebSocket handshake на кросс-домене
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health-check
app.get('/', (req, res) => {
  res.json({ status: 'PeerJS OK', time: new Date().toISOString() });
});

// === PeerServer ===
// path задаём ЗДЕСЬ. app.use(peerServer) — без дополнительного префикса.
const peerServer = ExpressPeerServer(server, {
  path: '/myapp',
  proxied: true,
  debug: true,
  // Можно увеличить, если Render рвёт соединения
  alive_timeout: 120000,
});

app.use(peerServer);

// Логирование (после peerServer, чтобы ловить и его запросы тоже)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} — ${req.ip}`);
  next();
});

const port = process.env.PORT || 10000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});

// Graceful shutdown для Render
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing...');
  server.close(() => process.exit(0));
});
