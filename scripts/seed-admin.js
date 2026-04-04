/**
 * Create or update the platform admin account (bypasses the 8-char register rule).
 * Uses the same store as server.js (file or Supabase from .env).
 *
 * Defaults: admin@clawdcare.com / 123456
 * Override: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */
require("dotenv").config();
const path = require("path");
const bcrypt = require("bcryptjs");
const { createStore } = require("../user-store");

const userStorePath = process.env.VERCEL
  ? path.join("/tmp", "clawdcare-users.json")
  : path.join(__dirname, "..", "data", "users.json");

const email = (process.env.SEED_ADMIN_EMAIL || "admin@clawdcare.com").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "123456";

async function main() {
  const store = createStore(userStorePath);
  const hash = bcrypt.hashSync(password, 12);
  let row = await store.findByEmail(email);
  if (!row) {
    row = await store.createUser({ email, password_hash: hash, name: "Platform admin" });
    await store.setUserRoles(row.id, ["admin"]);
    console.log(`[seed-admin] Created: ${email}`);
  } else {
    await store.updateUser(row.id, { password_hash: hash });
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const next = [...new Set([...roles, "admin"])];
    await store.setUserRoles(row.id, next);
    console.log(`[seed-admin] Updated password and admin role: ${email}`);
  }
  console.log("[seed-admin] Sign in at /login.html?next=/admin.html");
  console.log("[seed-admin] For production, set ADMIN_EMAILS=" + email + " (or rely on admin role).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
