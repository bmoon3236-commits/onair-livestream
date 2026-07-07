// Logique de la page d'accueil : liste des streams en cours.

async function loadStreams() {
  const res = await fetch('/api/streams');
  const data = await res.json();
  const grid = document.getElementById('streamGrid');
  const empty = document.getElementById('emptyState');

  grid.innerHTML = '';
  if (!data.streams.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  data.streams.forEach((s) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `/watch.html?stream=${encodeURIComponent(s.id)}`;
    a.innerHTML = `
      <div class="thumb">
        <div class="live-tag"><span class="dot"></span> EN DIRECT</div>
        <div class="viewer-tag">${s.viewerCount} spectateur${s.viewerCount === 1 ? '' : 's'}</div>
      </div>
      <div class="meta">
        <div class="title">${escapeHtml(s.title)}</div>
        <div class="streamer">par ${escapeHtml(s.username)}</div>
      </div>
    `;
    grid.appendChild(a);
  });
}

function onAuthSuccess() {
  // After login/register, go straight to broadcasting.
  window.location.href = '/broadcast.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStreams();
  setInterval(loadStreams, 5000);

  document.getElementById('goLiveBtn').addEventListener('click', async () => {
    const me = await fetchMe();
    if (!me) {
      openAuthModal('login');
      return;
    }
    window.location.href = '/broadcast.html';
  });
});
