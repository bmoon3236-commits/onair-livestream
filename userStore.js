// Stockage utilisateurs simple basé sur un fichier JSON.
// Suffisant pour une démo / petit déploiement. Pour de la production à plus
// grande échelle, remplacer par une vraie base de données (Postgres, etc.).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function findUser(username) {
  return loadUsers().find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
}

function createUser(username, password) {
  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('USERNAME_TAKEN');
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id: Date.now().toString(36), username, passwordHash };
  users.push(user);
  saveUsers(users);
  return { id: user.id, username: user.username };
}

function verifyUser(username, password) {
  const user = findUser(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, username: user.username };
}

module.exports = { createUser, verifyUser, findUser };
