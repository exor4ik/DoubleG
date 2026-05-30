const express = require('express');
const { ExpressPeerServer } = require('peer');
const app = express();

app.enable('trust proxy');

const port = parseInt(process.env.PORT) || 9000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 PeerJS Server on port ${port}`);
});

// Health check для Render
app.get('/', (req, res) => res.send('PeerJS OK'));

const peerServer = ExpressPeerServer(server, {
  path: '/peer/',   // ← БЕЗ 'peerjs' в конце! key добавится сам
  proxied: true,
  debug: true,
});

app.use('/', peerServer);

peerServer.on('connection', (c) => console.log(`✅ ${c.getId()}`));
peerServer.on('disconnect', (c) => console.log(`🔌 ${c.getId()}`));
