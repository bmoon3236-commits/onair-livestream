// Gestion partagée de l'authentification (utilisé par index.html et broadcast.html)

let currentUser = null;
let authMode = 'login'; // 'login' | 'register'

async function fetchMe() {
  const res = await fetch('/api/me');
  const data = await res.json();
  currentUser = data.user;
  renderAuthState();
  return currentUser;
}

function renderAuthState() {
  const chip = document.getElementById('userChip');
  const loginBtn = document.getElementById('loginBtn');
  if (!chip || !loginBtn) return;

  if (currentUser) {
    chip.classList.remove('hidden');
    chip.innerHTML = `Connecté en tant que <b>${escapeHtml(currentUser.username)}</b>`;
    loginBtn.textContent = 'Déconnexion';
  } else {
    chip.classList.add('hidden');
    loginBtn.textContent = 'Connexion';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openAuthModal(mode) {
  authMode = mode;
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('authError').textContent = '';
  updateAuthModalMode();
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.add('hidden');
}

function updateAuthModalMode() {
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const switchText = document.getElementById('switchText');
  const switchBtn = document.getElementById('switchBtn');
  if (authMode === 'login') {
    title.textContent = 'Connexion';
    submit.textContent = 'Se connecter';
    switchText.textContent = 'Pas encore de compte ?';
    switchBtn.textContent = 'Créer un compte';
  } else {
    title.textContent = 'Créer un compte';
    submit.textContent = "S'inscrire";
    switchText.textContent = 'Déjà un compte ?';
    switchBtn.textContent = 'Se connecter';
  }
}

async function submitAuth() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  errorEl.textContent = '';

  const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Erreur.';
      return;
    }
    currentUser = data.user;
    renderAuthState();
    closeAuthModal();
    if (typeof onAuthSuccess === 'function') onAuthSuccess();
  } catch (e) {
    errorEl.textContent = 'Erreur réseau.';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  renderAuthState();
  if (typeof onLogout === 'function') onLogout();
}

function wireAuthUi() {
  const loginBtn = document.getElementById('loginBtn');
  const cancelBtn = document.getElementById('authCancel');
  const submitBtn = document.getElementById('authSubmit');
  const switchBtn = document.getElementById('switchBtn');

  loginBtn.addEventListener('click', () => {
    if (currentUser) {
      logout();
    } else {
      openAuthModal('login');
    }
  });
  cancelBtn.addEventListener('click', closeAuthModal);
  submitBtn.addEventListener('click', submitAuth);
  switchBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthModalMode();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireAuthUi();
  fetchMe();
});
