-- Per-user subscription lines (Programs + Token plans) for account Subscriptions UI and billing prep.

alter table public.profiles
  add column if not exists subscriptions jsonb not null default '[]'::jsonb;

comment on column public.profiles.subscriptions is 'Array of { id, kind, name, cycle, price_cents, next_renewal, status }; managed by Express /api/me/subscriptions.';
