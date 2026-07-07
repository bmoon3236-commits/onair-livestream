const path = require('path');
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const userStore = require('./userStore');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 24h
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth API ----------

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({
      error: "Nom d'utilisateur (3+ caractères) et mot de passe (6+ caractères) requis.",
    });
  }
  try {
    const user = userStore.createUser(username.trim(), password);
    req.session.user = user;
    res.json({ user });
  } catch (e) {
    if (e.message === 'USERNAME_TAKEN') {
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
    }
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = userStore.verifyUser(username || '', password || '');
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  req.session.user = user;
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté.' });
  next();
}

// ---------- Stream registry ----------
// streamId -> { id, title, username, broadcasterSocketId, viewers: Set<socketId>, startedAt }
const streams = new Map();

app.get('/api/streams', (req, res) => {
  const list = Array.from(streams.values()).map((s) => ({
    id: s.id,
    title: s.title,
    username: s.username,
    viewerCount: s.viewers.size,
    startedAt: s.startedAt,
  }));
  res.json({ streams: list });
});

app.post('/api/streams', requireAuth, (req, res) => {
  const { title } = req.body || {};
  const id = uuidv4().slice(0, 8);
  streams.set(id, {
    id,
    title: (title || 'Live sans titre').slice(0, 80),
    username: req.session.user.username,
    broadcasterSocketId: null,
    viewers: new Set(),
    startedAt: Date.now(),
  });
  res.json({ streamId: id });
});

// ---------- Socket.io signaling / chat / reactions ----------

io.on('connection', (socket) => {
  // Broadcaster attaches its socket to a previously created stream id
  socket.on('broadcaster-join', ({ streamId }) => {
    const stream = streams.get(streamId);
    if (!stream) return socket.emit('error-message', 'Stream introuvable.');
    stream.broadcasterSocketId = socket.id;
    socket.data.streamId = streamId;
    socket.data.role = 'broadcaster';
    socket.join(streamId);
  });

  // Viewer joins a stream room
  socket.on('viewer-join', ({ streamId }) => {
    const stream = streams.get(streamId);
    if (!stream) return socket.emit('error-message', 'Stream introuvable ou terminé.');
    socket.data.streamId = streamId;
    socket.data.role = 'viewer';
    socket.join(streamId);
    stream.viewers.add(socket.id);

    io.to(streamId).emit('viewer-count', stream.viewers.size);

    if (stream.broadcasterSocketId) {
      // Ask the broadcaster to create a peer connection + offer for this viewer
      io.to(stream.broadcasterSocketId).emit('viewer-ready', { viewerId: socket.id });
    }
  });

  // WebRTC signaling relay (targeted, by socket id)
  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', { from: socket.id, offer });
  });
  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', { from: socket.id, answer });
  });
  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
  });

  // Chat
  socket.on('chat-message', ({ streamId, username, message }) => {
    if (!streamId || !message) return;
    const clean = String(message).slice(0, 300);
    io.to(streamId).emit('chat-message', {
      username: username || 'Anonyme',
      message: clean,
      ts: Date.now(),
    });
  });

  // Reactions (emoji bursts)
  socket.on('reaction', ({ streamId, emoji }) => {
    if (!streamId) return;
    const allowed = ['❤️', '🔥', '👏', '😂', '😮'];
    const e = allowed.includes(emoji) ? emoji : '❤️';
    io.to(streamId).emit('reaction', { emoji: e });
  });

  socket.on('end-stream', ({ streamId }) => {
    const stream = streams.get(streamId);
    if (stream && stream.broadcasterSocketId === socket.id) {
      io.to(streamId).emit('stream-ended');
      streams.delete(streamId);
    }
  });

  socket.on('disconnect', () => {
    const { streamId, role } = socket.data;
    if (!streamId) return;
    const stream = streams.get(streamId);
    if (!stream) return;

    if (role === 'broadcaster' && stream.broadcasterSocketId === socket.id) {
      io.to(streamId).emit('stream-ended');
      streams.delete(streamId);
    } else if (role === 'viewer') {
      stream.viewers.delete(socket.id);
      io.to(streamId).emit('viewer-count', stream.viewers.size);
      if (stream.broadcasterSocketId) {
        io.to(stream.broadcasterSocketId).emit('viewer-left', { viewerId: socket.id });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`OnAir server running on http://localhost:${PORT}`);
});
