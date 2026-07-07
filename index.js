// Logique de la page d'accueil : liste des streams en cours.

function streamCardHtml(s) {
  return `
    <div class="thumb">
      <div class="live-tag"><span class="dot"></span> EN DIRECT</div>
      <div class="viewer-tag">${s.viewerCount} spectateur${s.viewerCount === 1 ? '' : 's'}</div>
    </div>
    <div class="meta">
      <div class="title">${escapeHtml(s.title)}</div>
      <div class="streamer">par ${escapeHtml(s.username)}</div>
    </div>
  `;
}

async function loadStreams() {
  const res = await fetch('/api/streams');
  const data = await res.json();
  const grid = document.getElementById('streamGrid');
  const empty = document.getElementById('emptyState');
  const featuredSlot = document.getElementById('featuredSlot');
  const gridLabel = document.getElementById('gridLabel');

  grid.innerHTML = '';
  featuredSlot.innerHTML = '';
  gridLabel.textContent = '';

  if (!data.streams.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Sort by viewer count, feature the most-watched stream at the top.
  const sorted = [...data.streams].sort((a, b) => b.viewerCount - a.viewerCount);
  const [top, ...rest] = sorted;

  const featuredA = document.createElement('a');
  featuredA.className = 'featured';
  featuredA.href = `/watch.html?stream=${encodeURIComponent(top.id)}`;
  featuredA.innerHTML = `
    <div class="thumb">
      <div class="live-tag"><span class="dot"></span> EN DIRECT</div>
      <div class="bars"></div>
    </div>
    <div class="meta">
      <div>
        <div class="title">${escapeHtml(top.title)}</div>
        <div class="streamer">par ${escapeHtml(top.username)} · ${top.viewerCount} spectateur${top.viewerCount === 1 ? '' : 's'}</div>
      </div>
      <div class="watch-cta">Regarder</div>
    </div>
  `;
  featuredSlot.appendChild(featuredA);

  if (rest.length) {
    gridLabel.textContent = 'Aussi en direct';
    rest.forEach((s) => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `/watch.html?stream=${encodeURIComponent(s.id)}`;
      a.innerHTML = streamCardHtml(s);
      grid.appendChild(a);
    });
  }
}

function onAuthSuccess() {
  // After login/register, go straight to broadcasting.
  window.location.href = '/broadcast.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStreams();
  setInterval(loadStreams, 5000);

  async function goLive() {
    const me = await fetchMe();
    if (!me) {
      openAuthModal('login');
      return;
    }
    window.location.href = '/broadcast.html';
  }

  document.getElementById('goLiveBtn').addEventListener('click', goLive);
  document.getElementById('emptyGoLiveBtn').addEventListener('click', goLive);
});
