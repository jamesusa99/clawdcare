# Supabase (ClawdCare)

Postgres schema for **registered users** used by the ClawdCare Express API (`profiles` table).

## Create a project

1. Open [Supabase](https://supabase.com/) and create a project.
2. In **SQL Editor**, run the migration in `migrations/20250404140000_clawdcare_profiles.sql` (or use [Supabase migrations](https://supabase.com/docs/guides/cli/local-development)).

## Environment variables (server only)

| Variable | Where to find it |
|----------|------------------|
| `SUPABASE_URL` | Project **Settings → API → Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Settings → API → service_role** (secret; server-side only) |

When both are set, ClawdCare uses Supabase for users. If either is missing, it falls back to `data/users.json` (or `/tmp` on Vercel).

Do **not** put the service role key in frontend code or public env vars.

## Optional: Supabase Auth later

This schema is independent of `auth.users`. You can later link rows or migrate to Supabase Auth; add RLS policies that match your auth model.
