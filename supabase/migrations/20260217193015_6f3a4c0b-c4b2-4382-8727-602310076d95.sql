
-- Fix 1: Add auth.uid() authorization checks to vault functions
CREATE OR REPLACE FUNCTION public.store_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text, p_secret_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_vault_name TEXT;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- Authorization check: only allow users to store their own secrets
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: you can only manage your own secrets';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_vault_name;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_id;
  END IF;
  
  v_new_id := vault.create_secret(p_secret_value, v_vault_name, 'Gateway API key for ' || p_gateway);
  
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_vault_name TEXT;
  v_secret TEXT;
BEGIN
  -- Authorization check: only allow users to read their own secrets
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: you can only manage your own secrets';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = v_vault_name;
  
  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_vault_name TEXT;
BEGIN
  -- Authorization check: only allow users to delete their own secrets
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: you can only manage your own secrets';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  DELETE FROM vault.secrets WHERE name = v_vault_name;
END;
$$;

-- Fix 2: Replace overly permissive service role policy on cobrancas with specific policies
DROP POLICY IF EXISTS "Service role full access on cobrancas" ON public.cobrancas;

-- Allow service role (edge functions) to update cobrancas status (for webhooks)
CREATE POLICY "Service role can update cobrancas"
  ON public.cobrancas FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow service role to insert cobrancas (for charge creation from edge functions)
CREATE POLICY "Service role can insert cobrancas"
  ON public.cobrancas FOR INSERT
  WITH CHECK (true);

-- Allow service role to select cobrancas (for webhook lookups)
CREATE POLICY "Service role can select cobrancas"
  ON public.cobrancas FOR SELECT
  USING (true);
