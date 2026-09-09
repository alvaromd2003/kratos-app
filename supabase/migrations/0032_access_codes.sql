-- Replaces the single shared SIGNUP_ACCESS_CODE env var with a real
-- table of codes: normal codes are single-use (used_at set the moment
-- someone signs up with one), "generic" codes (is_generic = true) never
-- get marked used, so they can be reused indefinitely — for the owner's
-- own repeated testing, without burning a real prospect's code and
-- without ever applying a trial countdown to what it creates (see
-- createRestaurant, which only sets trial_ends_at for non-generic codes).
create table access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  is_generic boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only ever read/written server-side via the service-role client
-- (signup, createRestaurant) — no RLS policies, same reasoning as
-- loyalty_accounts (migration 0020): letting the anon key list codes
-- would let anyone try every unused one.
alter table access_codes enable row level security;

insert into access_codes (code) values
  ('KRATOS-APYNYC'), ('KRATOS-SXBYB5'), ('KRATOS-JG8KN6'), ('KRATOS-SQCP7X'),
  ('KRATOS-CD7E2F'), ('KRATOS-9E964W'), ('KRATOS-BNFT7B'), ('KRATOS-Z6TSUD'),
  ('KRATOS-DFW3PU'), ('KRATOS-2U89QY'), ('KRATOS-9NPCN9'), ('KRATOS-WGC7M6'),
  ('KRATOS-V9VXSA'), ('KRATOS-46HRNF'), ('KRATOS-WJJVAA'), ('KRATOS-Q2M3ZX'),
  ('KRATOS-SKR85Q'), ('KRATOS-HDKTZ9'), ('KRATOS-W3EW4E'), ('KRATOS-D2496X'),
  ('KRATOS-JBBPF4'), ('KRATOS-TVQNBH'), ('KRATOS-Q5VEXK'), ('KRATOS-ZDJXPP'),
  ('KRATOS-BTQGDY');

insert into access_codes (code, is_generic) values ('KRATOS-ALPHA-TEST', true);
