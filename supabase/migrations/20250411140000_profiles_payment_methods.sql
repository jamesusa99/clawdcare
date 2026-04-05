-- Saved card summaries + billing snapshots (no full PAN/CVC — production should use Stripe/etc.)

alter table public.profiles
  add column if not exists payment_methods jsonb not null default '[]'::jsonb;

comment on column public.profiles.payment_methods is 'Array of { id, brand, last4, exp_month, exp_year, card_country, card_postal_code, billing, is_default, created_at }; managed by Express /api/me/payment-methods.';
