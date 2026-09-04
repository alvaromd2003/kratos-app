-- Routes each dish to the station that actually prepares it — food to the
-- kitchen, drinks to the bar — instead of every item landing on one shared
-- "Cocina" ticket regardless of what it actually is.
alter table menu_categories add column station text not null default 'kitchen'
  check (station in ('kitchen', 'bar'));
