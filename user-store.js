const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function createStore(filePath) {
  const load = () => readJson(filePath, { users: [] });
  const save = (data) => writeJson(filePath, data);

  return {
    findByEmail(email) {
      const e = (email || "").trim().toLowerCase();
      return load().users.find((u) => u.email.toLowerCase() === e) || null;
    },
    findById(id) {
      return load().users.find((u) => u.id === id) || null;
    },
    createUser({ email, password_hash, name }) {
      const data = load();
      const row = {
        id: crypto.randomUUID(),
        email: (email || "").trim().toLowerCase(),
        password_hash: password_hash || null,
        name: name || null,
        created_at: new Date().toISOString(),
      };
      data.users.push(row);
      save(data);
      return row;
    },
    updateUser(id, patch) {
      const data = load();
      const u = data.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, patch);
      save(data);
      return u;
    },
  };
}

module.exports = { createStore };
