import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const V3PAY_BASE_URL = 'https://api.v3pay.com.br/v1';

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

async function storeVaultSecret(userToken: string, userId: string, gateway: string, secretName: string, secretValue: string): Promise<void> {
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  );
  
  const { error } = await userClient.rpc('store_gateway_secret', {
    p_user_id: userId,
    p_gateway: gateway,
    p_secret_name: secretName,
    p_secret_value: secretValue,
  });
  
  if (error) {
    console.error('store_gateway_secret failed:', error.message);
    throw new Error('Vault store error: ' + error.message);
  }
}

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
    console.error(`❌ Auto-renewal failed:`, err.message);
    return { success: false, error: err.message };
  }
}

async function handleWebhook(body: any, supabaseAdmin: any) {
  const { event, data } = body;

  console.log('📩 V3Pay Webhook received:', JSON.stringify(body).substring(0, 500));

  // Accept test webhooks
  if (event === 'webhook.test' || event === 'test') {
    console.log('🧪 Test webhook received - accepting');
    return new Response(JSON.stringify({ success: true, message: 'Test webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (event !== 'order.paid') {
    console.log(`ℹ️ V3Pay event "${event}" - acknowledged`);
    return new Response(JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // order.paid — process payment confirmation (Woovi pattern)
  console.log('💰 Order paid:', JSON.stringify(data || body).substring(0, 500));

  const chargeId = String(data?.id || data?.order_id || data?.charge_id || body.id || body.order_id || '');
  if (!chargeId || chargeId.length < 1) {
    console.warn('⚠️ V3Pay webhook: missing charge ID');
    return new Response(JSON.stringify({ error: 'Missing charge ID' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Look up charge in cobrancas and faturas (same as Woovi)
  const { data: cobranca } = await supabaseAdmin
    .from('cobrancas')
    .select('id, user_id, cliente_whatsapp, status')
    .eq('gateway_charge_id', chargeId)
    .eq('gateway', 'v3pay')
    .maybeSingle();

  const { data: fatura } = await supabaseAdmin
    .from('faturas')
    .select('id, user_id, cliente_whatsapp, status')
    .eq('gateway_charge_id', chargeId)
    .eq('gateway', 'v3pay')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cobranca && !fatura) {
    console.warn(`V3Pay webhook: no matching records for chargeId: ${chargeId}`);
    return new Response(JSON.stringify({ error: 'Unknown charge' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
  }

  const ownerUserId = cobranca?.user_id || fatura?.user_id;
  const clienteWhatsapp = cobranca?.cliente_whatsapp || fatura?.cliente_whatsapp;

  // Verify user has V3Pay configured
  const { data: v3Config } = await supabaseAdmin
    .from('v3pay_config')
    .select('id')
    .eq('user_id', ownerUserId)
    .eq('is_configured', true)
    .maybeSingle();

  if (!v3Config) {
    console.warn(`V3Pay webhook: no active v3pay config for user ${ownerUserId}`);
    return new Response(JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
  }

  let shouldTriggerAutoRenew = false;

  if (cobranca && cobranca.status !== 'pago') {
    const { data: updatedCobranca } = await supabaseAdmin
      .from('cobrancas')
      .update({ status: 'pago', renovado: true, updated_at: nowIso })
      .eq('id', cobranca.id)
      .eq('status', 'pendente')
      .select('id')
      .maybeSingle();

    if (updatedCobranca) {
      shouldTriggerAutoRenew = true;
      console.log(`✅ Cobranca ${cobranca.id} marked as paid (atomic)`);
    }
  }

  if (fatura && fatura.status !== 'pago') {
    const { data: updatedFatura } = await supabaseAdmin
      .from('faturas')
      .update({ status: 'pago', paid_at: nowIso, updated_at: nowIso })
      .eq('id', fatura.id)
      .eq('status', 'pendente')
      .select('id')
      .maybeSingle();

    if (updatedFatura) {
      shouldTriggerAutoRenew = true;
      console.log(`✅ Fatura ${fatura.id} marked as paid via V3Pay webhook`);
    }
  }

  if (shouldTriggerAutoRenew && ownerUserId && clienteWhatsapp) {
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-renew-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: ownerUserId,
        cliente_whatsapp: clienteWhatsapp,
        gateway: 'v3pay',
        gateway_charge_id: chargeId,
      }),
    }).catch((e: any) => console.error('Auto-renewal trigger error:', e.message));
  } else {
    console.log(`V3Pay webhook: charge ${chargeId} already processed`);
  }

  return new Response(JSON.stringify({ ok: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleAuthenticatedAction(action: string, body: any, user: any, supabaseAdmin: any, userToken?: string) {
  switch (action) {
    case 'configure': {
      const { apiToken } = body;
      if (!apiToken) {
        return new Response(JSON.stringify({ success: false, error: 'Token da API é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      try {
        const testResp = await fetch(`${V3PAY_BASE_URL}/orders/0`, {
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' }
        });
        if (testResp.status === 401) {
          throw new Error('Token inválido');
        }
        console.log('✅ V3Pay token validated, status:', testResp.status);
      } catch (error: any) {
        if (error.message === 'Token inválido') {
          return new Response(JSON.stringify({ success: false, error: 'Token da API V3Pay inválido ou sem permissão.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }
        console.warn('⚠️ Could not validate token (network issue):', error.message);
      }

      await storeVaultSecret(userToken || '', user.id, 'v3pay', 'api_token', apiToken);

      const { error: upsertError } = await supabaseAdmin
        .from('v3pay_config')
        .upsert({
          user_id: user.id,
          api_token_hash: 'vault',
          is_configured: true,
          webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/v3pay-integration`,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('DB error:', upsertError);
        return new Response(JSON.stringify({ success: false, error: 'Erro ao salvar configuração.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
      }

      return new Response(JSON.stringify({ success: true, message: 'V3Pay configurado com sucesso!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    case 'create-charge': {
      const apiToken = await getVaultSecret(supabaseAdmin, user.id, 'v3pay', 'api_token');

      if (!apiToken) {
        return new Response(JSON.stringify({ success: false, error: 'V3Pay não configurado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const { amount, description, customer_name, customer_email, customer_phone, customer_document } = body;
      if (!amount || !description) {
        return new Response(JSON.stringify({ success: false, error: 'Valor e descrição são obrigatórios.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const chargeResp = await fetch(`${V3PAY_BASE_URL}/charges`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          customer_name: customer_name || undefined,
          customer_email: customer_email || undefined,
          customer_phone: customer_phone || undefined,
          customer_document: customer_document || undefined,
          origin: 'Gestor IPTV',
        }),
      });

      const chargeData = await chargeResp.json();
      if (!chargeResp.ok) {
        return new Response(JSON.stringify({ success: false, error: chargeData.message || 'Erro ao criar cobrança.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: chargeResp.status });
      }

      if (customer_phone && chargeData.id) {
        await supabaseAdmin.from('cobrancas').insert({
          user_id: user.id,
          gateway: 'v3pay',
          gateway_charge_id: String(chargeData.id),
          cliente_whatsapp: customer_phone,
          cliente_nome: customer_name || null,
          valor: parseFloat(amount),
          status: 'pendente',
        });
      }

      return new Response(JSON.stringify({ success: true, charge: chargeData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    case 'create-order': {
      const apiToken = await getVaultSecret(supabaseAdmin, user.id, 'v3pay', 'api_token');

      if (!apiToken) {
        return new Response(JSON.stringify({ success: false, error: 'V3Pay não configurado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const { product_id, customer_name, customer_email, customer_phone, customer_document } = body;
      if (!product_id || !customer_name || !customer_email) {
        return new Response(JSON.stringify({ success: false, error: 'product_id, customer_name e customer_email são obrigatórios.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const orderResp = await fetch(`${V3PAY_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id, customer_name, customer_email,
          customer_phone: customer_phone || undefined,
          customer_document: customer_document || undefined,
          origin: 'Gestor IPTV',
        }),
      });

      const orderData = await orderResp.json();
      if (!orderResp.ok) {
        return new Response(JSON.stringify({ success: false, error: orderData.message || 'Erro ao criar pedido.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: orderResp.status });
      }

      return new Response(JSON.stringify({ success: true, order: orderData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    case 'get-order': {
      const apiToken = await getVaultSecret(supabaseAdmin, user.id, 'v3pay', 'api_token');

      if (!apiToken) {
        return new Response(JSON.stringify({ success: false, error: 'V3Pay não configurado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const { orderId } = body;
      if (!orderId) {
        return new Response(JSON.stringify({ success: false, error: 'orderId é obrigatório.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const resp = await fetch(`${V3PAY_BASE_URL}/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      });

      const respData = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ success: false, error: respData.message || 'Erro ao consultar pedido.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: resp.status });
      }

      return new Response(JSON.stringify({ success: true, order: respData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    default:
      return new Response(JSON.stringify({
        error: 'Invalid action',
        available: ['configure', 'create-charge', 'create-order', 'get-order']
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET — validation ping
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    console.log('🚀 V3Pay Integration - Starting request processing...');

    let body: any = {};
    if (req.method === 'POST') {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Webhook detection: has 'event' field and no 'action' field
    if (body.event && !body.action) {
      return await handleWebhook(body, supabaseAdmin);
    }

    const action = body.action;
    console.log('🎯 Action:', action);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    // Support service-role calls with x-user-id header
    const xUserId = req.headers.get('x-user-id');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = authHeader.replace('Bearer ', '');

    let userId: string;

    if (xUserId && serviceRoleKey && token === serviceRoleKey) {
      userId = xUserId;
      console.log('✅ Service-role auth for user:', userId);
    } else {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
      }
      userId = user.id;
      console.log('✅ User authenticated:', user.id);
    }

    return await handleAuthenticatedAction(action, body, { id: userId } as any, supabaseAdmin, token);

  } catch (error: any) {
    console.error('🚨 V3Pay Error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno no processamento da requisição' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
