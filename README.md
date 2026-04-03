# ClawdCare (clawdcare.com)

Marketing site and lightweight account platform for **ClawdCare** / **BingoClaw Health Care**—local-first AI health intelligence, LifeClock-driven insights, and BingoClaw V-Series positioning.

## Requirements

- **Node.js** 18 or newer

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env — set SESSION_SECRET at minimum
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Development with auto-restart on file changes:

```bash
npm run dev
```

## Environment

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Long random string for signing cookies (required for production). |
| `BASE_URL` | Public origin, no trailing slash (e.g. `https://clawdcare.com`). Used for OAuth redirect. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Enables “Continue with Google”. Redirect URI: `{BASE_URL}/api/auth/google/callback`. |

If Google OAuth is omitted, email/password registration and sign-in still work.

## What’s in this repo

| Path | Purpose |
|------|---------|
| `index.html` | English marketing landing page |
| `styles.css` | Site styles (dark / tech aesthetic) |
| `login.html`, `register.html`, `dashboard.html` | Auth UI (`auth.css`, `js/auth.js`) |
| `assets/` | Product imagery |
| `server.js` | Express: static files + session auth API |
| `user-store.js` | JSON file user persistence under `data/` |

## Auth API

All JSON routes expect `Content-Type: application/json` where applicable. Use cookies (`credentials: 'same-origin'` from the browser).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/config` | `{ googleEnabled, baseUrl }` |
| `POST` | `/api/auth/register` | Body: `email`, `password` (min 8 chars), optional `name` |
| `POST` | `/api/auth/login` | Body: `email`, `password` |
| `POST` | `/api/auth/logout` | Ends session |
| `GET` | `/api/auth/me` | Current user or 401 |
| `GET` | `/api/auth/google` | Starts Google OAuth (when configured) |

User records are stored in **`data/users.json`** (created at runtime). That directory is gitignored.

## Production notes

- Set `NODE_ENV=production` and serve over **HTTPS** so session cookies can be marked `secure`.
- Replace or migrate the JSON user store before serious scale (e.g. PostgreSQL or a hosted auth provider).
- Keep `.env` out of version control; rotate `SESSION_SECRET` if leaked.

## License

Proprietary — all rights reserved unless otherwise stated by the project owners.
