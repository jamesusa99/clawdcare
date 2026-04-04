require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { createStore } = require("./user-store");

const PORT = process.env.PORT || 3000;
function baseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return `http://localhost:${PORT}`;
}

const userStorePath = process.env.VERCEL
  ? path.join("/tmp", "clawdcare-users.json")
  : path.join(__dirname, "data", "users.json");
const store = createStore(userStorePath);

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("[clawdcare] User persistence: Supabase (profiles)");
} else {
  console.log("[clawdcare] User persistence: local JSON file");
}

async function getDatabaseConnectionStatus() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      ok: true,
      backend: "file",
      message: "当前使用本地 JSON 文件存储，未配置 Supabase。",
    };
  }
  try {
    const { createClient } = require("@supabase/supabase-js");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb.from("profiles").select("id").limit(1);
    if (error) {
      return {
        ok: false,
        backend: "supabase",
        message: error.message || "无法查询 profiles 表。",
      };
    }
    return {
      ok: true,
      backend: "supabase",
      message: "已连接 Supabase Postgres（profiles）。",
    };
  } catch (e) {
    return {
      ok: false,
      backend: "supabase",
      message: e.message || String(e),
    };
  }
}

function adminEmailSet() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Non-production convenience: if ADMIN_EMAILS is empty, any signed-in user can use admin
 * (typical local dev). Opt out with STRICT_ADMIN=1 or ADMIN_DEV_OPEN=0.
 * Production never uses this path.
 */
function isDevAdminOpen() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.STRICT_ADMIN === "1") return false;
  if (process.env.ADMIN_DEV_OPEN === "0") return false;
  if (process.env.ADMIN_DEV_OPEN === "1") return true;
  return adminEmailSet().length === 0;
}

function userRowIsAdmin(row) {
  if (!row) return false;
  if (isDevAdminOpen()) return true;
  const roles = Array.isArray(row.roles) ? row.roles : [];
  if (roles.includes("admin")) return true;
  const set = adminEmailSet();
  return set.length > 0 && set.includes(String(row.email || "").toLowerCase());
}

async function canManageRoles(req) {
  if (!req.user) return false;
  if (isDevAdminOpen()) return true;
  const row = await store.findById(req.user.id);
  if (!row) return false;
  const set = adminEmailSet();
  if (set.length === 0) return process.env.NODE_ENV !== "production";
  return set.includes(String(row.email || "").toLowerCase());
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const row = await store.findById(req.user.id);
    if (!userRowIsAdmin(row)) return res.status(403).json({ error: "Admin access required." });
    next();
  } catch (e) {
    next(e);
  }
}

function isUniqueViolation(err) {
  if (!err) return false;
  if (err.code === "23505") return true;
  const msg = String(err.message || "");
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

const app = express();
app.set("trust proxy", 1);

app.get("/favicon.ico", (_req, res) => res.redirect(301, "/favicon.svg"));

const BLOCKED_STATIC = new Set([
  "/server.js",
  "/user-store.js",
  "/supabase-store.js",
  "/package.json",
  "/package-lock.json",
  "/vercel.json",
  "/api/index.js",
]);
app.use((req, res, next) => {
  if (BLOCKED_STATIC.has(req.path)) return res.status(403).send("Forbidden");
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname), { index: "index.html" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const row = await store.findById(id);
    done(null, row ? { id: row.id, email: row.email, name: row.name } : null);
  } catch (e) {
    done(e);
  }
});

passport.use(
  new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
    try {
      const user = await store.findByEmail(email);
      if (!user || !user.password_hash) return done(null, false, { message: "Invalid email or password." });
      if (!bcrypt.compareSync(password, user.password_hash)) return done(null, false, { message: "Invalid email or password." });
      return done(null, { id: user.id, email: user.email, name: user.name });
    } catch (err) {
      return done(err);
    }
  })
);

app.get("/api/auth/me", async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const row = await store.findById(req.user.id);
    const isAdmin = userRowIsAdmin(row);
    const manage = isAdmin && (await canManageRoles(req));
    res.json({
      user: req.user,
      isAdmin,
      canManageRoles: manage,
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  const email = (req.body.email || "").trim();
  const password = req.body.password || "";
  const name = (req.body.name || "").trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  try {
    if (await store.findByEmail(email)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const hash = bcrypt.hashSync(password, 12);
    const row = await store.createUser({ email, password_hash: hash, name });
    const user = { id: row.id, email: row.email, name: row.name };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Could not create session." });
      return res.json({ user });
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    next(e);
  }
});

app.post("/api/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message || "Server error" });
    if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials." });
    req.login(user, (e) => {
      if (e) return res.status(500).json({ error: "Could not create session." });
      return res.json({ user });
    });
  })(req, res, next);
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed." });
    req.session.destroy(() => res.json({ ok: true }));
  });
});

app.get("/api/admin/overview", requireAdmin, async (req, res, next) => {
  try {
    const database = await getDatabaseConnectionStatus();
    const users = await store.listPublicUsers();
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const signupsLast7Days = users.filter((u) => {
      if (!u.created_at) return false;
      const t = new Date(u.created_at).getTime();
      return !Number.isNaN(t) && now - t < week;
    }).length;
    const adminEmails = adminEmailSet();
    const adminRoleCount = users.filter((u) => Array.isArray(u.roles) && u.roles.includes("admin")).length;
    const warnings = [];
    if (isDevAdminOpen()) {
      if (process.env.ADMIN_DEV_OPEN === "1") {
        warnings.push(
          "ADMIN_DEV_OPEN=1: any signed-in user can use this dashboard. Unset before production deploy."
        );
      } else if (adminEmails.length === 0) {
        warnings.push(
          "Local dev: ADMIN_EMAILS is empty, so any signed-in user can open admin. Add ADMIN_EMAILS=you@email.com to .env (and restart) for real access control, or set STRICT_ADMIN=1 to require an admin role only."
        );
      }
    }
    res.json({
      totalUsers: users.length,
      signupsLast7Days,
      adminRoleCount,
      nodeEnv: process.env.NODE_ENV || "development",
      dataBackend: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file",
      database,
      generatedAt: new Date().toISOString(),
      config: {
        adminEmailsConfigured: adminEmails.length > 0,
        adminEmailSlotCount: adminEmails.length,
        devAdminOpen: isDevAdminOpen(),
      },
      warnings,
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await store.listPublicUsers();
    users.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

app.patch("/api/admin/users/:id/roles", requireAdmin, async (req, res, next) => {
  if (!(await canManageRoles(req))) {
    return res.status(403).json({ error: "Only addresses listed in ADMIN_EMAILS can change roles (or non-production with empty ADMIN_EMAILS)." });
  }
  const { id } = req.params;
  const roles = req.body && req.body.roles;
  if (!Array.isArray(roles)) return res.status(400).json({ error: "Body must include roles: string[]" });
  const allowed = new Set(["admin"]);
  const nextRoles = roles.filter((r) => typeof r === "string" && allowed.has(r));
  try {
    const updated = await store.setUserRoles(id, nextRoles);
    if (!updated) return res.status(404).json({ error: "User not found." });
    res.json({ user: updated });
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, next) => {
  if (req.path.startsWith("/api/")) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
  next(err);
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  const ext = path.extname(req.path);
  const assets = new Set([".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map", ".json"]);
  if (assets.has(ext)) return res.status(404).send("Not found");
  res.sendFile(path.join(__dirname, "index.html"));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ClawdCare dev server: ${baseUrl()}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[clawdcare] Admin: open /admin.html after Sign in. If access denied: use login?next=/admin.html or set ADMIN_EMAILS=your@email.com in .env (restart). Local default: empty ADMIN_EMAILS → any logged-in user is admin."
      );
    }
  });
}
