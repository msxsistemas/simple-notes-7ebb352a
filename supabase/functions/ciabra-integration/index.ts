import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CIABRA_BASE_URL = 'https://api.az.center';

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
  // Must use user-scoped client so auth.uid() is set in the RPC
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  );
  const { error } = await userClient.rpc('store_gateway_secret', {
    p_user_id: userId,
    p_gateway: gateway,
    p_secret_name: secretName,
    p_secret_value: secretValue,
  });
  if (error) throw new Error('Vault store error: ' + error.message);
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
    console.log(`🔄 Auto-renewal result:`, JSON.stringify(data));
    return data;
  } catch (err: any) {
    console.error(`❌ Auto-renewal failed:`, err.message);
    return { success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Ciabra Integration - Starting...');

    let body: any = {};
    if (req.method === 'POST') {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if this is a webhook from Ciabra
    const webhookType = (body.type || body.event || body.hookType || '').toUpperCase();
    if (body.event || body.type || body.hookType || body.installmentId) {
      console.log('📩 Ciabra Webhook received');
      console.log('📩 Webhook type detected:', webhookType);

      const possibleChargeId = String(body.id || body.payment_id || body.charge_id || body.invoiceId || '');
      if (!possibleChargeId) {
        console.warn('⚠️ Ciabra webhook missing charge ID - rejecting');
        return new Response(JSON.stringify({ error: 'Missing charge identifier' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      // Verify charge exists in database AND retrieve associated user for key verification
      const { data: existingCharge } = await supabaseAdmin
        .from('cobrancas')
        .select('id, user_id, cliente_whatsapp')
        .eq('gateway', 'ciabra')
        .eq('gateway_charge_id', possibleChargeId)
        .maybeSingle();

      const { data: existingFatura } = await supabaseAdmin
        .from('faturas')
        .select('id, user_id, cliente_whatsapp')
        .eq('gateway', 'ciabra')
        .eq('gateway_charge_id', possibleChargeId)
        .maybeSingle();
      
      const { data: existingSub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('gateway_subscription_id', possibleChargeId)
        .maybeSingle();

      if (!existingCharge && !existingFatura && !existingSub) {
        console.warn('⚠️ Ciabra webhook charge ID not found in database - rejecting:', possibleChargeId);
        return new Response(JSON.stringify({ error: 'Unknown charge' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
      }

      // Verify webhook authenticity: check that the originating user has Ciabra configured
      const webhookUserId = existingCharge?.user_id || existingFatura?.user_id || existingSub?.user_id;
      if (webhookUserId) {
        const { data: cibraConfig } = await supabaseAdmin
          .from('ciabra_config')
          .select('is_configured')
          .eq('user_id', webhookUserId)
          .eq('is_configured', true)
          .maybeSingle();
        
        if (!cibraConfig) {
          console.warn('⚠️ Ciabra webhook rejected: user has no active Ciabra config');
          return new Response(JSON.stringify({ error: 'Gateway not configured for user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
        }
      }

      console.log('✅ Ciabra webhook charge verified in database');
      
      const isPaid = webhookType.includes('CONFIRMED') || webhookType.includes('PAID')
        || webhookType.includes('APPROVED') || webhookType.includes('RECEIVED')
        || body.event === 'payment.confirmed' || body.event === 'payment.approved' 
        || (body.status || '').toUpperCase() === 'PAID'
        || (body._status || '').toUpperCase() === 'PAID';
      
      console.log('📩 isPaid:', isPaid);
      
      if (isPaid) {
        const chargeId = String(body.id || body.payment_id || body.charge_id || body.invoiceId || '');
        const nowIso = new Date().toISOString();
        
        if (chargeId) {
          let shouldTriggerAutoRenew = false;
          let ownerUserId: string | null = null;
          let clienteWhatsapp: string | null = null;

          // Atomic update on cobrancas
          const { data: updatedCobranca } = await supabaseAdmin
            .from('cobrancas')
            .update({ status: 'pago', renovado: true, updated_at: nowIso })
            .eq('gateway', 'ciabra')
            .eq('gateway_charge_id', chargeId)
            .eq('status', 'pendente')
            .select('id, user_id, cliente_whatsapp')
            .maybeSingle();

          if (updatedCobranca) {
            shouldTriggerAutoRenew = true;
            ownerUserId = updatedCobranca.user_id;
            clienteWhatsapp = updatedCobranca.cliente_whatsapp;
            console.log(`✅ Cobranca ${updatedCobranca.id} marked as paid (atomic)`);
          }

          // Also check faturas
          const { data: updatedFatura } = await supabaseAdmin
            .from('faturas')
            .update({ status: 'pago', paid_at: nowIso, updated_at: nowIso })
            .eq('gateway', 'ciabra')
            .eq('gateway_charge_id', chargeId)
            .eq('status', 'pendente')
            .select('id, user_id, cliente_whatsapp')
            .maybeSingle();

          if (updatedFatura) {
            shouldTriggerAutoRenew = true;
            ownerUserId = ownerUserId || updatedFatura.user_id;
            clienteWhatsapp = clienteWhatsapp || updatedFatura.cliente_whatsapp;
            console.log(`✅ Fatura ${updatedFatura.id} marked as paid via Ciabra webhook`);
          }

          if (shouldTriggerAutoRenew && ownerUserId && clienteWhatsapp) {
            await triggerAutoRenewal(ownerUserId, clienteWhatsapp, 'ciabra', chargeId);
          } else if (!updatedCobranca && !updatedFatura) {
            console.log(`Ciabra webhook: charge ${chargeId} already processed or not found`);
          }
        }

        const searchId = chargeId || '';
        if (searchId) {
          const { data: sub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('*, system_plans(*)')
            .eq('gateway_subscription_id', searchId)
            .eq('status', 'pendente')
            .maybeSingle();

          if (sub) {
            console.log(`✅ Ativando plano via webhook para user: ${sub.user_id}`);
            await supabaseAdmin
              .from('user_subscriptions')
              .update({
                status: 'ativa',
                inicio: nowIso,
                updated_at: nowIso,
              })
              .eq('id', sub.id);
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const action = body.action;
    console.log('🎯 Action:', action);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(userToken);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    switch (action) {
      case 'configure': {
        const { apiKey, publicKey, webhookUrl } = body;

        if (!apiKey || !publicKey) {
          return new Response(
            JSON.stringify({ success: false, error: 'Chave Pública e Chave Secreta são obrigatórias' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        try {
          // Store keys in Supabase Vault (encrypted at rest) using user-scoped client
          await storeVaultSecret(userToken, user.id, 'ciabra', 'api_key', apiKey);
          await storeVaultSecret(userToken, user.id, 'ciabra', 'public_key', publicKey);

          const { data: existing } = await supabaseAdmin
            .from('ciabra_config')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin
              .from('ciabra_config')
              .update({
                api_key_hash: 'vault',
                public_key_hash: 'vault',
                webhook_url: webhookUrl || null,
                is_configured: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('ciabra_config')
              .insert({
                user_id: user.id,
                api_key_hash: 'vault',
                public_key_hash: 'vault',
                webhook_url: webhookUrl || null,
                is_configured: true
              });
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Ciabra configurado com sucesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Ciabra config save failed:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message || 'Erro ao salvar configuração' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      case 'create-pix': {
        const { valor, descricao, cliente_nome } = body;

        if (!valor) {
          return new Response(
            JSON.stringify({ success: false, error: 'Valor é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get API keys from Vault
        const privateKey = await getVaultSecret(supabaseAdmin, user.id, 'ciabra', 'api_key');
        const publicKey = await getVaultSecret(supabaseAdmin, user.id, 'ciabra', 'public_key');

        if (!privateKey) {
          return new Response(
            JSON.stringify({ success: false, error: 'Ciabra não configurado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const basicToken = btoa(`${publicKey || ''}:${privateKey}`);
        const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        try {
          const chargeResp = await fetch(`${CIABRA_BASE_URL}/invoices/applications/invoices`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basicToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: descricao || `Cobrança - ${cliente_nome || 'Cliente'}`,
              dueDate: dueDate,
              installmentCount: 1,
              invoiceType: "SINGLE",
              items: [],
              price: parseFloat(valor),
              paymentTypes: ["PIX"],
              webhooks: [
                { hookType: "PAYMENT_CONFIRMED", url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ciabra-integration` }
              ],
              notifications: []
            }),
          });

          const chargeText = await chargeResp.text();
          console.log('📋 Ciabra charge response:', chargeText.substring(0, 500));
          let chargeData: any = {};
          try { chargeData = JSON.parse(chargeText); } catch { /* non-JSON */ }

          if (!chargeResp.ok) {
            throw new Error(chargeData.message || chargeData.error || `Erro Ciabra (${chargeResp.status})`);
          }

          return new Response(
            JSON.stringify({
              success: true,
              charge_id: String(chargeData.id || ''),
              pix_qr_code: chargeData.payment?.pix?.qrCode || null,
              pix_copia_cola: chargeData.payment?.pix?.brCode || null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Ciabra create-pix error:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error: any) {
    console.error('🚨 Ciabra Integration Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno na integração' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});