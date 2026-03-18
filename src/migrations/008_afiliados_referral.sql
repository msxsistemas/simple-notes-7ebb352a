-- Migration: Affiliate referral system
-- Add invite code to user config and user reference to affiliate network

-- 1. Add invite code to user config
ALTER TABLE afiliados_usuarios_config 
ADD COLUMN IF NOT EXISTS codigo_convite text UNIQUE;

-- 2. Add user reference and denormalized info to affiliate network
ALTER TABLE afiliados_rede
ADD COLUMN IF NOT EXISTS afiliado_user_id uuid,
ADD COLUMN IF NOT EXISTS afiliado_nome text,
ADD COLUMN IF NOT EXISTS afiliado_email text;

-- 3. Generate codes for existing configs
UPDATE afiliados_usuarios_config 
SET codigo_convite = 'AFF_' || upper(substr(md5(random()::text || id::text), 1, 10))
WHERE codigo_convite IS NULL;

-- 4. Update profile creation function to also handle affiliate linking on registration
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref_code text;
  v_owner_id uuid;
  v_parent_record record;
  v_n3_max numeric;
  v_user_name text;
  v_user_email text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, nome_completo, nome_empresa)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    ''
  );

  -- Handle affiliate referral
  v_ref_code := NEW.raw_user_meta_data->>'referral_code';
  v_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_user_email := COALESCE(NEW.email, '');
  
  IF v_ref_code IS NOT NULL AND v_ref_code != '' THEN
    -- Check if it's a user's direct affiliate code (creates N2)
    SELECT user_id INTO v_owner_id
    FROM afiliados_usuarios_config
    WHERE codigo_convite = v_ref_code AND afiliados_liberado = true
    LIMIT 1;
    
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO afiliados_rede (user_id, afiliado_user_id, afiliado_nome, afiliado_email, pai_id, nivel, codigo_convite, comissao_tipo, comissao_valor)
      SELECT v_owner_id, NEW.id, v_user_name, v_user_email, NULL, 2,
             'AFF_' || upper(substr(md5(random()::text || NEW.id::text), 1, 10)),
             auc.comissao_tipo, auc.comissao_valor
      FROM afiliados_usuarios_config auc
      WHERE auc.user_id = v_owner_id;
    ELSE
      -- Check if it's an N2 affiliate's invite code (creates N3)
      SELECT * INTO v_parent_record
      FROM afiliados_rede
      WHERE codigo_convite = v_ref_code AND ativo = true AND nivel = 2
      LIMIT 1;
      
      IF v_parent_record IS NOT NULL THEN
        SELECT n3_valor INTO v_n3_max FROM afiliados_niveis_config WHERE id = 1;
        
        INSERT INTO afiliados_rede (user_id, afiliado_user_id, afiliado_nome, afiliado_email, pai_id, nivel, codigo_convite, comissao_tipo, comissao_valor)
        VALUES (v_parent_record.user_id, NEW.id, v_user_name, v_user_email, v_parent_record.id, 3,
                'AFF_' || upper(substr(md5(random()::text || NEW.id::text), 1, 10)),
                v_parent_record.comissao_tipo,
                LEAST(v_parent_record.comissao_valor, COALESCE(v_n3_max, v_parent_record.comissao_valor)));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
