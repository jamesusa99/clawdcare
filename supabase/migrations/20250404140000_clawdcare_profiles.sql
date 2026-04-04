-- ClawdCare: application user profiles (Passport.js email/password on the Node server).
-- The API uses SUPABASE_SERVICE_ROLE_KEY only (never expose to the browser).
-- Docs: https://supabase.com/docs

-- gen_random_uuid() is available in Supabase Postgres by default.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  name text,
  roles text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'ClawdCare registered users; credentials verified by Express + bcrypt.';

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(trim(email)));

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

alter table public.profiles enable row level security;

-- No policies for anon/authenticated: they cannot read rows. The service role (backend API) bypasses RLS.
-- If you later use Supabase Auth, add policies (e.g. users read/update own profile only).

grant all on table public.profiles to postgres, service_role;
