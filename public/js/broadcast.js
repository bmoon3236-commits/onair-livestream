// Logique côté diffuseur (broadcaster) : capture webcam, envoie une offre
// WebRTC à chaque spectateur qui rejoint, gère chat + réactions.

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

let socket;
let localStream;
let streamId;
let peerConnections = {}; // viewerId -> RTCPeerConnection
let startTime;
let timerInterval;

function onLogout() {
  window.location.href = '/';
}

function formatTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function spawnFloatingEmoji(emoji) {
  const layer = document.getElementById('reactionLayer');
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = Math.random() * 80 + 5 + '%';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function appendChatMessage({ username, message }) {
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<b>${escapeHtml(username)}:</b> ${escapeHtml(message)}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function startBroadcast() {
  const errorEl = document.getElementById('setupError');
  errorEl.textContent = '';

  const me = await fetchMe();
  if (!me) {
    openAuthModal('login');
    return;
  }

  const title = document.getElementById('titleInput').value.trim() || 'Live sans titre';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e) {
    errorEl.textContent = "Impossible d'accéder à la webcam/micro. Vérifie les permissions du navigateur.";
    return;
  }

  const res = await fetch('/api/streams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    errorEl.textContent = 'Impossible de créer le live.';
    return;
  }
  const data = await res.json();
  streamId = data.streamId;

  document.getElementById('localVideo').srcObject = localStream;
  document.getElementById('setupPanel').classList.add('hidden');
  document.getElementById('livePanel').classList.remove('hidden');

  startTime = Date.now();
  timerInterval = setInterval(() => {
    document.getElementById('timerBadge').textContent = formatTimer(Date.now() - startTime);
  }, 1000);

  connectSocket(me.username);
}

function connectSocket(username) {
  socket = io();

  socket.on('connect', () => {
    socket.emit('broadcaster-join', { streamId });
  });

  socket.on('viewer-ready', async ({ viewerId }) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnections[viewerId] = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { to: viewerId, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-offer', { to: viewerId, offer });
  });

  socket.on('webrtc-answer', async ({ from, answer }) => {
    const pc = peerConnections[from];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
    const pc = peerConnections[from];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        /* ignore */
      }
    }
  });

  socket.on('viewer-left', ({ viewerId }) => {
    const pc = peerConnections[viewerId];
    if (pc) {
      pc.close();
      delete peerConnections[viewerId];
    }
  });

  socket.on('viewer-count', (count) => {
    document.getElementById('viewerCountBadge').textContent =
      `${count} spectateur${count === 1 ? '' : 's'}`;
  });

  socket.on('chat-message', (payload) => appendChatMessage(payload));
  socket.on('reaction', ({ emoji }) => spawnFloatingEmoji(emoji));

  // Chat send
  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    socket.emit('chat-message', { streamId, username, message });
    input.value = '';
  });
}

function endBroadcast() {
  if (socket) socket.emit('end-stream', { streamId });
  Object.values(peerConnections).forEach((pc) => pc.close());
  peerConnections = {};
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  clearInterval(timerInterval);

  document.getElementById('livePanel').classList.add('hidden');
  document.getElementById('endedPanel').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startBtn').addEventListener('click', startBroadcast);
  document.getElementById('endBtn').addEventListener('click', endBroadcast);

  window.addEventListener('beforeunload', () => {
    if (socket && streamId) socket.emit('end-stream', { streamId });
  });
});
