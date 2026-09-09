-- Optional zone tag per table, so a restaurant with tables spread across
-- distinct areas can filter the floor plan instead of seeing every table
-- crammed onto one canvas. Null means "no zone assigned" — every table
-- keeps showing under "Todas" exactly as before until the owner opts in.
alter table tables
  add column zone text check (zone in ('interior', 'terraza', 'barra'));
