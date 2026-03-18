ALTER TABLE public.checkout_config
ADD COLUMN pix_manual_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN pix_manual_key text;