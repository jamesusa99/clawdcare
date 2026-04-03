/**
 * ClawdCare static site + auth API (email/password + Google OAuth).
 * Run: npm install && npm run dev
 */
require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { createStore } = require("./user-store");

const PORT = process.env.PORT || 3000;
/** Public site URL (OAuth + links). On Vercel, prefer BASE_URL env or VERCEL_URL. */
function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return `http://localhost:${PORT}`;
}
const BASE_URL = resolveBaseUrl();
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";

/** Vercel filesystem is read-only except /tmp — use temp store there when deployed. */
const userStorePath = process.env.VERCEL
  ? path.join("/tmp", "clawdcare-users.json")
  : path.join(__dirname, "data", "users.json");
const store = createStore(userStorePath);

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
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
passport.deserializeUser((id, done) => {
  try {
    const row = store.findById(id);
    if (!row) return done(null, null);
    done(null, { id: row.id, email: row.email, name: row.name });
  } catch (e) {
    done(e);
  }
});

passport.use(
  new LocalStrategy({ usernameField: "email", passwordField: "password" }, (email, password, done) => {
    try {
      const user = store.findByEmail(email);
      if (!user || !user.password_hash) return done(null, false, { message: "Invalid email or password." });
      if (!bcrypt.compareSync(password, user.password_hash)) return done(null, false, { message: "Invalid email or password." });
      return done(null, { id: user.id, email: user.email, name: user.name });
    } catch (err) {
      return done(err);
    }
  })
);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/auth/google/callback`,
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || "";
          const name = profile.displayName || "";
          if (!email) return done(new Error("No email from Google"));

          let user = store.findByGoogleId(googleId);
          if (!user) {
            const existing = store.findByEmail(email);
            if (existing) {
              store.updateUser(existing.id, { google_id: googleId, name: existing.name || name || null });
              user = store.findById(existing.id);
            } else {
              user = store.createUser({ email, name: name || null, google_id: googleId });
            }
          }
          return done(null, { id: user.id, email: user.email, name: user.name });
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

app.get("/api/auth/config", (req, res) => {
  res.json({
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    baseUrl: BASE_URL,
  });
});

app.post("/api/auth/register", (req, res) => {
  const email = (req.body.email || "").trim();
  const password = req.body.password || "";
  const name = (req.body.name || "").trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (store.findByEmail(email)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const hash = bcrypt.hashSync(password, 12);
  const row = store.createUser({ email, password_hash: hash, name });
  const user = { id: row.id, email: row.email, name: row.name };
  req.login(user, (err) => {
    if (err) return res.status(500).json({ error: "Could not create session." });
    return res.json({ user });
  });
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

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: req.user });
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login.html?error=google" }),
    (req, res) => res.redirect("/dashboard.html")
  );
}

// Static files (local dev only — Vercel serves these from CDN in production)
app.get("/favicon.ico", (req, res) => res.redirect(301, "/favicon.svg"));
app.get("/favicon.png", (req, res) => res.redirect(301, "/favicon.svg"));
app.use(express.static(path.join(__dirname)));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  // Never serve HTML for asset requests — return a proper 404 so the browser
  // doesn't silently receive HTML when expecting CSS/JS/images.
  const assetExts = new Set([".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map", ".json"]);
  if (assetExts.has(path.extname(req.path))) {
    return res.status(404).send("Not found");
  }
  // SPA/MPA fallback for HTML page routes
  res.sendFile(path.join(__dirname, "index.html"));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ClawdCare server running at ${BASE_URL}`);
  });
}
