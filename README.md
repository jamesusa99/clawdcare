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

## Local development

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

Open `http://localhost:3000`.

## Deploy (Vercel)

- `vercel.json` only rewrites `/api/*` to the Node serverless function.
- Static HTML/CSS/JS is served from the repo root by the CDN.
- Set `SESSION_SECRET` (and optionally `BASE_URL` for your production URL) in the Vercel project environment.
- Demo users are stored in `/tmp` on serverless; use a real database for production.

## Content source

Marketing copy is derived from **BingoClaw_HealthCare_Business_Plan_V3.0_Pretty.html** (March 30, 2026). Figures and roadmap rows are **illustrative** unless updated by the company.
