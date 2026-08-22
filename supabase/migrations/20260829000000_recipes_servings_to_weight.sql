-- Requested directly: recipes are now defined by total weight (grams)
-- rather than a serving count. See docs/pending-deviations.md (Ticket 12
-- follow-up, "servings -> weight").
--
-- No default carried over — `default 1` made sense for a serving count but
-- not for a weight, and the client always supplies weight_g at insert time
-- (RecipeForm requires it), so there's no gap to fill with a default.
alter table public.recipes rename column servings to weight_g;
alter table public.recipes alter column weight_g type numeric using weight_g::numeric;
alter table public.recipes alter column weight_g drop default;
