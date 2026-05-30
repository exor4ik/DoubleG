const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Render работает за reverse proxy
app.enable('trust proxy');

// CORS обязателен для кросс-доменного WebSocket handshake
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health-check для Render
app.get('/', (req, res) => {
  res.json({ status: 'PeerJS OK', time: new Date().toISOString() });
});

// === PeerServer ===
// path задаём ЗДЕСЬ. app.use(peerServer) — БЕЗ префикса, иначе пути разойдутся.
const peerServer = ExpressPeerServer(server, {
  path: '/myapp',
  proxied: true,
  debug: true,
  alive_timeout: 120000,
});

app.use(peerServer);

// Логирование (после peerServer, чтобы ловить и его запросы)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} — ${req.ip || 'unknown'}`);
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
