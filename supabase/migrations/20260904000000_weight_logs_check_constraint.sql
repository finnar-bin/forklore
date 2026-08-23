-- weight_logs.weight_kg had no range constraint — RLS only restricts which
-- rows a caller can write, not the values within them, and the client-side
-- min/max on LogWeightDialog's number input is a UI affordance only,
-- trivially bypassed by a direct authenticated insert. Bounds are generous
-- (well outside any real adult human weight) purely to reject typos/garbage,
-- not to second-guess legitimate values.
alter table public.weight_logs
  add constraint weight_logs_weight_kg_range check (weight_kg > 0 and weight_kg < 500);
