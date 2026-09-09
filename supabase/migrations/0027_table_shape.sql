-- Visual shape for the floor-plan chip (round or square table), purely
-- cosmetic — helps staff recognize a table at a glance on the plan.
-- Defaults to 'round' so every existing table renders exactly as it does
-- today until the owner changes it.
alter table tables
  add column shape text not null default 'round' check (shape in ('round', 'square'));
