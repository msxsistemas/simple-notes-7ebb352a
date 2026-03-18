-- Track registration IPs to limit 2 accounts per IP
CREATE TABLE IF NOT EXISTS public.registration_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast IP lookups
CREATE INDEX IF NOT EXISTS idx_registration_ips_ip ON public.registration_ips(ip_address);

-- RLS: only service role can access
ALTER TABLE public.registration_ips ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role (edge functions) can read/write
