-- BingoClaw credit balance per ClawdCare account (integer units; business rules live in app).

alter table public.profiles
  add column if not exists credits integer not null default 0;

comment on column public.profiles.credits is 'BingoClaw credits bound to this profile; purchased on ClawdCare, consumed by BingoClaw-backed features.';
