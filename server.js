const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.status(200).send('EgorNetwork Token Server OK'));

app.post('/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    if (!roomName || !participantName) return res.status(400).json({ error: 'Missing data' });

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: participantName,
    });

    // Права на вход в комнату, публикацию и подписку на аудио
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    res.json({
      token: at.toJwt(),
      url: process.env.LIVEKIT_URL
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Token generation failed' });
  }
});

app.listen(process.env.PORT || 3000);
