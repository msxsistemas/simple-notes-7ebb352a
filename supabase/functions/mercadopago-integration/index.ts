import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MP_BASE_URL = 'https://api.mercadopago.com';

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function cleanToken(raw: string): string {
  return String(raw ?? '').trim().replace(/^['"\s]+|['"\s]+$/g, '');
}

async function validateMercadoPagoAccessToken(accessToken: string): Promise<{ valid: boolean; detail?: string; accountInfo?: any }> {
  if (!accessToken) {
    return { valid: false, detail: 'Access Token vazio após limpeza.' };
  }

  if (!accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
    return {
      valid: false,
      detail: 'Formato de token inválido. Use Access Token (APP_USR-... ou TEST-...), não Public Key.',
    };
  }

  try {
    const resp = await fetch(`${MP_BASE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const body = await resp.json().catch(() => ({}));

    if (resp.ok && body.id) {
      return {
        valid: true,
        accountInfo: {
          id: body.id,
          nickname: body.nickname || null,
          email: body.email || null,
          site_id: body.site_id || null,
        },
      };
    }

    return {
      valid: false,
      detail: `Mercado Pago rejeitou o token (HTTP ${resp.status}). Verifique se está usando credenciais de produção.`,
    };
  } catch (err: any) {
    return { valid: false, detail: `Erro de rede ao validar token: ${err?.message || 'desconhecido'}` };
  }
}

// ──────────────────────────────────────────────
// Vault Helpers
// ──────────────────────────────────────────────

async function getVaultSecret(supabaseAdmin: any, userId: string, gateway: string, secretName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('admin_get_gateway_secret', {
    p_user_id: userId,
    p_gateway: gateway,
    p_secret_name: secretName,
  });
  if (error) {
    console.error('Vault read error:', error.message);
    return null;
  }
  return data;
}

async function storeVaultSecretForUser(supabaseUser: any, userId: string, gateway: string, secretName: string, secretValue: string): Promise<void> {
  const { error } = await supabaseUser.rpc('store_gateway_secret', {
    p_user_id: userId,
    p_gateway: gateway,
    p_secret_name: secretName,
    p_secret_value: secretValue,
  });
  if (error) throw new Error('Vault store error: ' + error.message);
}

// ──────────────────────────────────────────────
// Auto-renewal trigger
// ──────────────────────────────────────────────

async function triggerAutoRenewal(userId: string, clienteWhatsapp: string, gateway: string, chargeId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/auto-renew-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ user_id: userId, cliente_whatsapp: clienteWhatsapp, gateway, gateway_charge_id: chargeId }),
    });
    const data = await resp.json();
    console.log(`🔄 Auto-renewal result for ${clienteWhatsapp}:`, JSON.stringify(data));
    return data;
  } catch (err: any) {
    console.error(`❌ Auto-renewal failed for ${clienteWhatsapp}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// Webhook Handler
// ──────────────────────────────────────────────

async function handleWebhook(body: any, supabaseAdmin: any) {
  const paymentId = body.data?.id;
  if (!paymentId) {
    console.warn('⚠️ MP Webhook sem payment ID');
    return { success: true, message: 'No payment ID' };
  }

  console.log(`📩 MP Webhook: type=${body.type || body.action}, paymentId=${paymentId}`);

  // Verify payment with API
  const { data: mpConfigs } = await supabaseAdmin
    .from('mercadopago_config')
    .select('user_id')
    .eq('is_configured', true)
    .limit(10);

  let paymentData: any = null;
  let verifiedUserId: string | null = null;

  if (mpConfigs) {
    for (const cfg of mpConfigs) {
      try {
        const token = await getVaultSecret(supabaseAdmin, cfg.user_id, 'mercadopago', 'access_token');
        if (!token) continue;
        const verifyResp = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (verifyResp.ok) {
          paymentData = await verifyResp.json();
          verifiedUserId = cfg.user_id;
          break;
        }
      } catch { /* try next config */ }
    }
  }

  if (!paymentData) {
    console.warn(`⚠️ Não foi possível verificar pagamento ${paymentId} - aceito sem processar`);
    return { success: true, message: 'Payment not verifiable, acknowledged' };
  }

  console.log(`✅ MP webhook verificado: status=${paymentData.status}, valor=${paymentData.transaction_amount}`);

  if (paymentData.status !== 'approved') {
    console.log(`ℹ️ Pagamento ${paymentId} com status "${paymentData.status}" - ignorando`);
    return { success: true, message: `Payment status: ${paymentData.status}` };
  }

  // Process approved payment
  const chargeId = String(paymentId);
  const nowIso = new Date().toISOString();
  let shouldTriggerAutoRenew = false;
  let ownerUserId: string | null = null;
  let clienteWhatsapp: string | null = null;

  // Atomic update on cobrancas
  const { data: updatedCobranca } = await supabaseAdmin
    .from('cobrancas')
    .update({ status: 'pago', renovado: true, updated_at: nowIso })
    .eq('gateway', 'mercadopago')
    .eq('gateway_charge_id', chargeId)
    .eq('status', 'pendente')
    .select('id, user_id, cliente_whatsapp')
    .maybeSingle();

  if (updatedCobranca) {
    shouldTriggerAutoRenew = true;
    ownerUserId = updatedCobranca.user_id;
    clienteWhatsapp = updatedCobranca.cliente_whatsapp;
    console.log(`✅ Cobranca ${updatedCobranca.id} paga (atomic)`);
  }

  // Also check faturas
  const { data: updatedFatura } = await supabaseAdmin
    .from('faturas')
    .update({ status: 'pago', paid_at: nowIso, updated_at: nowIso })
    .eq('gateway', 'mercadopago')
    .eq('gateway_charge_id', chargeId)
    .eq('status', 'pendente')
    .select('id, user_id, cliente_whatsapp')
    .maybeSingle();

  if (updatedFatura) {
    shouldTriggerAutoRenew = true;
    ownerUserId = ownerUserId || updatedFatura.user_id;
    clienteWhatsapp = clienteWhatsapp || updatedFatura.cliente_whatsapp;
    console.log(`✅ Fatura ${updatedFatura.id} paga via MP webhook`);
  }

  if (shouldTriggerAutoRenew && ownerUserId && clienteWhatsapp) {
    await triggerAutoRenewal(ownerUserId, clienteWhatsapp, 'mercadopago', chargeId);
  } else if (!updatedCobranca && !updatedFatura) {
    console.log(`ℹ️ Pagamento ${chargeId} já processado ou sem registro correspondente`);
  }

  return { success: true };
}

// ──────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = {};
    if (req.method === 'POST') {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Webhook from Mercado Pago ──
    if (body.type === 'payment' || body.action === 'payment.updated' || body.action === 'payment.created') {
      const result = await handleWebhook(body, supabaseAdmin);
      return new Response(JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Authenticated API actions ──
    const action = body.action;
    console.log('🎯 Action:', action);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    switch (action) {
      case 'configure': {
        const normalizedAccessToken = cleanToken(body.accessToken);
        const normalizedPublicKey = String(body.publicKey ?? '').trim();

        if (!normalizedAccessToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access Token é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const validation = await validateMercadoPagoAccessToken(normalizedAccessToken);

        if (!validation.valid) {
          console.error('❌ MP validation failed:', validation.detail);
          return new Response(
            JSON.stringify({ success: false, error: validation.detail || 'Access Token inválido' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        console.log('✅ MP token válido. Conta:', JSON.stringify(validation.accountInfo));

        // Store in Vault
        await storeVaultSecretForUser(supabaseUser, user.id, 'mercadopago', 'access_token', normalizedAccessToken);

        if (normalizedPublicKey) {
          await storeVaultSecretForUser(supabaseUser, user.id, 'mercadopago', 'public_key', normalizedPublicKey);
        }

        // Upsert config
        const { data: existing } = await supabaseAdmin
          .from('mercadopago_config')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const configData = {
          access_token_hash: 'vault',
          public_key_hash: normalizedPublicKey ? 'vault' : null,
          webhook_url: body.webhookUrl || null,
          is_configured: true,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabaseAdmin.from('mercadopago_config').update(configData).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('mercadopago_config').insert({ user_id: user.id, ...configData });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Mercado Pago configurado com sucesso',
            account: validation.accountInfo,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-pix': {
        const { valor, descricao, cliente_nome, cliente_email, plano_nome } = body;

        if (!valor) {
          return new Response(
            JSON.stringify({ success: false, error: 'Valor é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const accessToken = await getVaultSecret(supabaseAdmin, user.id, 'mercadopago', 'access_token');

        if (!accessToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Mercado Pago não configurado. Configure primeiro em Financeiro → Mercado Pago.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const idempotencyKey = crypto.randomUUID();
        const amount = parseFloat(valor);
        if (isNaN(amount) || amount <= 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Valor inválido' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const itemTitle = plano_nome || descricao || 'Assinatura de Serviço';
        const nameParts = (cliente_nome || 'Cliente').split(' ');
        const firstName = nameParts[0] || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || firstName;

        console.log(`💳 Criando PIX MP: R$${amount.toFixed(2)} para ${cliente_nome || 'Cliente'}`);

        const paymentResp = await fetch(`${MP_BASE_URL}/v1/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            transaction_amount: amount,
            description: itemTitle,
            payment_method_id: 'pix',
            external_reference: idempotencyKey,
            payer: {
              email: cliente_email || `${Date.now()}@placeholder.com`,
              first_name: firstName,
              last_name: lastName,
            },
            additional_info: {
              items: [
                {
                  id: idempotencyKey.substring(0, 8),
                  title: itemTitle,
                  description: `Cobrança - ${itemTitle}`,
                  category_id: 'services',
                  quantity: 1,
                  unit_price: amount,
                },
              ],
              payer: {
                first_name: firstName,
                last_name: lastName,
              },
            },
          }),
        });

        const paymentData = await paymentResp.json();

        if (!paymentResp.ok) {
          const errMsg = paymentData.message || paymentData.cause?.[0]?.description || 'Erro ao criar pagamento PIX';
          console.error(`❌ MP create-pix error (HTTP ${paymentResp.status}):`, JSON.stringify(paymentData).substring(0, 300));
          return new Response(
            JSON.stringify({ success: false, error: errMsg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        const txData = paymentData.point_of_interaction?.transaction_data;
        console.log(`✅ PIX MP criado: id=${paymentData.id}, status=${paymentData.status}`);

        return new Response(
          JSON.stringify({
            success: true,
            charge_id: String(paymentData.id),
            pix_qr_code: txData?.qr_code_base64 || null,
            pix_copia_cola: txData?.qr_code || null,
            status: paymentData.status,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-payment': {
        const { payment_id } = body;
        if (!payment_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'payment_id é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const accessToken = await getVaultSecret(supabaseAdmin, user.id, 'mercadopago', 'access_token');
        if (!accessToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Mercado Pago não configurado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const resp = await fetch(`${MP_BASE_URL}/v1/payments/${payment_id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await resp.json();

        if (!resp.ok) {
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao consultar pagamento: HTTP ${resp.status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: data.status,
            status_detail: data.status_detail,
            amount: data.transaction_amount,
            date_approved: data.date_approved,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida', available: ['configure', 'create-pix', 'check-payment'] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error: any) {
    console.error('🚨 MP Integration Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
