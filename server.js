import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';

const server = createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map(); // roomCode -> room
const clients = new Map(); // clientId -> { socket, roomCode }

const randomId = () => crypto.randomBytes(8).toString('hex');
const randomCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded I and O to avoid confusion
  return Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
};

const getLocalUrl = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${PORT}`;
      }
    }
  }
  return `http://localhost:${PORT}`;
};

const safeSend = (socket, payload) => {
  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    console.error('Send error', err.message);
  }
};

const broadcast = (roomCode, payload, exceptId = null) => {
  const room = rooms.get(roomCode);
  if (!room) return;
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    const client = clients.get(player.id);
    if (client) {
      safeSend(client.socket, payload);
    }
  }
};

const publishPlayers = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
  }));
  broadcast(roomCode, { type: 'players-update', payload: { players } });
};

// Lightweight AI prompt proxy so the API key stays on the server (Gemini)
app.post('/api/ai-prompt', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: 'AI key not configured on server.' });
  }

  const { gameId, mode, category, theme, players = [], recent = [] } = req.body || {};
  const names = players.map((p) => p?.name).filter(Boolean).slice(0, 12);
  const vibe = theme || 'classic';
  const dedupeNote = recent.length ? `Avoid these: ${recent.slice(-15).join(' | ')}` : 'Do not repeat recent prompts.';

  const system = `You craft ultra-short, punchy prompts for party games. Max 120 characters. No numbering, no quotes, no emojis unless essential. Match the vibe (${vibe}).`;
  const user = `Game: ${gameId || 'truth-or-dare'}; Mode: ${mode || 'prompt'}; Category: ${category || 'any'}; Audience names: ${names.join(', ') || 'friends'}. ${dedupeNote}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${system}\n\n${user}` }] },
        ],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 120,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const cleaned = raw.split('\n')[0].replace(/^[-*\d.\s]+/, '').trim();
    return res.json({ prompt: cleaned });
  } catch (err) {
    console.error('AI prompt error:', err.message);
    return res.status(500).json({ error: 'Failed to generate prompt.' });
  }
});

const removePlayer = (clientId, notifyClient = false) => {
  const client = clients.get(clientId);
  if (!client?.roomCode) return;
  const roomCode = client.roomCode;
  const room = rooms.get(roomCode);
  if (!room) return;
  
  const wasHost = room.hostId === clientId;
  room.players.delete(clientId);
  
  if (room.players.size === 0) {
    // Don't delete immediately - give 30s grace period for host to reconnect
    if (!room.deleteTimeout) {
      room.deleteTimeout = setTimeout(() => {
        const currentRoom = rooms.get(roomCode);
        if (currentRoom && currentRoom.players.size === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted after grace period`);
        }
      }, 30000); // 30 second grace period
    }
    return;
  }
  
  // Clear delete timeout if someone is still in room
  if (room.deleteTimeout) {
    clearTimeout(room.deleteTimeout);
    room.deleteTimeout = null;
  }
  
  if (wasHost) {
    const nextHost = room.players.values().next().value;
    if (nextHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.id;
      // Notify all players about the new host
      broadcast(roomCode, { 
        type: 'host-changed', 
        payload: { newHostId: nextHost.id, newHostName: nextHost.name } 
      });
    }
  }
  publishPlayers(roomCode);
};

const handleCreateRoom = (ws, clientId, payload) => {
  const { name } = payload || {};
  const roomCode = randomCode();
  const room = {
    code: roomCode,
    hostId: clientId,
    players: new Map(),
    createdAt: Date.now(),
    settings: {
      gameId: 'truth',
      theme: 'party',
    },
  };
  room.players.set(clientId, { id: clientId, name: name || 'Host', isHost: true });
  rooms.set(roomCode, room);
  clients.set(clientId, { socket: ws, roomCode });
  safeSend(ws, {
    type: 'room-created',
    payload: {
      roomCode,
      selfId: clientId,
      settings: room.settings,
    },
  });
  publishPlayers(roomCode);
};

const handleJoinRoom = (ws, clientId, payload) => {
  const { code, name, wasHost } = payload || {};
  const roomCode = (code || '').toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) {
    safeSend(ws, { type: 'error', payload: { message: 'Room not found.' } });
    return;
  }
  
  // Clear any pending room deletion
  if (room.deleteTimeout) {
    clearTimeout(room.deleteTimeout);
    room.deleteTimeout = null;
  }
  
  // If user was the host and room has no players, restore as host
  let isHost = false;
  if (wasHost && room.players.size === 0) {
    // Room exists but empty - restore as host
    isHost = true;
    room.hostId = clientId;
  }
  
  if (room.players.has(clientId)) {
    room.players.get(clientId).name = name || 'Player';
    if (isHost) room.players.get(clientId).isHost = true;
  } else {
    room.players.set(clientId, { id: clientId, name: name || 'Player', isHost });
  }
  
  if (isHost) {
    room.hostId = clientId;
  }
  
  clients.set(clientId, { socket: ws, roomCode });
  
  // Send different response based on whether they're host
  if (isHost) {
    safeSend(ws, {
      type: 'room-created',
      payload: {
        roomCode,
        selfId: clientId,
        settings: room.settings,
      },
    });
  } else {
    safeSend(ws, {
      type: 'joined-room',
      payload: { roomCode, selfId: clientId, hostId: room.hostId, settings: room.settings },
    });
  }
  publishPlayers(roomCode);
};

const handleSetSettings = (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client?.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room || room.hostId !== clientId) return;
  const { gameId, theme } = payload || {};
  if (gameId) room.settings.gameId = gameId;
  if (theme) room.settings.theme = theme;
  broadcast(client.roomCode, { type: 'settings-update', payload: room.settings });
};

const handleRelay = (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client?.roomCode) return;
  broadcast(client.roomCode, { type: 'relay', payload: { from: clientId, ...payload } });
};

wss.on('connection', (ws) => {
  const clientId = randomId();
  clients.set(clientId, { socket: ws, roomCode: null });
  safeSend(ws, { type: 'welcome', payload: { clientId } });

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      safeSend(ws, { type: 'error', payload: { message: 'Invalid JSON' } });
      return;
    }
    const { type, payload } = data;
    switch (type) {
      case 'create-room':
        handleCreateRoom(ws, clientId, payload);
        break;
      case 'join-room':
        handleJoinRoom(ws, clientId, payload);
        break;
      case 'relay':
        handleRelay(clientId, payload);
        break;
      case 'set-settings':
        handleSetSettings(clientId, payload);
        break;
      case 'leave-room':
        removePlayer(clientId);
        break;
      default:
        safeSend(ws, { type: 'error', payload: { message: 'Unknown type' } });
    }
  });

  ws.on('close', () => removePlayer(clientId));
});

server.listen(PORT, () => {
  console.log(`Party server on ${getLocalUrl()}`);
});
