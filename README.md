# ClawdCare (clawdcare.com)

Official site for **BingoClaw Health Care** / **ClawdCare**: **product** story, **shop** (Hardware, **Programs**, **Credit Plan** monthly subscriptions, **Credit packs** one-time + cart), **Your health** (longitudinal wellness dashboard), **console** preview, **about**, **support**, **legal**, and **My account** (Settings, Preferences, **Billing & subscriptions** including credit balance and Credit Plan line, **Orders**, session)—structured as a single platform toward a personal health management center.

**Product model:** **ClawdCare is built on BingoClaw.** The Shop has four product types: **Hardware** (typically one-time), **Programs** (monthly), **Credit Plan** (monthly subscription that credits a **credit** balance), and **Credit packs** (one-time credit purchase for mid-cycle top-up). **Programs** and **Credit Plan** bill monthly until canceled. Users are **not** asked to choose underlying LLMs—BingoClaw capabilities surface across the product.

## Pages

| Path | Purpose |
|------|---------|
| `/` | Marketing home — positioning, value pillars, CTAs to Product / Shop |
| `/product.html` | Full product story — hero, architecture, 16 capabilities, gallery, science/privacy, market gap |
| `/shop.html` | Product ordering — **Hardware** (`#shop-hardware`), **Programs** (`#shop-programs`), **Credit Plan** (`#shop-credit-plans`), **Credit packs** (`#shop-credit-packs`); shared **cart** (`#shop-cart`), **Place Order** (mailto) |
| `/use.html` | **Your health** — longitudinal wellness dashboard (demo when signed out; personalized stub when signed in): biomarker domains, biological-age style summary, viz, guidance, advanced programs |
| `/console.html` | Control panel preview (public; sign-in optional for future binding) |
| `/about.html` | Company, roadmap, financial sketch from plan |
| `/support.html` | Help & contact |
| `/legal.html` | Wellness / disclaimer summary |
| `/account.html` | **Account** — **Settings**, **Preferences**, **Billing & subscriptions** (credit balance, Programs + Credit Plan tables, **Payment** / **Orders**), payment-methods API (**requires login**) |
| `/login.html`, `/register.html` | Session auth |
| `/admin.html` | **Platform admin** — overview (stats, DB status, config hints), user table with filter & CSV export, refresh (**requires admin**; `noindex`) |
| `/404.html` | Custom not-found (used by Vercel when a path has no file) |

**SEO / discovery:** `sitemap.xml` and `public/robots.txt` (served at `/robots.txt`). Product photography lives in `public/assets/` (product page hero + gallery; home is typographic / layout-first).

## Database (Supabase)

Optional **[Supabase](https://supabase.com/)** Postgres backs registered users when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Otherwise users stay in `data/users.json` (or `/tmp` on Vercel).

1. Create a project on [Supabase](https://supabase.com/).
2. Run migrations in order in the SQL Editor (see `supabase/README.md`): `20250404140000_clawdcare_profiles.sql`, `20250410130000_profiles_credits.sql`, `20250411120000_profiles_subscriptions.sql`, `20250411140000_profiles_payment_methods.sql`.
3. Add the URL and **service_role** key to your server environment (never commit the key; never ship it to the browser).

The Express app continues to own email/password checks (bcrypt + Passport); Supabase stores the `profiles` rows only.

## Admin login（如何进入 `/admin.html`）

Admin 使用**和普通用户同一套账号密码**，没有单独的 “admin 密码”。

### 预设管理员（`admin@clawdcare.com`）

注册页要求密码至少 8 位，短密码需用脚本写入：

```bash
cp .env.example .env   # 若还没有
npm run seed:admin
```

默认会创建或更新：**邮箱** `admin@clawdcare.com`，**密码** `123456`，并赋予 `admin` 角色。  
可用环境变量覆盖：`SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`。

`.env.example` 里已把 `ADMIN_EMAILS=admin@clawdcare.com` 作为示例；线上请改强密码并勿提交真实 `.env`。

### 本地开发（`NODE_ENV` 不是 `production`）

1. 打开 **`/register.html`** 注册一个账号（记下邮箱和密码）。  
2. 打开 **`/login.html?next=/admin.html`** 登录；成功后会进入后台。  
3. **默认规则：** 若 `.env` 里**没有**配置 `ADMIN_EMAILS`（或为空），则**任意已登录用户**都可以访问 `/admin.html`，无需再配环境变量。  
4. 若你配了 `ADMIN_DEV_OPEN=0` 或 `STRICT_ADMIN=1`，则不再使用上述宽松策略：需要把邮箱写进 `ADMIN_EMAILS`，或在数据里给该用户 `admin` 角色。  
5. 终端启动时会打印一行 `[clawdcare] Admin: ...` 提示。

### 线上（production，如 Vercel）

- **必须**在环境变量里设置 `ADMIN_EMAILS=你的运营邮箱`（与登录邮箱一致），**或**在数据库 / `profiles` 里给该用户 `roles` 包含 `admin`。  
- 仅靠 “本地默认” 不会生效：生产环境不会开启宽松模式。

### 仍然进不去？

- 确认是**先登录**再打开 `/admin.html`；不要只打开后台地址。  
- 若登录后立刻掉线：检查是否把 `NODE_ENV=production` 配在本地 HTTP 上（会导致 `secure` Cookie 不发送）；本地请保持非 production 或使用 HTTPS。  
- 使用 Supabase 时，确认该邮箱已在 `profiles` 里注册成功（注册接口无报错）。

## Local development

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

Open `http://localhost:3000`.

## Deploy (Vercel)

- **Why `/about.html` showed the homepage:** On Vercel, static hosting does **not** mirror local Express (which serves both repo-root **`*.html`** and **`public/`** at the same URL root). If the deployment only exposed part of the tree—or every path hit the API—`/about.html` could resolve to the wrong file (often **`index.html`**).  
- **Fix in this repo:** `npm run build` runs **`scripts/vercel-build.js`**, which writes **`dist/`** = **`public/`** plus all root **`*.html`** and **`sitemap.xml`**. **`vercel.json`** sets **`outputDirectory`: `dist`** and **`framework`: `null`** (“Other”) so Vercel treats **`dist/`** as **static files**, not an Express server bundle (avoids “No entrypoint found in output directory”).  
- **`/api/:path*`** → **`/api`** only. Do **not** add **`/(.*)` → `/api`** in the dashboard; that routes the whole site through Express and breaks multi-page HTML.
- **`functions.api.index.js.includeFiles`** still bundles **`*.html`** and **`public/**`** for the serverless API (sessions/auth) if a request hits the function.
- Set **`SESSION_SECRET`** (and optionally **`BASE_URL`** for your production URL) in the Vercel project environment.
- **`REDIS_URL` (required for auth on Vercel):** Each API invocation may run on a different instance; the default in-memory session store does **not** share state, so `/api/auth/me` often returns **401** even right after login. Create a free **[Upstash Redis](https://upstash.com/)** database, copy the **`rediss://…`** URL (Redis protocol, not the REST URL), and add it as **`REDIS_URL`** in Vercel. The app uses **`connect-redis` + `ioredis`** when this variable is set.
- **`GET /api/auth/me` → 401** when you are **not** signed in is normal (nav and guarded pages probe the session). If you **are** signed in and still see 401 on every load, fix **`REDIS_URL`** + **`SESSION_SECRET`** as above.
- **Admin:** In **production**, set `ADMIN_EMAILS` to operator emails and/or assign the `admin` role in storage. In **non-production**, if `ADMIN_EMAILS` is **empty**, any signed-in user can open `/admin.html` (local default). Opt out with `STRICT_ADMIN=1` or `ADMIN_DEV_OPEN=0` (see `.env.example`).
- **There is no separate “admin password”.** Same email/password as site sign-in.
- Demo users are stored in `/tmp` on serverless unless **Supabase** env vars are set; prefer Supabase (or another DB) for production.

UI colors follow **bingoclaw.cn** (same palette): background `#0a0e14`, text `#e8edf4`, accent `#f97316` / `#ea580c`.

## Content source

Marketing copy is derived from **BingoClaw_HealthCare_Business_Plan_V3.0_Pretty.html** (March 30, 2026). Figures and roadmap rows are **illustrative** unless updated by the company.
