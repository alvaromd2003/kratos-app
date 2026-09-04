-- New enum value on its own — Postgres won't let a value be used in the
-- same transaction/script that adds it, so this has to run by itself
-- before 0011 (which relies on 'waiter' existing).
alter type restaurant_role add value 'waiter';
