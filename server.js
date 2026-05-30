const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const app = express();
app.enable('trust proxy');

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: '/myapp',
  proxied: true,
  debug: true,
});

app.use(peerServer);

app.get('/', (req, res) => {
  res.send('PeerJS OK');
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});
