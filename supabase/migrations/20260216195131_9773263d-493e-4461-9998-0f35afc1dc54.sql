
-- Helper function to store a gateway secret in Supabase Vault
-- Uses SECURITY DEFINER to access vault schema
CREATE OR REPLACE FUNCTION public.store_gateway_secret(
  p_user_id UUID,
  p_gateway TEXT,
  p_secret_name TEXT,
  p_secret_value TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_name TEXT;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- Build unique vault secret name: gw_{gateway}_{secret_name}_{user_id}
  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  -- Check if secret already exists and delete it
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_vault_name;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_id;
  END IF;
  
  -- Create new vault secret
  v_new_id := vault.create_secret(p_secret_value, v_vault_name, 'Gateway API key for ' || p_gateway);
  
  RETURN v_new_id;
END;
$$;

-- Helper function to retrieve a gateway secret from Supabase Vault
CREATE OR REPLACE FUNCTION public.get_gateway_secret(
  p_user_id UUID,
  p_gateway TEXT,
  p_secret_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_name TEXT;
  v_secret TEXT;
BEGIN
  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = v_vault_name;
  
  RETURN v_secret;
END;
$$;

-- Helper function to delete a gateway secret from Supabase Vault
CREATE OR REPLACE FUNCTION public.delete_gateway_secret(
  p_user_id UUID,
  p_gateway TEXT,
  p_secret_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_name TEXT;
BEGIN
  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  DELETE FROM vault.secrets WHERE name = v_vault_name;
END;
$$;

-- Migrate existing base64-encoded keys to Vault

-- Migrate MercadoPago keys
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id, access_token_hash FROM mercadopago_config WHERE access_token_hash IS NOT NULL AND access_token_hash != '' LOOP
    -- Decode base64 and store in vault
    PERFORM public.store_gateway_secret(r.user_id, 'mercadopago', 'access_token', convert_from(decode(r.access_token_hash, 'base64'), 'UTF8'));
  END LOOP;
END $$;

-- Migrate Ciabra keys
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id, api_key_hash, public_key_hash FROM ciabra_config WHERE api_key_hash IS NOT NULL AND api_key_hash != '' LOOP
    PERFORM public.store_gateway_secret(r.user_id, 'ciabra', 'api_key', convert_from(decode(r.api_key_hash, 'base64'), 'UTF8'));
    IF r.public_key_hash IS NOT NULL AND r.public_key_hash != '' THEN
      PERFORM public.store_gateway_secret(r.user_id, 'ciabra', 'public_key', convert_from(decode(r.public_key_hash, 'base64'), 'UTF8'));
    END IF;
  END LOOP;
END $$;

-- Migrate V3Pay keys (stored as plaintext, not base64)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id, api_token_hash FROM v3pay_config WHERE api_token_hash IS NOT NULL AND api_token_hash != '' LOOP
    PERFORM public.store_gateway_secret(r.user_id, 'v3pay', 'api_token', r.api_token_hash);
  END LOOP;
END $$;

-- Now clear the plaintext/base64 values from config tables
-- Set them to 'vault' marker to indicate keys are in vault
UPDATE mercadopago_config SET access_token_hash = 'vault' WHERE access_token_hash IS NOT NULL AND access_token_hash != '' AND access_token_hash != 'vault';
UPDATE ciabra_config SET api_key_hash = 'vault' WHERE api_key_hash IS NOT NULL AND api_key_hash != '' AND api_key_hash != 'vault';
UPDATE ciabra_config SET public_key_hash = 'vault' WHERE public_key_hash IS NOT NULL AND public_key_hash != '' AND public_key_hash != 'vault';
UPDATE v3pay_config SET api_token_hash = 'vault' WHERE api_token_hash IS NOT NULL AND api_token_hash != '' AND api_token_hash != 'vault';
