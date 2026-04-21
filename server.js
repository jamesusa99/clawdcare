require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
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
  ? path.join("/tmp", "bingohealth-users.json")
  : path.join(__dirname, "data", "users.json");
const store = createStore(userStorePath);

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("[bingohealth] User persistence: Supabase (profiles)");
} else {
  console.log("[bingohealth] User persistence: local JSON file");
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

function publicUserFromRow(row) {
  if (!row) return null;
  const c = row.credits;
  const credits = typeof c === "number" && Number.isFinite(c) ? Math.max(0, Math.floor(c)) : 0;
  return { id: row.id, email: row.email, name: row.name, credits };
}

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function defaultNextRenewalDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function normalizeSubscriptionList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === "object" && s.id && (s.kind === "program" || s.kind === "token"));
}

function sanitizeSubscriptionForClient(s) {
  return {
    id: s.id,
    kind: s.kind,
    name: String(s.name || "").slice(0, 200),
    cycle: String(s.cycle || "Monthly").slice(0, 80),
    price_cents: typeof s.price_cents === "number" && Number.isFinite(s.price_cents) ? Math.max(0, Math.floor(s.price_cents)) : 0,
    next_renewal: typeof s.next_renewal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.next_renewal) ? s.next_renewal : null,
    status: s.status === "canceled" ? "canceled" : "active",
  };
}

function parseNewSubscriptionBody(body) {
  const kind = body?.kind === "token" ? "token" : body?.kind === "program" ? "program" : null;
  const name = String(body?.name || "").trim().slice(0, 200);
  const cycle = String(body?.cycle || "Monthly").trim().slice(0, 80) || "Monthly";
  const price_cents = Math.max(0, Math.min(99_999_999, parseInt(body?.price_cents, 10) || 0));
  let next_renewal = null;
  if (body?.next_renewal) {
    const d = String(body.next_renewal).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) next_renewal = d;
  }
  return { kind, name, cycle, price_cents, next_renewal: next_renewal || defaultNextRenewalDate() };
}

function normalizePaymentMethodList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      p.id &&
      typeof p.last4 === "string" &&
      /^\d{4}$/.test(p.last4) &&
      typeof p.brand === "string" &&
      typeof p.exp_month === "number" &&
      Number.isFinite(p.exp_month) &&
      typeof p.exp_year === "number" &&
      Number.isFinite(p.exp_year)
  );
}

function sanitizeBillingPayload(b) {
  if (!b || typeof b !== "object") return {};
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  return {
    first_name: clip(b.first_name, 80),
    last_name: clip(b.last_name, 80),
    line1: clip(b.line1, 200),
    line2: clip(b.line2, 200),
    city: clip(b.city, 100),
    state: clip(b.state, 100),
    country: clip(b.country, 2).toUpperCase() || "US",
    zip: clip(b.zip, 20),
  };
}

function sanitizePaymentMethodForClient(p) {
  return {
    id: p.id,
    brand: p.brand,
    last4: p.last4,
    exp_month: p.exp_month,
    exp_year: p.exp_year,
    card_country: p.card_country || null,
    card_postal_code: p.card_postal_code || null,
    billing: sanitizeBillingPayload(p.billing),
    is_default: !!p.is_default,
    created_at: p.created_at || null,
  };
}

function normalizeCardBrand(brand) {
  const b = String(brand || "").toLowerCase();
  if (["visa", "mastercard", "amex", "discover"].includes(b)) return b;
  return "other";
}

function validateCardExp(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  if (y < curY || (y === curY && m < curM)) return null;
  return { exp_month: m, exp_year: y };
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

/** Vercel serverless: default MemoryStore is per-instance — sessions vanish on the next request. Set REDIS_URL (e.g. Upstash TCP URL). */
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  },
};
if (process.env.REDIS_URL) {
  const Redis = require("ioredis");
  const RedisStore = require("connect-redis").default;
  const redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  sessionConfig.store = new RedisStore({ client: redisClient });
} else if (process.env.VERCEL && process.env.NODE_ENV === "production") {
  console.warn(
    "[bingohealth] No REDIS_URL: sessions use MemoryStore and will not persist across Vercel invocations. Add REDIS_URL (Upstash Redis) for login to work."
  );
}
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const row = await store.findById(id);
    done(null, publicUserFromRow(row));
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
      return done(null, publicUserFromRow(user));
    } catch (err) {
      return done(err);
    }
  })
);

app.get("/api/auth/me", async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = userRowIsAdmin(row);
    const manage = isAdmin && (await canManageRoles(req));
    res.json({
      user: publicUserFromRow(row),
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
    const user = publicUserFromRow(row);
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

app.get("/api/me/subscriptions", requireLogin, async (req, res, next) => {
  try {
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizeSubscriptionList(row.subscriptions).map(sanitizeSubscriptionForClient);
    res.json({ subscriptions: list });
  } catch (e) {
    next(e);
  }
});

app.post("/api/me/subscriptions", requireLogin, async (req, res, next) => {
  try {
    const parsed = parseNewSubscriptionBody(req.body || {});
    if (!parsed.kind) return res.status(400).json({ error: "kind must be program or token." });
    if (!parsed.name) return res.status(400).json({ error: "name is required." });
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizeSubscriptionList(row.subscriptions);
    const sub = {
      id: crypto.randomUUID(),
      kind: parsed.kind,
      name: parsed.name,
      cycle: parsed.cycle,
      price_cents: parsed.price_cents,
      next_renewal: parsed.next_renewal,
      status: "active",
    };
    list.push(sub);
    await store.updateUser(req.user.id, { subscriptions: list });
    res.status(201).json({ subscription: sanitizeSubscriptionForClient(sub) });
  } catch (e) {
    next(e);
  }
});

/** One-time sample rows so Subscriptions edit/cancel can be exercised before checkout integration. */
app.post("/api/me/subscriptions/demo", requireLogin, async (req, res, next) => {
  try {
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizeSubscriptionList(row.subscriptions);
    if (list.length > 0) {
      return res.status(400).json({ error: "This account already has subscriptions. Remove them first or use the Shop when connected." });
    }
    const demo = [
      {
        id: crypto.randomUUID(),
        kind: "program",
        name: "Program — Longevity (sample)",
        cycle: "Monthly",
        price_cents: 9900,
        next_renewal: defaultNextRenewalDate(),
        status: "active",
      },
      {
        id: crypto.randomUUID(),
        kind: "token",
        name: "Credit Plan — Standard (~1,500 credits/mo, sample)",
        cycle: "Monthly",
        price_cents: 4900,
        next_renewal: defaultNextRenewalDate(),
        status: "active",
      },
    ];
    await store.updateUser(req.user.id, { subscriptions: demo });
    res.status(201).json({ subscriptions: demo.map(sanitizeSubscriptionForClient) });
  } catch (e) {
    next(e);
  }
});

app.patch("/api/me/subscriptions/:id", requireLogin, async (req, res, next) => {
  try {
    const subId = String(req.params.id || "").trim();
    if (!subId) return res.status(400).json({ error: "Missing id." });
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizeSubscriptionList(row.subscriptions);
    const idx = list.findIndex((s) => s.id === subId);
    if (idx === -1) return res.status(404).json({ error: "Subscription not found." });
    const body = req.body || {};
    if (body.name != null) list[idx].name = String(body.name).trim().slice(0, 200) || list[idx].name;
    if (body.next_renewal != null) {
      const d = String(body.next_renewal).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) list[idx].next_renewal = d;
    }
    if (body.cycle != null) list[idx].cycle = String(body.cycle).trim().slice(0, 80) || list[idx].cycle;
    await store.updateUser(req.user.id, { subscriptions: list });
    res.json({ subscription: sanitizeSubscriptionForClient(list[idx]) });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/me/subscriptions/:id", requireLogin, async (req, res, next) => {
  try {
    const subId = String(req.params.id || "").trim();
    if (!subId) return res.status(400).json({ error: "Missing id." });
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizeSubscriptionList(row.subscriptions).filter((s) => s.id !== subId);
    if (list.length === normalizeSubscriptionList(row.subscriptions).length) {
      return res.status(404).json({ error: "Subscription not found." });
    }
    await store.updateUser(req.user.id, { subscriptions: list });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.get("/api/me/payment-methods", requireLogin, async (req, res, next) => {
  try {
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizePaymentMethodList(row.payment_methods).map(sanitizePaymentMethodForClient);
    res.json({ payment_methods: list });
  } catch (e) {
    next(e);
  }
});

/** Client sends only brand, last4, exp — never full PAN or CVC. Production: replace with Stripe PaymentMethod. */
app.post("/api/me/payment-methods", requireLogin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const last4 = String(body.last4 || "")
      .replace(/\D/g, "")
      .slice(-4);
    if (!/^\d{4}$/.test(last4)) {
      return res.status(400).json({ error: "Invalid card (last four digits required)." });
    }

    const exp = validateCardExp(body.exp_month, body.exp_year);
    if (!exp) return res.status(400).json({ error: "Invalid or expired expiration date." });

    const billing = sanitizeBillingPayload(body.billing);
    if (!billing.first_name || !billing.last_name || !billing.line1 || !billing.city || !billing.country || !billing.zip) {
      return res.status(400).json({
        error: "Billing: first name, last name, address line 1, city, country, and ZIP/postal code are required.",
      });
    }
    if (!/^[A-Z]{2}$/.test(billing.country)) {
      return res.status(400).json({ error: "Billing country must be a 2-letter code." });
    }

    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizePaymentMethodList(row.payment_methods);

    const setDefault = Boolean(body.set_default) || list.length === 0;
    if (setDefault) for (const p of list) p.is_default = false;

    const cc = String(body.card_country || "US")
      .replace(/\s/g, "")
      .toUpperCase()
      .slice(0, 2);
    const entry = {
      id: crypto.randomUUID(),
      brand: normalizeCardBrand(body.brand),
      last4,
      exp_month: exp.exp_month,
      exp_year: exp.exp_year,
      card_country: /^[A-Z]{2}$/.test(cc) ? cc : "US",
      card_postal_code: String(body.card_postal_code || "")
        .replace(/\s/g, "")
        .slice(0, 16),
      billing,
      is_default: setDefault,
      created_at: new Date().toISOString(),
    };
    list.push(entry);
    await store.updateUser(req.user.id, { payment_methods: list });
    res.status(201).json({ payment_method: sanitizePaymentMethodForClient(entry) });
  } catch (e) {
    next(e);
  }
});

app.patch("/api/me/payment-methods/:id/default", requireLogin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizePaymentMethodList(row.payment_methods);
    if (!list.some((p) => p.id === id)) return res.status(404).json({ error: "Payment method not found." });
    for (const p of list) p.is_default = p.id === id;
    await store.updateUser(req.user.id, { payment_methods: list });
    res.json({ payment_methods: list.map(sanitizePaymentMethodForClient) });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/me/payment-methods/:id", requireLogin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const row = await store.findById(req.user.id);
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const list = normalizePaymentMethodList(row.payment_methods);
    const nextList = list.filter((p) => p.id !== id);
    if (nextList.length === list.length) return res.status(404).json({ error: "Payment method not found." });
    if (nextList.length > 0 && !nextList.some((p) => p.is_default)) nextList[0].is_default = true;
    await store.updateUser(req.user.id, { payment_methods: nextList });
    res.json({ ok: true, payment_methods: nextList.map(sanitizePaymentMethodForClient) });
  } catch (e) {
    next(e);
  }
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
  // Vercel: if all traffic is wrongly routed to this function, never serve index.html for /shop.html etc.
  if (process.env.VERCEL && ext === ".html") {
    const base = path.basename(req.path);
    if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.html$/.test(base)) {
      const f = path.join(__dirname, base);
      try {
        if (fs.existsSync(f) && fs.statSync(f).isFile()) return res.sendFile(f);
      } catch (_) {}
    }
    const nf = path.join(__dirname, "404.html");
    if (fs.existsSync(nf)) return res.status(404).sendFile(nf);
    return res.status(404).type("html").send("<!DOCTYPE html><html><head><meta charset=utf-8><title>Not found</title></head><body>Not found</body></html>");
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BingoHealth dev server: ${baseUrl()}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[bingohealth] Admin: open /admin.html after Sign in. If access denied: use login?next=/admin.html or set ADMIN_EMAILS=your@email.com in .env (restart). Local default: empty ADMIN_EMAILS → any logged-in user is admin."
      );
    }
  });
}
