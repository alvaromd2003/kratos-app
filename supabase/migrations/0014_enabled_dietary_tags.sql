-- Lets the owner turn off dietary/allergen tags that don't apply to their
-- menu, instead of always showing all 5 fixed options on every dish.
-- Defaults to all 5 enabled so nothing changes for existing restaurants.
alter table restaurants
  add column enabled_dietary_tags text[] not null default array[
    'sin_gluten', 'vegano', 'vegetariano', 'sin_frutos_secos', 'sin_lactosa'
  ];
