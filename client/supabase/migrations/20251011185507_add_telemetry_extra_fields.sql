ALTER TABLE public.telemetry
ADD COLUMN progress numeric,
ADD COLUMN temperature double precision,
ADD COLUMN current double precision,
ADD COLUMN voltage double precision;