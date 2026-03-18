CREATE OR REPLACE FUNCTION public.admin_get_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_name TEXT;
  v_secret TEXT;
BEGIN
  -- Allow trusted server-side calls (service_role) OR authenticated admins
  IF auth.role() <> 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = v_vault_name;

  RETURN v_secret;
END;
$function$;