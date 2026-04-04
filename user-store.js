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

function withCredits(u) {
  if (!u) return null;
  return { ...u, credits: typeof u.credits === "number" && Number.isFinite(u.credits) ? u.credits : 0 };
}

function createFileStore(filePath) {
  const load = () => readJson(filePath, { users: [] });
  const save = (data) => writeJson(filePath, data);

  return {
    async findByEmail(email) {
      const e = (email || "").trim().toLowerCase();
      return withCredits(load().users.find((x) => x.email.toLowerCase() === e) || null);
    },
    async findById(id) {
      return withCredits(load().users.find((x) => x.id === id) || null);
    },
    async createUser({ email, password_hash, name }) {
      const data = load();
      const row = {
        id: crypto.randomUUID(),
        email: (email || "").trim().toLowerCase(),
        password_hash: password_hash || null,
        name: name || null,
        created_at: new Date().toISOString(),
        roles: [],
        credits: 0,
      };
      data.users.push(row);
      save(data);
      return withCredits(row);
    },
    async listPublicUsers() {
      return load().users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        created_at: u.created_at,
        roles: Array.isArray(u.roles) ? u.roles : [],
        credits: typeof u.credits === "number" ? u.credits : 0,
      }));
    },
    async setUserRoles(id, roles) {
      const data = load();
      const u = data.users.find((x) => x.id === id);
      if (!u) return null;
      const next = Array.isArray(roles) ? [...new Set(roles.filter((r) => typeof r === "string" && r.trim()))] : [];
      u.roles = next;
      save(data);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        created_at: u.created_at,
        roles: u.roles,
        credits: typeof u.credits === "number" ? u.credits : 0,
      };
    },
    async updateUser(id, patch) {
      const data = load();
      const u = data.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, patch);
      save(data);
      return withCredits(u);
    },
  };
}

/**
 * @param {string} filePath
 * @param {{ supabaseUrl?: string, supabaseServiceKey?: string }} [opts]
 */
function createStore(filePath, opts = {}) {
  const url = opts.supabaseUrl || process.env.SUPABASE_URL;
  const key = opts.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const { createSupabaseStore } = require("./supabase-store");
    return createSupabaseStore(url, key);
  }
  return createFileStore(filePath);
}

module.exports = { createStore, createFileStore };
