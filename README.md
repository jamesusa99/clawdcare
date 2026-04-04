# ClawdCare (clawdcare.com)

Official marketing and account site for **BingoClaw Health Care** (business plan V3.0 narrative): product story, **shop** (cart + mailto checkout), **console** preview, **about**, **support**, **legal**, and **My account** (email/password auth).

## Pages

| Path | Purpose |
|------|---------|
| `/` | Product introduction — 16 capabilities, market gap, science/privacy |
| `/shop.html` | Purchase flow — SKUs, localStorage cart, email order handoff |
| `/console.html` | Control panel preview (public; sign-in optional for future binding) |
| `/about.html` | Company, roadmap, financial sketch from plan |
| `/support.html` | Help & contact |
| `/legal.html` | Wellness / disclaimer summary |
| `/account.html` | **My** — profile, cart snapshot (**requires login**) |
| `/login.html`, `/register.html` | Session auth |
| `/404.html` | Custom not-found (used by Vercel when a path has no file) |

**SEO / discovery:** `sitemap.xml` and `public/robots.txt` (served at `/robots.txt`). Product illustrations live in `public/assets/` as SVGs referenced from the homepage.

## Local development

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

Open `http://localhost:3000`.

## Deploy (Vercel)

- Shared assets live under **`public/`** (`css/`, `js/`, `assets/*.svg`, `favicon.svg`, `robots.txt`) so Vercel’s static layer serves them at `/css/...`, `/js/...`, `/assets/...`, etc. (filesystem wins before rewrites).
- `vercel.json` only rewrites **`/api/:path*`** → `/api` (Express for auth/session APIs). HTML at the repo root is deployed as static files the same way.
- Set `SESSION_SECRET` (and optionally `BASE_URL` for your production URL) in the Vercel project environment.
- Demo users are stored in `/tmp` on serverless; use a real database for production.

UI colors follow **bingoclaw.cn** tokens: background `#0a0e14`, text `#e8edf4`, accent `#f97316` / `#ea580c`.

## Content source

Marketing copy is derived from **BingoClaw_HealthCare_Business_Plan_V3.0_Pretty.html** (March 30, 2026). Figures and roadmap rows are **illustrative** unless updated by the company.
