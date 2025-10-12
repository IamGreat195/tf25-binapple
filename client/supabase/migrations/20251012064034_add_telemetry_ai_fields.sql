ALTER TABLE public.telemetry
ADD COLUMN infection_score numeric,
ADD COLUMN weed_score numeric,
ADD COLUMN yield_score numeric;