/**
 * Simple JSON file persistence for users (no native SQLite build).
 */
const fs = require("fs");
const path = require("path");

function loadStore(filePath) {
  if (!fs.existsSync(filePath)) {
    return { users: [], nextId: 1 };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { users: [], nextId: 1 };
  }
}

function saveStore(filePath, store) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 0), "utf8");
  fs.renameSync(tmp, filePath);
}

function createStore(filePath) {
  let store = loadStore(filePath);

  const persist = () => saveStore(filePath, store);

  return {
    findByEmail(email) {
      const e = email.trim().toLowerCase();
      return store.users.find((u) => u.email.toLowerCase() === e) || null;
    },
    findById(id) {
      return store.users.find((u) => u.id === id) || null;
    },
    findByGoogleId(gid) {
      return store.users.find((u) => u.google_id === gid) || null;
    },
    createUser({ email, password_hash, name, google_id }) {
      const id = store.nextId++;
      const user = {
        id,
        email: email.trim(),
        password_hash: password_hash || null,
        name: name || null,
        google_id: google_id || null,
        created_at: new Date().toISOString(),
      };
      store.users.push(user);
      persist();
      return user;
    },
    updateUser(id, patch) {
      const u = store.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, patch);
      persist();
      return u;
    },
  };
}

module.exports = { createStore };
