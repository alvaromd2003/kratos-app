-- Which of the optional payment methods (beyond card, always offered) a
-- restaurant wants to accept — the owner's choice, not ours. Defaults to
-- bizum so the pilot restaurant already tested with it doesn't lose it
-- silently; new restaurants can just untick it in Ajustes if unwanted.
alter table restaurants
  add column enabled_payment_methods text[] not null default array['bizum'];
