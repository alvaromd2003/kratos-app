-- Position (as a 0-100 percentage of the floor-plan canvas, so it stays
-- correct at any screen size) for the visual floor-plan view on Barra.
-- Both null means the table hasn't been placed yet — it still shows up
-- in the plain list, just not on the canvas until the owner drags it in.
alter table tables
  add column pos_x numeric,
  add column pos_y numeric;
