// sfu-server.js
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('@roamhq/wrtc');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const JWT_SECRET = process.env.JWT_SECRET || 'egor-super-secret-key-change-me';
const rooms = new Map(); // roomName -> Map<userId, { pc, socket, tracks }>

// ─── Token endpoint (аналог LiveKit token) ──────────────────────────────
app.post('/token', (req, res) => {
  const { roomName, participantName } = req.body;
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName and participantName required' });
  }

  const token = jwt.sign(
    { uid: participantName, roomName, role: 'publisher' },
    JWT_SECRET,
    { expiresIn: '4h' }
  );

  res.json({
    token: { uid: participantName, roomName, raw: token },
    url: `wss://${req.headers.host}/ws`
  });
});

// ─── WebSocket SFU логика ───────────────────────────────────────────────
wss.on('connection', (ws) => {
  let userId = null;
  let roomName = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        try {
          jwt.verify(msg.token, JWT_SECRET);
        } catch (e) {
          ws.close();
          return;
        }

        userId = msg.userId;
        roomName = msg.roomName;

        if (!rooms.has(roomName)) rooms.set(roomName, new Map());
        const room = rooms.get(roomName);

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
              urls: `turn:${process.env.TURN_HOST || 'egor-peerjs.onrender.com'}:3478`,
              username: process.env.TURN_USER || 'egor',
              credential: process.env.TURN_PASS || 'egorpass'
            }
          ]
        });

        room.set(userId, { pc, socket: ws, tracks: [] });

        pc.onicecandidate = (e) => {
          if (e.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
          }
        };

        // Когда сервер получает трек от этого юзера — форвардим всем остальным
        pc.ontrack = (event) => {
          const [stream] = event.streams;
          for (const [otherId, other] of room) {
            if (otherId === userId) continue;
            try {
              const sender = other.pc.addTrack(event.track, stream);
              other.tracks.push(sender);
            } catch (e) {
              console.warn('Forward track error:', e.message);
            }
          }
        };

        // Отправляем треки уже подключённых участников новому
        for (const [otherId, other] of room) {
          if (otherId === userId) continue;
          other.tracks.forEach(sender => {
            if (sender.track) {
              try {
                pc.addTrack(sender.track, sender.track.stream);
              } catch (e) {}
            }
          });
        }

        // Оповещаем остальных
        for (const [otherId, other] of room) {
          if (otherId === userId && other.socket.readyState === WebSocket.OPEN) {
            other.socket.send(JSON.stringify({ type: 'new-participant', userId }));
          }
        }

        break;
      }

      case 'offer': {
        const room = rooms.get(roomName);
        const entry = room?.get(userId);
        if (!entry) return;

        try {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);

          ws.send(JSON.stringify({ type: 'answer', answer: answer }));
        } catch (e) {
          console.error('Offer handling error:', e);
        }
        break;
      }

      case 'ice-candidate': {
        const room = rooms.get(roomName);
        const entry = room?.get(userId);
        if (!entry) return;

        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {}
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!roomName || !userId) return;
    const room = rooms.get(roomName);
    if (!room) return;

    const entry = room.get(userId);
    if (entry) {
      try { entry.pc.close(); } catch (e) {}
      room.delete(userId);
    }

    // Оповещаем оставшихся
    for (const [, other] of room) {
      if (other.socket.readyState === WebSocket.OPEN) {
        other.socket.send(JSON.stringify({ type: 'participant-left', userId }));
      }
    }

    if (room.size === 0) rooms.delete(roomName);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 EgorRTC SFU listening on port ${PORT}`);
});
