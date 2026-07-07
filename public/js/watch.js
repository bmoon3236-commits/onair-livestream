// Logique côté spectateur : reçoit l'offre WebRTC du diffuseur, chat, réactions.

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getStreamIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('stream');
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

document.addEventListener('DOMContentLoaded', async () => {
  const streamId = getStreamIdFromUrl();
  if (!streamId) {
    window.location.href = '/';
    return;
  }

  // Grab (or invent) a display name for chat/reactions without requiring login.
  let me = null;
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    me = data.user;
  } catch (e) {
    /* ignore */
  }
  const username = me ? me.username : 'Spectateur' + Math.floor(Math.random() * 1000);

  const socket = io();
  let pc = null;

  socket.on('connect', () => {
    socket.emit('viewer-join', { streamId });
  });

  socket.on('error-message', (msg) => {
    document.getElementById('watchPanel').classList.add('hidden');
    document.getElementById('endedPanel').classList.remove('hidden');
  });

  socket.on('webrtc-offer', async ({ from, offer }) => {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { to: from, candidate: event.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer', { to: from, answer });
  });

  socket.on('webrtc-ice-candidate', async ({ candidate }) => {
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        /* ignore */
      }
    }
  });

  socket.on('viewer-count', (count) => {
    document.getElementById('viewerCountBadge').textContent =
      `${count} spectateur${count === 1 ? '' : 's'}`;
  });

  socket.on('chat-message', (payload) => appendChatMessage(payload));
  socket.on('reaction', ({ emoji }) => spawnFloatingEmoji(emoji));

  socket.on('stream-ended', () => {
    if (pc) pc.close();
    document.getElementById('watchPanel').classList.add('hidden');
    document.getElementById('endedPanel').classList.remove('hidden');
  });

  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    socket.emit('chat-message', { streamId, username, message });
    input.value = '';
  });

  document.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      socket.emit('reaction', { streamId, emoji });
      spawnFloatingEmoji(emoji);
    });
  });
});
