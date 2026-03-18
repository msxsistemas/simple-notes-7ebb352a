-- Add gateway column to produtos table (nullable = use global gateway)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT NULL;
