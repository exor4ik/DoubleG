const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

app.enable('trust proxy');

const peerServer = ExpressPeerServer(server, {
  proxied: true,
  debug: true,
});

app.use('/myapp', peerServer);

app.get('/', (req, res) => {
  res.send('PeerJS OK');
});

const port = process.env.PORT || 10000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});
