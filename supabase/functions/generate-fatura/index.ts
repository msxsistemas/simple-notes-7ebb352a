import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ASAAS_BASE_URL = 'https://www.asaas.com/api/v3';

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60000);

function generateValidCpf(): string {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const digits = Array.from({ length: 9 }, () => rnd(9));
  for (let j = 0; j < 2; j++) {
    const len = digits.length;
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i] * (len + 1 - i);
    const rest = sum % 11;
    digits.push(rest < 2 ? 0 : 11 - rest);
  }
  return digits.join('');
}

function parseMoneyToNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  const raw = input.replace(/\u00A0/g, ' ').trim();
  if (!raw) return null;
  let cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface PixResult {
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  gateway_charge_id: string | null;
}

const emptyPix: PixResult = { pix_qr_code: null, pix_copia_cola: null, gateway_charge_id: null };

// ──────────────────────────────────────────────
// Gateway: Asaas
// ──────────────────────────────────────────────

async function asaasCheckStatus(fatura: any, supabaseAdmin: any): Promise<boolean> {
  const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
  if (!asaasApiKey) return false;
  try {
    const resp = await fetch(`${ASAAS_BASE_URL}/payments/${fatura.gateway_charge_id}`, {
      headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' }
    });
    const data = await resp.json();
    if (resp.ok && (data.status === 'RECEIVED' || data.status === 'CONFIRMED')) {
      await supabaseAdmin.from('faturas').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', fatura.id);
      console.log(`✅ Fatura ${fatura.id} marked as paid via Asaas`);
      return true;
    }
  } catch (err: any) {
    console.error('Asaas status check error:', err.message);
  }
  return false;
}

async function asaasCreateOrGetCustomer(apiKey: string, name: string, phone: string): Promise<string | null> {
  const custResp = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, cpfCnpj: generateValidCpf() })
  });
  let custData = await custResp.json();
  if (!custResp.ok) {
    const searchResp = await fetch(`${ASAAS_BASE_URL}/customers?phone=${encodeURIComponent(phone)}&limit=1`, {
      headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
    });
    const searchData = await searchResp.json();
    if (searchData.data?.[0]) {
      custData = searchData.data[0];
      if (!custData.cpfCnpj) {
        await fetch(`${ASAAS_BASE_URL}/customers/${custData.id}`, {
          method: 'PUT',
          headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpfCnpj: generateValidCpf() })
        });
      }
    }
  }
  return custData.id || null;
}

async function asaasCreateCharge(apiKey: string, customerId: string, valor: number, descricao: string): Promise<{ chargeId: string | null; pixResult: PixResult }> {
  const chargeResp = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: valor,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: descricao,
    })
  });
  const chargeData = await chargeResp.json();
  if (!chargeResp.ok || !chargeData.id) return { chargeId: null, pixResult: emptyPix };

  const pixResp = await fetch(`${ASAAS_BASE_URL}/payments/${chargeData.id}/pixQrCode`, {
    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
  });
  const pixData = await pixResp.json();

  return {
    chargeId: chargeData.id,
    pixResult: {
      pix_qr_code: pixResp.ok ? (pixData.encodedImage || null) : null,
      pix_copia_cola: pixResp.ok ? (pixData.payload || null) : null,
      gateway_charge_id: chargeData.id,
    }
  };
}

async function asaasGeneratePix(fatura: any, supabaseAdmin: any): Promise<PixResult> {
  const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
  if (!asaasApiKey) return emptyPix;
  try {
    if (fatura.gateway_charge_id) {
      const pixResp = await fetch(`${ASAAS_BASE_URL}/payments/${fatura.gateway_charge_id}/pixQrCode`, {
        headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' }
      });
      const pixData = await pixResp.json();
      if (pixResp.ok) {
        return { pix_qr_code: pixData.encodedImage || null, pix_copia_cola: pixData.payload || null, gateway_charge_id: fatura.gateway_charge_id };
      }
    } else {
      const customerId = await asaasCreateOrGetCustomer(asaasApiKey, fatura.cliente_nome, fatura.cliente_whatsapp);
      if (customerId) {
        const { chargeId, pixResult } = await asaasCreateCharge(asaasApiKey, customerId, fatura.valor, `Renovação - ${fatura.plano_nome || 'Plano'}`);
        if (chargeId) {
          await supabaseAdmin.from('cobrancas').upsert({
            user_id: fatura.user_id, gateway: 'asaas', gateway_charge_id: chargeId,
            cliente_whatsapp: fatura.cliente_whatsapp, cliente_nome: fatura.cliente_nome,
            valor: fatura.valor, status: 'pendente',
          }, { onConflict: 'gateway_charge_id' });
        }
        return pixResult;
      }
    }
  } catch (err: any) {
    console.error('Asaas PIX generate error:', err.message);
  }
  return emptyPix;
}

async function asaasCreateForNewFatura(apiKey: string, userId: string, clienteNome: string, clienteWhatsapp: string, valor: number, planoNome: string | null, supabaseAdmin: any): Promise<PixResult> {
  try {
    const customerId = await asaasCreateOrGetCustomer(apiKey, clienteNome, clienteWhatsapp);
    if (!customerId) return emptyPix;
    const { chargeId, pixResult } = await asaasCreateCharge(apiKey, customerId, valor, `Renovação - ${planoNome || 'Plano'}`);
    if (chargeId) {
      await supabaseAdmin.from('cobrancas').insert({
        user_id: userId, gateway: 'asaas', gateway_charge_id: chargeId,
        cliente_whatsapp: clienteWhatsapp, cliente_nome: clienteNome, valor, status: 'pendente',
      });
    }
    return pixResult;
  } catch (err: any) {
    console.error('Asaas PIX error:', err.message);
    return emptyPix;
  }
}

// ──────────────────────────────────────────────
// Gateway: MercadoPago
// ──────────────────────────────────────────────

async function getMercadoPagoAccessToken(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data: mpConfig } = await supabaseAdmin
    .from('mercadopago_config').select('access_token_hash')
    .eq('user_id', userId).eq('is_configured', true).maybeSingle();
  if (!mpConfig?.access_token_hash) return null;

  if (mpConfig.access_token_hash === 'vault') {
    const { data: vaultToken } = await supabaseAdmin.rpc('admin_get_gateway_secret', {
      p_user_id: userId, p_gateway: 'mercadopago', p_secret_name: 'access_token'
    });
    return vaultToken || null;
  }
  // Legacy base64 fallback
  try { return atob(mpConfig.access_token_hash); } catch { return null; }
}

async function mpCheckStatus(fatura: any, supabaseAdmin: any): Promise<boolean> {
  const accessToken = await getMercadoPagoAccessToken(supabaseAdmin, fatura.user_id);
  if (!accessToken) return false;
  try {
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${fatura.gateway_charge_id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await resp.json();
    if (resp.ok && data.status === 'approved') {
      await supabaseAdmin.from('faturas').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', fatura.id);
      console.log(`✅ Fatura ${fatura.id} marked as paid via MercadoPago`);
      return true;
    }
  } catch (err: any) {
    console.error('MercadoPago status check error:', err.message);
  }
  return false;
}

async function mpGeneratePix(fatura: any, supabaseAdmin: any): Promise<PixResult> {
  try {
    const accessToken = await getMercadoPagoAccessToken(supabaseAdmin, fatura.user_id);
    if (!accessToken) return emptyPix;

    const itemTitle = fatura.plano_nome || 'Assinatura de Serviço';
    const nameParts = (fatura.cliente_nome || 'Cliente').split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || firstName;
    const itemId = fatura.id ? String(fatura.id).substring(0, 8) : 'item01';

    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': fatura.id || crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: fatura.valor,
        description: itemTitle,
        payment_method_id: 'pix',
        external_reference: fatura.id || itemId,
        payer: {
          email: `${fatura.cliente_whatsapp}@fatura.com`,
          first_name: firstName,
          last_name: lastName,
        },
        additional_info: {
          items: [
            {
              id: itemId,
              title: itemTitle,
              description: `Cobrança - ${itemTitle}`,
              category_id: 'services',
              quantity: 1,
              unit_price: fatura.valor,
            },
          ],
          payer: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      }),
    });
    const mpData = await resp.json();
    if (resp.ok && mpData.id) {
      await supabaseAdmin.from('cobrancas').upsert({
        user_id: fatura.user_id, gateway: 'mercadopago', gateway_charge_id: String(mpData.id),
        cliente_whatsapp: fatura.cliente_whatsapp, cliente_nome: fatura.cliente_nome,
        valor: fatura.valor, status: 'pendente',
      }, { onConflict: 'gateway_charge_id' });
      return {
        pix_qr_code: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pix_copia_cola: mpData.point_of_interaction?.transaction_data?.qr_code || null,
        gateway_charge_id: String(mpData.id),
      };
    }
  } catch (err: any) {
    console.error('MercadoPago PIX generate error:', err.message);
  }
  return emptyPix;
}

// ──────────────────────────────────────────────
// Gateway: Ciabra
// ──────────────────────────────────────────────

async function getCiabraCredentials(supabaseAdmin: any, userId: string): Promise<{ privateKey: string; publicKey: string } | null> {
  const { data: config } = await supabaseAdmin
    .from('ciabra_config').select('api_key_hash, public_key_hash')
    .eq('user_id', userId).eq('is_configured', true).maybeSingle();
  if (!config?.api_key_hash) return null;

  let privateKey = '', publicKey = '';
  if (config.api_key_hash === 'vault') {
    const { data: vKey } = await supabaseAdmin.rpc('admin_get_gateway_secret', { p_user_id: userId, p_gateway: 'ciabra', p_secret_name: 'api_key' });
    privateKey = vKey || '';
    const { data: vPub } = await supabaseAdmin.rpc('admin_get_gateway_secret', { p_user_id: userId, p_gateway: 'ciabra', p_secret_name: 'public_key' });
    publicKey = vPub || '';
  } else {
    privateKey = atob(config.api_key_hash);
    publicKey = config.public_key_hash ? atob(config.public_key_hash) : '';
  }
  return { privateKey, publicKey };
}

function ciabraHeaders(publicKey: string, privateKey: string) {
  return { 'Authorization': `Basic ${btoa(`${publicKey}:${privateKey}`)}`, 'Content-Type': 'application/json' };
}

async function ciabraCheckStatus(fatura: any, supabaseAdmin: any): Promise<boolean> {
  const creds = await getCiabraCredentials(supabaseAdmin, fatura.user_id);
  if (!creds) return false;
  try {
    const headers = ciabraHeaders(creds.publicKey, creds.privateKey);
    const resp = await fetch(`https://api.az.center/invoices/applications/invoices/${fatura.gateway_charge_id}`, { headers });
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* */ }

    const invoiceStatus = (data.status || '').toUpperCase();
    let isPaid = ['PAID', 'APPROVED', 'CONFIRMED', 'COMPLETED'].includes(invoiceStatus);

    if (!isPaid && resp.ok && data.installments?.[0]?.id) {
      const payResp = await fetch(`https://api.az.center/payments/applications/installments/${data.installments[0].id}`, { headers });
      const payText = await payResp.text();
      let payData: any = {};
      try { payData = JSON.parse(payText); } catch { /* */ }
      const payment = Array.isArray(payData) ? payData[0] : payData;
      const pixStatus = (payment?.pix?.status || payment?.status || '').toUpperCase();
      isPaid = ['PAID', 'APPROVED', 'CONFIRMED', 'COMPLETED'].includes(pixStatus);
    }

    if (resp.ok && isPaid) {
      await supabaseAdmin.from('faturas').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', fatura.id);
      console.log(`✅ Fatura ${fatura.id} marked as paid via Ciabra`);
      return true;
    }
  } catch (err: any) {
    console.error('Ciabra status check error:', err.message);
  }
  return false;
}

async function ciabraExtractPix(invoiceId: string, headers: Record<string, string>): Promise<{ qr: string | null; emv: string | null }> {
  let qr: string | null = null;
  let emv: string | null = null;

  const detailResp = await fetch(`https://api.az.center/invoices/applications/invoices/${invoiceId}`, { method: 'GET', headers });
  const detailText = await detailResp.text();
  console.log(`🔍 Ciabra invoice detail (${detailResp.status}):`, detailText.substring(0, 500));
  let detailData: any = {};
  try { detailData = JSON.parse(detailText); } catch { /* */ }

  const paymentUrl = detailData.url || '';
  const installmentId = detailData.installments?.[0]?.id;

  if (installmentId) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
      const payResp = await fetch(`https://api.az.center/payments/applications/installments/${installmentId}`, { method: 'GET', headers });
      const payText = await payResp.text();
      let payData: any = {};
      try { payData = JSON.parse(payText); } catch { /* */ }

      const payment = Array.isArray(payData) ? payData[0] : payData;
      const pixObj = payment?.pix || payment;
      emv = pixObj?.emv || pixObj?.brCode || pixObj?.pixCode || null;
      qr = pixObj?.qrCode || null;

      if (emv) break;
      if (pixObj?.status === 'GENERATING') continue;
    }
  }

  if (!emv && paymentUrl) emv = paymentUrl;
  if (!qr) qr = detailData.payment?.pix?.qrCode || detailData.pix?.qrCode || null;

  return { qr, emv };
}

async function ciabraGeneratePix(fatura: any, supabaseAdmin: any): Promise<PixResult> {
  const creds = await getCiabraCredentials(supabaseAdmin, fatura.user_id);
  if (!creds) return emptyPix;

  try {
    const headers = ciabraHeaders(creds.publicKey, creds.privateKey);
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ciabra-integration`;

    // Create customer
    let customerId = '';
    try {
      const phone = fatura.cliente_whatsapp ? `+55${fatura.cliente_whatsapp.replace(/\D/g, '')}` : '';
      const custResp = await fetch('https://api.az.center/invoices/applications/customers', {
        method: 'POST', headers,
        body: JSON.stringify({
          fullName: fatura.cliente_nome || 'Cliente',
          phone,
          document: generateValidCpf().replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
        }),
      });
      const custText = await custResp.text();
      let custData: any = {};
      try { custData = JSON.parse(custText); } catch { /* */ }
      customerId = custData.id || '';
    } catch (e: any) {
      console.error('Ciabra customer creation error:', e.message);
    }

    const payload: any = {
      description: `Cobrança - ${fatura.cliente_nome || 'Cliente'}`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      installmentCount: 1, invoiceType: "SINGLE", items: [],
      price: parseFloat(fatura.valor.toString()),
      externalId: `fatura-${fatura.id.substring(0, 8)}`,
      paymentTypes: ["PIX"],
      webhooks: [
        { hookType: "INVOICE_CREATED", url: webhookUrl },
        { hookType: "PAYMENT_GENERATED", url: webhookUrl },
        { hookType: "PAYMENT_CONFIRMED", url: webhookUrl }
      ],
      notifications: []
    };
    if (customerId) payload.customerId = customerId;

    console.log('📋 Ciabra invoice payload:', JSON.stringify(payload).substring(0, 300));
    const resp = await fetch('https://api.az.center/invoices/applications/invoices', {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    const respText = await resp.text();
    console.log(`📋 Ciabra invoice response (${resp.status}):`, respText.substring(0, 500));
    let respData: any = {};
    try { respData = JSON.parse(respText); } catch { /* */ }

    const invoiceId = respData.id || '';
    if (!invoiceId) {
      console.error('❌ Ciabra invoice creation failed - no ID returned');
      return emptyPix;
    }
    console.log(`✅ Ciabra invoice created: ${invoiceId}`);

    let pix_qr_code = respData.payment?.pix?.qrCode || null;
    let pix_copia_cola = respData.payment?.pix?.brCode || null;

    if (!pix_qr_code && !pix_copia_cola) {
      console.log('🔍 Ciabra: No PIX in invoice response, extracting from installments...');
      const { qr, emv } = await ciabraExtractPix(invoiceId, headers);
      pix_qr_code = qr;
      pix_copia_cola = emv;
      console.log(`🔍 Ciabra extract result: qr=${!!qr}, emv=${!!emv}`);
    }

    await supabaseAdmin.from('cobrancas').upsert({
      user_id: fatura.user_id, gateway: 'ciabra', gateway_charge_id: invoiceId,
      cliente_whatsapp: fatura.cliente_whatsapp, cliente_nome: fatura.cliente_nome,
      valor: fatura.valor, status: 'pendente',
    }, { onConflict: 'gateway_charge_id' });

    return { pix_qr_code, pix_copia_cola, gateway_charge_id: invoiceId };
  } catch (err: any) {
    console.error('Ciabra PIX generate error:', err.message);
    return emptyPix;
  }
}

// ──────────────────────────────────────────────
// Gateway: V3Pay (shared for PF and PJ)
// ──────────────────────────────────────────────

async function v3payGeneratePixVariant(fatura: any, supabaseAdmin: any, variant: 'v3pay' | 'v3pay_pj', authHeader?: string): Promise<PixResult> {
  const configTable = variant === 'v3pay_pj' ? 'v3pay_pj_config' : 'v3pay_config';
  const edgeFunction = variant === 'v3pay_pj' ? 'v3pay-pj-integration' : 'v3pay-integration';
  try {
    const { data: v3Config } = await supabaseAdmin
      .from(configTable).select('is_configured')
      .eq('user_id', fatura.user_id).eq('is_configured', true).maybeSingle();
    if (!v3Config) return emptyPix;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || `Bearer ${supabaseKey}`,
        ...(!authHeader ? { 'x-user-id': fatura.user_id } : {}),
      },
      body: JSON.stringify({
        action: 'create-charge',
        amount: String(fatura.valor),
        description: `Renovação - ${fatura.plano_nome || 'Plano'}`,
        customer_name: fatura.cliente_nome,
        customer_phone: fatura.cliente_whatsapp,
      }),
    });
    const data = await resp.json();
    if (data.success && data.charge) {
      const chargeId = String(data.charge.id);
      await supabaseAdmin.from('cobrancas').upsert({
        user_id: fatura.user_id, gateway: variant, gateway_charge_id: chargeId,
        cliente_whatsapp: fatura.cliente_whatsapp, cliente_nome: fatura.cliente_nome,
        valor: fatura.valor, status: 'pendente',
      }, { onConflict: 'gateway_charge_id' });
      return {
        pix_qr_code: data.charge.pix?.qr_code || data.charge.pix_qr_code || null,
        pix_copia_cola: data.charge.pix?.qr_code_text || data.charge.pix?.pix_code || data.charge.pix_copia_cola || null,
        gateway_charge_id: chargeId,
      };
    }
  } catch (err: any) {
    console.error(`${variant} PIX generate error:`, err.message);
  }
  return emptyPix;
}

async function v3payGeneratePix(fatura: any, supabaseAdmin: any, authHeader?: string): Promise<PixResult> {
  return v3payGeneratePixVariant(fatura, supabaseAdmin, 'v3pay', authHeader);
}

async function v3payPjGeneratePix(fatura: any, supabaseAdmin: any, authHeader?: string): Promise<PixResult> {
  return v3payGeneratePixVariant(fatura, supabaseAdmin, 'v3pay_pj', authHeader);
}

// ──────────────────────────────────────────────
// Gateway: Woovi
// ──────────────────────────────────────────────

async function wooviGetAppId(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data: config } = await supabaseAdmin
    .from('woovi_config').select('is_configured')
    .eq('user_id', userId).maybeSingle();
  if (!config?.is_configured) return null;

  // Usa função admin que não requer auth.uid() (service role)
  const { data: appId, error } = await supabaseAdmin.rpc('admin_get_gateway_secret', {
    p_user_id: userId,
    p_gateway: 'woovi',
    p_secret_name: 'app_id',
  });
  if (error) console.error('wooviGetAppId vault error:', error.message);
  return appId || null;
}

async function wooviCheckStatus(fatura: any, supabaseAdmin: any): Promise<boolean> {
  try {
    const appId = await wooviGetAppId(supabaseAdmin, fatura.user_id);
    if (!appId) return false;
    const resp = await fetch(`https://api.openpix.com.br/api/openpix/v1/charge/${fatura.gateway_charge_id}`, {
      headers: { 'Authorization': appId, 'Content-Type': 'application/json' },
    });
    const data = await resp.json();
    const charge = data.charge || data;
    const status = (charge?.status || '').toUpperCase();
    if (['COMPLETED', 'PAID', 'CONFIRMED'].includes(status)) {
      await supabaseAdmin.from('faturas').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', fatura.id);
      console.log(`✅ Fatura ${fatura.id} marked as paid via Woovi`);
      return true;
    }
  } catch (err: any) {
    console.error('Woovi status check error:', err.message);
  }
  return false;
}

async function wooviGeneratePix(fatura: any, supabaseAdmin: any): Promise<PixResult> {
  try {
    const appId = await wooviGetAppId(supabaseAdmin, fatura.user_id);
    if (!appId) {
      console.error('Woovi: App ID not found for user', fatura.user_id);
      return emptyPix;
    }

    const correlationID = `fatura-${fatura.id.substring(0, 8)}-${Date.now()}`;
    const valorCentavos = Math.round(parseFloat(fatura.valor.toString()) * 100);

    // Build webhook URL for automatic payment confirmation
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const webhookUrl = `${supabaseUrl}/functions/v1/woovi-integration`;

    const payload: any = {
      correlationID,
      value: valorCentavos,
      comment: `Cobrança - ${fatura.cliente_nome || 'Cliente'}`,
      additionalInfo: [
        { key: 'fatura_id', value: fatura.id },
      ],
    };

    // Add webhook configuration for automatic payment notification
    if (webhookUrl) {
      payload.webhook = {
        url: webhookUrl,
      };
    }

    const resp = await fetch(`https://api.openpix.com.br/api/openpix/v1/charge`, {
      method: 'POST',
      headers: { 'Authorization': appId, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    console.log('Woovi generate PIX response FULL:', JSON.stringify(data).substring(0, 600));
    const charge = data.charge || data;
    if (!charge?.correlationID && !charge?.transactionID) return emptyPix;

    const chargeId = charge.correlationID || correlationID;

    // OpenPix returns brCode inside charge.qrCodeLink or directly on charge
    const brCode = charge.brCode
      || charge.qrCodeLink?.brCode
      || charge.pixQrCode?.brCode
      || data.brCode
      || null;

    // QR image: OpenPix may return a URL or base64
    const qrCodeImageUrl = charge.qrCodeLink?.qrCodeImageUrl
      || charge.pixQrCode?.qrCodeImageUrl
      || charge.qrCodeImageUrl
      || null;

    console.log('Woovi brCode:', brCode ? brCode.substring(0, 50) + '...' : 'null');
    console.log('Woovi qrCodeImageUrl:', qrCodeImageUrl);

    await supabaseAdmin.from('cobrancas').upsert({
      user_id: fatura.user_id, gateway: 'woovi', gateway_charge_id: chargeId,
      cliente_whatsapp: fatura.cliente_whatsapp, cliente_nome: fatura.cliente_nome,
      valor: fatura.valor, status: 'pendente',
    }, { onConflict: 'gateway_charge_id' });

    return { pix_qr_code: null, pix_copia_cola: brCode, gateway_charge_id: chargeId };
  } catch (err: any) {
    console.error('Woovi PIX generate error:', err.message);
    return emptyPix;
  }
}

// ──────────────────────────────────────────────
// Gateway Rotation
// ──────────────────────────────────────────────

async function getRotatedGateway(supabaseAdmin: any, userId: string, defaultGateway: string): Promise<string> {
  try {
    const { data: rotConfig } = await supabaseAdmin
      .from('gateway_rotation_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!rotConfig || !rotConfig.ativo) return defaultGateway;

    const currentGateway = rotConfig.gateway_atual === 'a' ? rotConfig.gateway_a : rotConfig.gateway_b;
    const newContador = (rotConfig.contador_atual || 0) + 1;

    if (newContador >= rotConfig.intervalo) {
      // Switch gateway and reset counter
      const newGatewayAtual = rotConfig.gateway_atual === 'a' ? 'b' : 'a';
      await supabaseAdmin
        .from('gateway_rotation_config')
        .update({ contador_atual: 0, gateway_atual: newGatewayAtual })
        .eq('user_id', userId);
      console.log(`🔄 Gateway rotation: switched to gateway ${newGatewayAtual} (${newGatewayAtual === 'a' ? rotConfig.gateway_a : rotConfig.gateway_b}) after ${rotConfig.intervalo} invoices`);
    } else {
      // Just increment counter
      await supabaseAdmin
        .from('gateway_rotation_config')
        .update({ contador_atual: newContador })
        .eq('user_id', userId);
    }

    console.log(`🔄 Gateway rotation active: using ${currentGateway} (counter: ${newContador}/${rotConfig.intervalo})`);
    return currentGateway;
  } catch (err: any) {
    console.error('Gateway rotation error:', err.message);
    return defaultGateway;
  }
}

async function getCurrentRotatedGateway(supabaseAdmin: any, userId: string, defaultGateway: string): Promise<string> {
  try {
    const { data: rotConfig } = await supabaseAdmin
      .from('gateway_rotation_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!rotConfig || !rotConfig.ativo) return defaultGateway;

    const currentGateway = rotConfig.gateway_atual === 'a' ? rotConfig.gateway_a : rotConfig.gateway_b;
    console.log(`🔄 Gateway rotation current for existing fatura: ${currentGateway} (counter: ${rotConfig.contador_atual || 0}/${rotConfig.intervalo})`);
    return currentGateway;
  } catch (err: any) {
    console.error('Gateway rotation current read error:', err.message);
    return defaultGateway;
  }
}

// ──────────────────────────────────────────────
// Gateway validation & fallback
// ──────────────────────────────────────────────

async function resolveConfiguredGateway(supabaseAdmin: any, userId: string, requestedGateway: string): Promise<string> {
  const gatewayConfigMap: Record<string, { table: string; field: string }> = {
    asaas: { table: 'asaas_config', field: 'is_configured' },
    mercadopago: { table: 'mercadopago_config', field: 'is_configured' },
    ciabra: { table: 'ciabra_config', field: 'is_configured' },
    v3pay: { table: 'v3pay_config', field: 'is_configured' },
    v3pay_pj: { table: 'v3pay_pj_config', field: 'is_configured' },
    woovi: { table: 'woovi_config', field: 'is_configured' },
  };

  const reqConfig = gatewayConfigMap[requestedGateway];
  if (reqConfig) {
    const { data } = await supabaseAdmin
      .from(reqConfig.table).select(reqConfig.field)
      .eq('user_id', userId).eq(reqConfig.field, true).maybeSingle();
    if (data) return requestedGateway;
    console.warn(`⚠️ Gateway '${requestedGateway}' NOT configured for user ${userId}, searching fallback...`);
  }

  const order = ['v3pay', 'asaas', 'mercadopago', 'woovi', 'ciabra', 'v3pay_pj'];
  for (const gw of order) {
    if (gw === requestedGateway) continue;
    const cfg = gatewayConfigMap[gw];
    const { data } = await supabaseAdmin
      .from(cfg.table).select(cfg.field)
      .eq('user_id', userId).eq(cfg.field, true).maybeSingle();
    if (data) {
      console.log(`✅ Fallback gateway: using '${gw}' instead of '${requestedGateway}'`);
      await supabaseAdmin.from('checkout_config').update({ gateway_ativo: gw }).eq('user_id', userId);
      return gw;
    }
  }

  console.warn(`⚠️ No configured gateway found for user ${userId}`);
  return requestedGateway;
}

// ──────────────────────────────────────────────
// Gateway dispatcher
// ──────────────────────────────────────────────

async function checkPaymentStatus(fatura: any, supabaseAdmin: any): Promise<boolean> {
  if (fatura.gateway === 'asaas') return asaasCheckStatus(fatura, supabaseAdmin);
  if (fatura.gateway === 'mercadopago') return mpCheckStatus(fatura, supabaseAdmin);
  if (fatura.gateway === 'ciabra') return ciabraCheckStatus(fatura, supabaseAdmin);
  if (fatura.gateway === 'woovi') return wooviCheckStatus(fatura, supabaseAdmin);
  return false;
}

async function generatePixForGateway(gatewayAtivo: string, fatura: any, supabaseAdmin: any, authHeader?: string): Promise<PixResult> {
  if (gatewayAtivo === 'asaas') return asaasGeneratePix(fatura, supabaseAdmin);
  if (gatewayAtivo === 'mercadopago') return mpGeneratePix(fatura, supabaseAdmin);
  if (gatewayAtivo === 'ciabra') return ciabraGeneratePix(fatura, supabaseAdmin);
  if (gatewayAtivo === 'v3pay') return v3payGeneratePix(fatura, supabaseAdmin, authHeader);
  if (gatewayAtivo === 'v3pay_pj') return v3payPjGeneratePix(fatura, supabaseAdmin, authHeader);
  if (gatewayAtivo === 'woovi') return wooviGeneratePix(fatura, supabaseAdmin);
  return emptyPix;
}

async function createPixForNewFatura(
  gatewayAtivo: string, userId: string, clienteNome: string, clienteWhatsapp: string,
  valor: number, planoNome: string | null, supabaseAdmin: any, authHeader: string
): Promise<PixResult> {
  if (gatewayAtivo === 'asaas') {
    const apiKey = Deno.env.get('ASAAS_API_KEY');
    if (!apiKey) return emptyPix;
    return asaasCreateForNewFatura(apiKey, userId, clienteNome, clienteWhatsapp, valor, planoNome, supabaseAdmin);
  }
  if (gatewayAtivo === 'mercadopago') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/mercadopago-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'create-pix', valor: String(valor), descricao: `Renovação - ${planoNome || 'Plano'}`, cliente_nome: clienteNome }),
      });
      const data = await resp.json();
      if (data.success && data.charge_id) {
        await supabaseAdmin.from('cobrancas').insert({
          user_id: userId, gateway: 'mercadopago', gateway_charge_id: data.charge_id,
          cliente_whatsapp: clienteWhatsapp, cliente_nome: clienteNome, valor, status: 'pendente',
        });
        return { pix_qr_code: data.pix_qr_code || null, pix_copia_cola: data.pix_copia_cola || null, gateway_charge_id: data.charge_id };
      }
    } catch (err: any) { console.error('MercadoPago PIX error:', err.message); }
    return emptyPix;
  }
  if (gatewayAtivo === 'ciabra') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/ciabra-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'create-pix', valor: String(valor), descricao: `Renovação - ${planoNome || 'Plano'}`, cliente_nome: clienteNome }),
      });
      const data = await resp.json();
      if (data.success && data.charge_id) {
        await supabaseAdmin.from('cobrancas').insert({
          user_id: userId, gateway: 'ciabra', gateway_charge_id: data.charge_id,
          cliente_whatsapp: clienteWhatsapp, cliente_nome: clienteNome, valor, status: 'pendente',
        });
        return { pix_qr_code: data.pix_qr_code || null, pix_copia_cola: data.pix_copia_cola || null, gateway_charge_id: data.charge_id };
      }
    } catch (err: any) { console.error('Ciabra PIX error:', err.message); }
    return emptyPix;
  }
  if (gatewayAtivo === 'v3pay' || gatewayAtivo === 'v3pay_pj') {
    const edgeFunction = gatewayAtivo === 'v3pay_pj' ? 'v3pay-pj-integration' : 'v3pay-integration';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'create-charge', amount: String(valor), description: `Renovação - ${planoNome || 'Plano'}`, customer_name: clienteNome, customer_phone: clienteWhatsapp }),
      });
      const data = await resp.json();
      if (data.success && data.charge) {
        return {
          pix_qr_code: data.charge.pix?.qr_code || data.charge.pix_qr_code || null,
          pix_copia_cola: data.charge.pix?.qr_code_text || data.charge.pix?.pix_code || data.charge.pix_copia_cola || null,
          gateway_charge_id: String(data.charge.id),
        };
      }
    } catch (err: any) { console.error(`${gatewayAtivo} PIX error:`, err.message); }
    return emptyPix;
  }
  if (gatewayAtivo === 'woovi') {
    // Reuse the fatura-based generator with a mock fatura object
    const mockFatura = { id: `${userId}-${Date.now()}`, user_id: userId, cliente_nome: clienteNome, cliente_whatsapp: clienteWhatsapp, valor, plano_nome: planoNome };
    const result = await wooviGeneratePix(mockFatura, supabaseAdmin);
    if (result.gateway_charge_id) {
      await supabaseAdmin.from('cobrancas').upsert({
        user_id: userId, gateway: 'woovi', gateway_charge_id: result.gateway_charge_id,
        cliente_whatsapp: clienteWhatsapp, cliente_nome: clienteNome, valor, status: 'pendente',
      }, { onConflict: 'gateway_charge_id' });
    }
    return result;
  }
  return emptyPix;
}

// ──────────────────────────────────────────────
// Helpers for fetching company name
// ──────────────────────────────────────────────

async function getNomeEmpresa(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('nome_empresa').eq('user_id', userId).maybeSingle();
  return profile?.nome_empresa || null;
}

// ──────────────────────────────────────────────
// Action Handlers
// ──────────────────────────────────────────────

async function handleGetFatura(body: any, supabaseAdmin: any): Promise<Response> {
  const { fatura_id } = body;
  if (!isValidUUID(fatura_id)) {
    return new Response(JSON.stringify({ error: 'ID de fatura inválido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
  if (!checkRateLimit(`get-fatura:${fatura_id}`, 20, 60000)) {
    return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 });
  }

  const { data: fatura, error } = await supabaseAdmin.from('faturas').select('*').eq('id', fatura_id).maybeSingle();
  if (error || !fatura) {
    return new Response(JSON.stringify({ error: 'Fatura não encontrada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
  }

  const nome_empresa = await getNomeEmpresa(supabaseAdmin, fatura.user_id);

  // Fetch client's data_vencimento if cliente_id exists
  let data_vencimento: string | null = null;
  if (fatura.cliente_id) {
    const { data: cliente } = await supabaseAdmin.from('clientes').select('data_vencimento').eq('id', fatura.cliente_id).maybeSingle();
    data_vencimento = cliente?.data_vencimento || null;
  }

  // Check payment status in real-time
  let justPaid = false;
  if (fatura.status === 'pendente' && fatura.gateway_charge_id) {
    const paid = await checkPaymentStatus(fatura, supabaseAdmin);
    if (paid) {
      fatura.status = 'pago';
      fatura.paid_at = new Date().toISOString();
      justPaid = true;
    }
  }

  // Also check cobrancas table for webhook-confirmed payments
  // NOTE: If cobranca.renovado is true, the webhook already triggered auto-renew,
  // so we only update fatura status here WITHOUT setting justPaid (avoids double renewal)
  if (fatura.status === 'pendente' && fatura.gateway_charge_id) {
    const { data: cobranca } = await supabaseAdmin.from('cobrancas').select('renovado').eq('gateway_charge_id', fatura.gateway_charge_id).maybeSingle();
    if (cobranca?.renovado) {
      await supabaseAdmin.from('faturas').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', fatura.id);
      fatura.status = 'pago';
      fatura.paid_at = new Date().toISOString();
      // Do NOT set justPaid=true here — webhook already handled auto-renew
    }
  }

  // Trigger auto-renewal SYNCHRONOUSLY when payment is detected
  if (justPaid) {
    try {
      console.log(`🔄 Triggering auto-renew for ${fatura.cliente_whatsapp} (gateway: ${fatura.gateway})`);
      const renewResp = await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/auto-renew-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
        body: JSON.stringify({
          user_id: fatura.user_id,
          cliente_whatsapp: fatura.cliente_whatsapp,
          gateway: fatura.gateway || 'pix',
          gateway_charge_id: fatura.gateway_charge_id,
        }),
      });
      const renewData = await renewResp.json();
      console.log(`✅ Auto-renew result: ${JSON.stringify(renewData).substring(0, 300)}`);
    } catch (renewErr: any) {
      console.error(`❌ Auto-renew error: ${renewErr.message}`);
    }
  }

  const safeFatura = {
    id: fatura.id, cliente_nome: fatura.cliente_nome, plano_nome: fatura.plano_nome,
    valor: fatura.valor, valor_original: fatura.valor_original, cupom_codigo: fatura.cupom_codigo,
    status: fatura.status, gateway: fatura.gateway, pix_qr_code: fatura.pix_qr_code,
    pix_copia_cola: fatura.pix_copia_cola, pix_manual_key: fatura.pix_manual_key,
    paid_at: fatura.paid_at, created_at: fatura.created_at, nome_empresa, data_vencimento,
  };

  return new Response(JSON.stringify({ success: true, fatura: safeFatura }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleGeneratePix(body: any, supabaseAdmin: any): Promise<Response> {
  const { fatura_id } = body;
  if (!isValidUUID(fatura_id)) {
    return new Response(JSON.stringify({ error: 'ID de fatura inválido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
  if (!checkRateLimit(`generate-pix:${fatura_id}`, 5, 3600000)) {
    return new Response(JSON.stringify({ error: 'Limite de geração PIX atingido. Tente novamente mais tarde.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 });
  }

  const { data: fatura, error: faturaErr } = await supabaseAdmin.from('faturas').select('*').eq('id', fatura_id).maybeSingle();
  if (faturaErr || !fatura) {
    return new Response(JSON.stringify({ error: 'Fatura não encontrada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
  }
  if (fatura.status === 'pago') {
    return new Response(JSON.stringify({ success: true, fatura, message: 'Fatura já paga' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Se PIX manual, retorna direto
  if (fatura.gateway === 'pix_manual' && fatura.pix_manual_key) {
    return new Response(JSON.stringify({ success: true, fatura }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Se já tem pix_copia_cola salvo E não é gateway automático, retorna direto
  // Para gateways automáticos (woovi, ciabra), sempre regera um novo PIX
  const isAutoGateway = ['woovi', 'ciabra'].includes(fatura.gateway || '');
  if (fatura.pix_copia_cola && !isAutoGateway) {
    return new Response(JSON.stringify({ success: true, fatura }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Para gateways automáticos, pula a tentativa de buscar charge existente
  // e vai direto para gerar um novo PIX

  const [checkoutConfigResult, wooviConfigResult] = await Promise.all([
    supabaseAdmin.from('checkout_config').select('*').eq('user_id', fatura.user_id).maybeSingle(),
    supabaseAdmin.from('woovi_config').select('is_configured').eq('user_id', fatura.user_id).maybeSingle(),
  ]);
  const checkoutConfig = checkoutConfigResult.data;
  const userHasWoovi = !!(wooviConfigResult.data as any)?.is_configured;

  // Resolve product gateway (same hierarchy as create: product > global > fatura.gateway)
  let produtoGatewayRegen: string | null = null;
  if (fatura.cliente_id && isValidUUID(fatura.cliente_id)) {
    const { data: clienteRegen } = await supabaseAdmin.from('clientes').select('produto').eq('id', fatura.cliente_id).maybeSingle();
    if (clienteRegen?.produto) {
      const produtoRegenQuery = isValidUUID(clienteRegen.produto)
        ? supabaseAdmin.from('produtos').select('gateway').eq('id', clienteRegen.produto).eq('user_id', fatura.user_id).maybeSingle()
        : supabaseAdmin.from('produtos').select('gateway').eq('nome', clienteRegen.produto).eq('user_id', fatura.user_id).maybeSingle();
      const { data: produtoRegen } = await produtoRegenQuery;
      if (produtoRegen?.gateway) produtoGatewayRegen = await resolveConfiguredGateway(supabaseAdmin, fatura.user_id, produtoRegen.gateway);
    }
  }

  const rawGatewayRegen = checkoutConfig?.gateway_ativo || fatura.gateway || 'asaas';
  const validatedGatewayRegen = await resolveConfiguredGateway(supabaseAdmin, fatura.user_id, rawGatewayRegen);
  const rotatedGatewayRegen = produtoGatewayRegen
    ? validatedGatewayRegen
    : await getCurrentRotatedGateway(supabaseAdmin, fatura.user_id, validatedGatewayRegen);
  const gatewayAtivo = produtoGatewayRegen || rotatedGatewayRegen;

  let pixResult = emptyPix;
  let gateway = gatewayAtivo;
  let pix_manual_key: string | null = null;

  const useWoovi = userHasWoovi && gatewayAtivo === 'woovi' && (checkoutConfig?.pix_enabled || !!produtoGatewayRegen);

  if (useWoovi) {
    gateway = 'woovi';
    pixResult = await wooviGeneratePix(fatura, supabaseAdmin);
  } else if (produtoGatewayRegen) {
    // Product-specific gateway always generates PIX regardless of pix_enabled toggle
    gateway = produtoGatewayRegen;
    pixResult = await generatePixForGateway(produtoGatewayRegen, fatura, supabaseAdmin);
  } else if (checkoutConfig?.pix_enabled) {
    gateway = gatewayAtivo;
    pixResult = await generatePixForGateway(gatewayAtivo, fatura, supabaseAdmin);
  }

  // Fallback to PIX manual
  if (!pixResult.pix_qr_code && !pixResult.pix_copia_cola && !checkoutConfig?.pix_enabled && checkoutConfig?.pix_manual_enabled && checkoutConfig?.pix_manual_key) {
    gateway = 'pix_manual';
    pix_manual_key = checkoutConfig.pix_manual_key;
  }

  const updateData: Record<string, unknown> = {};
  if (pixResult.pix_qr_code) updateData.pix_qr_code = pixResult.pix_qr_code;
  if (pixResult.pix_copia_cola) updateData.pix_copia_cola = pixResult.pix_copia_cola;
  if (pix_manual_key) updateData.pix_manual_key = pix_manual_key;
  if (gateway) updateData.gateway = gateway;
  if (pixResult.gateway_charge_id) updateData.gateway_charge_id = pixResult.gateway_charge_id;

  if (Object.keys(updateData).length > 0) {
    await supabaseAdmin.from('faturas').update(updateData).eq('id', fatura.id);
  }

  const updatedFatura = { ...fatura, ...updateData };
  const pixGenerated = !!(pixResult.pix_qr_code || pixResult.pix_copia_cola || pix_manual_key);
  console.log(`${pixGenerated ? '✅' : '⚠️'} PIX ${pixGenerated ? 'generated' : 'FAILED'} on-demand for fatura ${fatura.id}, gateway: ${gateway}`);

  return new Response(JSON.stringify({ success: true, fatura: updatedFatura }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleApplyCoupon(body: any, supabaseAdmin: any): Promise<Response> {
  const { fatura_id, codigo } = body;
  if (!isValidUUID(fatura_id)) {
    return new Response(JSON.stringify({ error: 'ID de fatura inválido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
  if (!codigo || typeof codigo !== 'string' || codigo.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Código do cupom é obrigatório' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
  if (!checkRateLimit(`apply-coupon:${fatura_id}`, 10, 60000)) {
    return new Response(JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 });
  }

  const { data: fatura, error: faturaErr } = await supabaseAdmin.from('faturas').select('*').eq('id', fatura_id).maybeSingle();
  if (faturaErr || !fatura) {
    return new Response(JSON.stringify({ error: 'Fatura não encontrada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
  }
  if (fatura.status === 'pago') {
    return new Response(JSON.stringify({ error: 'Esta fatura já foi paga' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }

  const hadPixGenerated = !!(fatura.pix_qr_code || fatura.pix_copia_cola || fatura.gateway_charge_id);

  const { data: cupom } = await supabaseAdmin.from('cupons').select('*').eq('user_id', fatura.user_id).eq('codigo', codigo.trim().toUpperCase()).eq('ativo', true).maybeSingle();
  if (!cupom) return new Response(JSON.stringify({ error: 'Cupom inválido ou expirado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  if (cupom.validade && new Date(cupom.validade) < new Date()) return new Response(JSON.stringify({ error: 'Cupom expirado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  if (cupom.limite_uso !== null && cupom.usos_atuais >= cupom.limite_uso) return new Response(JSON.stringify({ error: 'Cupom atingiu o limite de uso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  const valorOriginal = Number(fatura.valor);
  let desconto = cupom.tipo_desconto === 'percentual' ? valorOriginal * (cupom.desconto / 100) : cupom.desconto;
  desconto = Math.min(desconto, valorOriginal);
  const valorFinal = Math.max(valorOriginal - desconto, 0);

  const updateData: any = { valor: valorFinal, valor_original: valorOriginal, cupom_codigo: cupom.codigo };
  if (hadPixGenerated) { updateData.pix_qr_code = null; updateData.pix_copia_cola = null; updateData.gateway_charge_id = null; }

  const { error: updateErr } = await supabaseAdmin.from('faturas').update(updateData).eq('id', fatura.id);
  if (updateErr) return new Response(JSON.stringify({ error: 'Erro ao aplicar desconto' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });

  await supabaseAdmin.from('cupons').update({ usos_atuais: cupom.usos_atuais + 1 }).eq('id', cupom.id);
  console.log(`✅ Coupon ${cupom.codigo} applied to fatura ${fatura.id}: R$${valorOriginal} -> R$${valorFinal}`);

  const nome_empresa = await getNomeEmpresa(supabaseAdmin, fatura.user_id);

  return new Response(JSON.stringify({
    success: true,
    fatura: { ...fatura, valor: valorFinal, nome_empresa },
    desconto: desconto.toFixed(2), cupom_codigo: cupom.codigo, tipo_desconto: cupom.tipo_desconto, valor_desconto: cupom.desconto,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRemoveCoupon(body: any, supabaseAdmin: any): Promise<Response> {
  const { fatura_id } = body;
  if (!isValidUUID(fatura_id)) return new Response(JSON.stringify({ error: 'ID de fatura inválido' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  if (!checkRateLimit(`remove-coupon:${fatura_id}`, 10, 60000)) return new Response(JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 });

  const { data: fatura, error: faturaErr } = await supabaseAdmin.from('faturas').select('*').eq('id', fatura_id).maybeSingle();
  if (faturaErr || !fatura) return new Response(JSON.stringify({ error: 'Fatura não encontrada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
  if (fatura.status === 'pago') return new Response(JSON.stringify({ error: 'Esta fatura já foi paga' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  if (!fatura.cupom_codigo || !fatura.valor_original) return new Response(JSON.stringify({ error: 'Nenhum cupom aplicado nesta fatura' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  const { data: cupom } = await supabaseAdmin.from('cupons').select('*').eq('user_id', fatura.user_id).eq('codigo', fatura.cupom_codigo).maybeSingle();
  if (cupom && cupom.usos_atuais > 0) await supabaseAdmin.from('cupons').update({ usos_atuais: cupom.usos_atuais - 1 }).eq('id', cupom.id);

  const valorOriginal = fatura.valor_original;
  const { error: updateErr } = await supabaseAdmin.from('faturas').update({ valor: valorOriginal, valor_original: null, cupom_codigo: null, pix_qr_code: null, pix_copia_cola: null, gateway_charge_id: null }).eq('id', fatura.id);
  if (updateErr) return new Response(JSON.stringify({ error: 'Erro ao remover cupom' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });

  console.log(`🗑️ Coupon removed from fatura ${fatura.id}: R$${fatura.valor} -> R$${valorOriginal}`);
  const nome_empresa = await getNomeEmpresa(supabaseAdmin, fatura.user_id);

  return new Response(JSON.stringify({
    success: true, fatura: { ...fatura, valor: valorOriginal, valor_original: null, cupom_codigo: null, nome_empresa },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function checkReferralDiscount(supabaseAdmin: any, userId: string, clienteId: string | null): Promise<{ desconto: number; tipo: string; ciclo: number; indicadorNome: string } | null> {
  if (!clienteId) return null;
  try {
    const { data: config } = await supabaseAdmin
      .from('indicacoes_auto_renovacao')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    if (!config) return null;

    // Get indicador name
    const { data: indicador } = await supabaseAdmin.from('clientes').select('nome, whatsapp').eq('id', clienteId).maybeSingle();

    let query = supabaseAdmin
      .from('clientes')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('indicador', clienteId);

    const now = new Date();
    if (config.periodo === 'mensal') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    } else if (config.periodo === 'trimestral') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString());
    } else if (config.periodo === 'semestral') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString());
    } else if (config.periodo === 'anual') {
      query = query.gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString());
    }

    const { data: indicados, error } = await query;
    if (error || !indicados) return null;

    const count = indicados.length;
    const meta = config.min_indicacoes;

    if (count >= meta) {
      const ciclo = Math.floor(count / meta);
      console.log(`🎁 Referral discount applies: client ${clienteId} has ${count}/${meta} referrals (${ciclo} cycle(s))`);
      return { desconto: Number(config.valor_desconto), tipo: config.tipo_desconto, ciclo, indicadorNome: indicador?.nome || 'Indicador' };
    }
  } catch (err: any) {
    console.error('Referral discount check error:', err.message);
  }
  return null;
}

async function handleCreateFatura(body: any, user: any, authHeader: string, supabaseAdmin: any): Promise<Response> {
  const { cliente_id, cliente_nome, cliente_whatsapp, plano_nome, valor } = body;
  const parsedValor = parseMoneyToNumber(valor);

  if (!cliente_nome || !cliente_whatsapp || parsedValor === null) {
    return new Response(JSON.stringify({ error: 'Dados obrigatórios: cliente_nome, cliente_whatsapp, valor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }

  // Check referral discount for this client (if they are an indicador)
  let valorFinal = parsedValor;
  let valorOriginal: number | null = null;
  let referralDiscountApplied: { desconto: number; tipo: string; ciclo: number; indicadorNome: string; descontoReal: number } | null = null;
  const referralDiscount = await checkReferralDiscount(supabaseAdmin, user.id, cliente_id);
  if (referralDiscount) {
    const descontoValor = referralDiscount.tipo === 'percentual'
      ? parsedValor * (referralDiscount.desconto / 100)
      : referralDiscount.desconto;
    const descontoReal = Math.min(descontoValor, parsedValor);
    valorFinal = Math.max(parsedValor - descontoReal, 0);
    if (valorFinal !== parsedValor) {
      valorOriginal = parsedValor;
      referralDiscountApplied = { ...referralDiscount, descontoReal };
      console.log(`🎁 Referral discount applied: R$${parsedValor} -> R$${valorFinal} (${referralDiscount.tipo}: ${referralDiscount.desconto})`);
    }
  }

  // Delete existing pending faturas for this client before creating a new one
  if (cliente_id && isValidUUID(cliente_id)) {
    await supabaseAdmin
      .from('faturas')
      .delete()
      .eq('user_id', user.id)
      .eq('cliente_id', cliente_id)
      .eq('status', 'pendente');
    console.log(`🗑️ Deleted existing pending faturas for cliente ${cliente_id} before creating new one`);
  }

  const [checkoutConfigResult2, wooviConfigResult2] = await Promise.all([
    supabaseAdmin.from('checkout_config').select('*').eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('woovi_config').select('is_configured').eq('user_id', user.id).maybeSingle(),
  ]);
  const checkoutConfig = checkoutConfigResult2.data;
  const userHasWoovi2 = !!(wooviConfigResult2.data as any)?.is_configured;

  // Check if client's product has a specific gateway configured
  let produtoGateway: string | null = null;
  if (cliente_id && isValidUUID(cliente_id)) {
    const { data: cliente } = await supabaseAdmin.from('clientes').select('produto').eq('id', cliente_id).maybeSingle();
    if (cliente?.produto) {
      const produtoQuery = isValidUUID(cliente.produto)
        ? supabaseAdmin.from('produtos').select('gateway').eq('id', cliente.produto).eq('user_id', user.id).maybeSingle()
        : supabaseAdmin.from('produtos').select('gateway').eq('nome', cliente.produto).eq('user_id', user.id).maybeSingle();
      const { data: produto } = await produtoQuery;
      if (produto?.gateway) {
        // Validate that the product gateway is actually configured
        produtoGateway = await resolveConfiguredGateway(supabaseAdmin, user.id, produto.gateway);
        console.log(`🎯 Using product-specific gateway: ${produtoGateway} for cliente ${cliente_id}`);
      }
    }
  }

  const rawGlobalGateway = checkoutConfig?.gateway_ativo || 'asaas';
  const globalGateway = await resolveConfiguredGateway(supabaseAdmin, user.id, rawGlobalGateway);
  const rotatedGateway = produtoGateway ? globalGateway : await getRotatedGateway(supabaseAdmin, user.id, globalGateway);
  const gatewayEfetivo = produtoGateway || rotatedGateway;
  const useWoovi2 = !produtoGateway && userHasWoovi2 && gatewayEfetivo === 'woovi' && checkoutConfig?.pix_enabled;
  const produtoUsaWoovi = produtoGateway === 'woovi';

  let gateway: string = gatewayEfetivo;
  let pixResult: PixResult = emptyPix;

  if (produtoUsaWoovi || useWoovi2) {
    gateway = 'woovi';
    pixResult = await createPixForNewFatura('woovi', user.id, cliente_nome, cliente_whatsapp, valorFinal, plano_nome, supabaseAdmin, authHeader);
  } else if (produtoGateway) {
    gateway = produtoGateway;
    pixResult = await createPixForNewFatura(produtoGateway, user.id, cliente_nome, cliente_whatsapp, valorFinal, plano_nome, supabaseAdmin, authHeader);
  } else if (checkoutConfig?.pix_enabled) {
    pixResult = await createPixForNewFatura(gatewayEfetivo, user.id, cliente_nome, cliente_whatsapp, valorFinal, plano_nome, supabaseAdmin, authHeader);
  }

  let pixManualKey: string | null = null;
  if (!produtoGateway && !checkoutConfig?.pix_enabled && checkoutConfig?.pix_manual_enabled && checkoutConfig?.pix_manual_key) {
    gateway = 'pix_manual';
    pixManualKey = checkoutConfig.pix_manual_key;
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id, cliente_id: cliente_id || null, cliente_nome, cliente_whatsapp,
    plano_nome: plano_nome || null, valor: valorFinal, gateway,
    gateway_charge_id: pixResult.gateway_charge_id, pix_qr_code: pixResult.pix_qr_code,
    pix_copia_cola: pixResult.pix_copia_cola, pix_manual_key: pixManualKey, status: 'pendente',
  };
  if (valorOriginal !== null) insertData.valor_original = valorOriginal;

  const { data: fatura, error: insertError } = await supabaseAdmin.from('faturas').insert(insertData).select().single();

  if (insertError) {
    console.error('Insert fatura error:', insertError);
    return new Response(JSON.stringify({ error: 'Erro ao criar fatura' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }

  const faturaUrl = `https://gestormsx.pro/fatura/${fatura.id}`;

  // Log referral discount if applied
  if (referralDiscountApplied && cliente_id) {
    try {
      await supabaseAdmin.from('indicacoes_descontos_log').insert({
        user_id: user.id,
        indicador_id: cliente_id,
        indicador_nome: referralDiscountApplied.indicadorNome,
        fatura_id: fatura.id,
        valor_original: parsedValor,
        valor_desconto: referralDiscountApplied.descontoReal,
        valor_final: valorFinal,
        tipo_desconto: referralDiscountApplied.tipo,
        ciclo: referralDiscountApplied.ciclo,
      });
      console.log(`📝 Referral discount logged for indicador ${cliente_id}, ciclo ${referralDiscountApplied.ciclo}`);

      // Update the indicador client's desconto field with accumulated referral discounts
      try {
        const { data: allLogs } = await supabaseAdmin
          .from('indicacoes_descontos_log')
          .select('valor_desconto')
          .eq('indicador_id', cliente_id)
          .eq('user_id', user.id);

        const totalDesconto = (allLogs || []).reduce((sum: number, d: any) => sum + Number(d.valor_desconto), 0);

        if (totalDesconto > 0) {
          await supabaseAdmin
            .from('clientes')
            .update({ desconto: totalDesconto.toFixed(2) })
            .eq('id', cliente_id)
            .eq('user_id', user.id);

          console.log(`💰 Updated client ${cliente_id} desconto to ${totalDesconto.toFixed(2)}`);
        }
      } catch (updateErr: any) {
        console.error('Error updating client desconto from referrals:', updateErr.message);
      }
    } catch (logErr: any) {
      console.error('Error logging referral discount:', logErr.message);
    }
  }

  // Send WhatsApp notification
  let whatsappSent = false;
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (evolutionUrl && evolutionKey) {
      const { data: sessions } = await supabaseAdmin.from('whatsapp_sessions').select('session_id').eq('user_id', user.id).eq('status', 'connected').limit(1);

      if (sessions?.length > 0) {
        const instanceName = `user_${user.id.replace(/-/g, '_')}`;
        const sessionId = sessions[0].session_id;
        const phone = cliente_whatsapp.replace(/\D/g, '');

        const { data: mensagensPadroes } = await supabaseAdmin.from('mensagens_padroes').select('fatura_criada').eq('user_id', user.id).maybeSingle();

        // Fetch full client data for template variables
        let clienteData: any = null;
        if (cliente_id) {
          const { data: cd } = await supabaseAdmin.from('clientes').select('*').eq('id', cliente_id).maybeSingle();
          clienteData = cd;
        }

        // Resolve plan name from ID if needed
        let resolvedPlanoNome = plano_nome || '';
        if (clienteData?.plano) {
          const { data: planoData } = await supabaseAdmin.from('planos').select('nome').eq('id', clienteData.plano).maybeSingle();
          resolvedPlanoNome = planoData?.nome || plano_nome || clienteData.plano || '';
        }

        // Resolve produto name from ID if needed
        let resolvedProdutoNome = '';
        if (clienteData?.produto) {
          const { data: produtoData } = await supabaseAdmin.from('produtos').select('nome').eq('id', clienteData.produto).maybeSingle();
          resolvedProdutoNome = produtoData?.nome || clienteData.produto || '';
        }

        // Resolve app name from ID if needed
        let resolvedAppNome = '';
        if (clienteData?.app) {
          const { data: appData } = await supabaseAdmin.from('aplicativos').select('nome').eq('id', clienteData.app).maybeSingle();
          resolvedAppNome = appData?.nome || clienteData.app || '';
        }

        // Fetch profile for empresa name
        const { data: profileData } = await supabaseAdmin.from('profiles').select('nome_empresa').eq('user_id', user.id).maybeSingle();

        let message: string;
        if (mensagensPadroes?.fatura_criada) {
          const template = mensagensPadroes.fatura_criada;
          const hour = new Date().getHours();
          const saudacao = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
          const nomeCompleto = clienteData?.nome || cliente_nome || '';
          const partes = nomeCompleto.trim().split(' ');
          const primeiroNome = partes[0] || '';
          const sobrenome = partes.length > 1 ? partes.slice(1).join(' ') : '';

          // Format vencimento
          let vencimentoFormatado = '';
          if (clienteData?.data_vencimento) {
            try { vencimentoFormatado = new Date(clienteData.data_vencimento).toLocaleDateString('pt-BR'); }
            catch { vencimentoFormatado = clienteData.data_vencimento; }
          }

          const normalizeTemplateValue = (value: unknown): string => {
            if (value === null || value === undefined) return 'none';
            const text = String(value).trim();
            if (!text) return 'none';
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) || /^[0-9a-f]{32}$/i.test(text);
            return isUuid ? 'none' : text;
          };

          const replacements: Record<string, string> = {
            '{saudacao}': saudacao,
            '{nome_cliente}': normalizeTemplateValue(nomeCompleto),
            '{nome}': normalizeTemplateValue(primeiroNome),
            '{cliente}': normalizeTemplateValue(nomeCompleto),
            '{sobrenome}': normalizeTemplateValue(sobrenome),
            '{whatsapp}': normalizeTemplateValue(clienteData?.whatsapp || cliente_whatsapp),
            '{email}': normalizeTemplateValue(clienteData?.email),
            '{usuario}': normalizeTemplateValue(clienteData?.usuario),
            '{senha}': normalizeTemplateValue(clienteData?.senha),
            '{vencimento}': normalizeTemplateValue(vencimentoFormatado),
            '{data_vencimento}': normalizeTemplateValue(vencimentoFormatado),
            '{data_venc_app}': normalizeTemplateValue(clienteData?.data_venc_app),
            '{nome_plano}': normalizeTemplateValue(resolvedPlanoNome),
            '{plano}': normalizeTemplateValue(resolvedPlanoNome),
            '{valor_plano}': `R$ ${valorFinal.toFixed(2)}`,
            '{valor}': `R$ ${valorFinal.toFixed(2)}`,
            '{subtotal}': `R$ ${valorFinal.toFixed(2)}`,
            '{total}': `R$ ${valorFinal.toFixed(2)}`,
            '{link_fatura}': normalizeTemplateValue(faturaUrl),
            '{desconto}': normalizeTemplateValue(clienteData?.desconto),
            '{obs}': normalizeTemplateValue(clienteData?.observacao),
            '{app}': normalizeTemplateValue(resolvedAppNome),
            '{dispositivo}': normalizeTemplateValue(clienteData?.dispositivo),
            '{telas}': normalizeTemplateValue(clienteData?.telas?.toString()),
            '{mac}': normalizeTemplateValue(clienteData?.mac),
            '{produto}': normalizeTemplateValue(resolvedProdutoNome),
            '{aniversario}': normalizeTemplateValue(clienteData?.aniversario),
            '{nome_empresa}': normalizeTemplateValue(profileData?.nome_empresa),
          };

          message = template;
          for (const [key, value] of Object.entries(replacements)) {
            message = message.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
          }
          message = message.replace(/{br}/g, '\n');
        } else {
          message = `Olá ${cliente_nome}! 🧾\n\nSua fatura de renovação está disponível:\n\n📋 *Plano:* ${plano_nome || 'N/A'}\n💰 *Valor:* R$ ${valorFinal.toFixed(2)}\n\n🔗 Acesse o link para pagar:\n${faturaUrl}\n\nObrigado! 🙏`;
        }

        const evolutionApiUrl = evolutionUrl.replace(/\/$/, '');
        console.log(`📱 Enviando WhatsApp para ${phone} via ${evolutionApiUrl}/message/sendText/${instanceName}`);
        const sendResp = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone, text: message, delay: 1200, linkPreview: false })
        });
        const sendData = await sendResp.json().catch(() => ({}));
        if (!sendResp.ok) {
          console.error(`❌ Evolution API error (${sendResp.status}):`, JSON.stringify(sendData).substring(0, 300));
        } else {
          console.log('✅ WhatsApp fatura_criada message sent to:', phone, 'Response:', JSON.stringify(sendData).substring(0, 200));
          whatsappSent = true;
        }

        // Register in whatsapp_messages for tracking
        try {
          await supabaseAdmin.from('whatsapp_messages').insert({
            user_id: user.id,
            session_id: sessionId,
            phone: phone,
            message: message,
            status: sendResp.ok ? 'sent' : 'failed',
            error_message: sendResp.ok ? null : JSON.stringify(sendData).substring(0, 500),
            sent_at: new Date().toISOString(),
          });
        } catch (regErr: any) {
          console.warn('⚠️ Failed to register message:', regErr.message);
        }

        // Send WhatsApp notification to the indicador about their discount
        if (referralDiscountApplied && cliente_id) {
          try {
            const { data: indicadorData } = await supabaseAdmin.from('clientes').select('whatsapp, nome').eq('id', cliente_id).maybeSingle();
            if (indicadorData?.whatsapp) {
              const indicadorPhone = indicadorData.whatsapp.replace(/\D/g, '');
              const descontoText = referralDiscountApplied.tipo === 'percentual'
                ? `${referralDiscountApplied.desconto}%`
                : `R$ ${referralDiscountApplied.descontoReal.toFixed(2)}`;
              
              // Try to load custom template from mensagens_padroes
              let indicadorMsg = `🎉 Parabéns ${indicadorData.nome}!\n\nVocê atingiu a meta de indicações e ganhou um *desconto de ${descontoText}* na sua próxima fatura!\n\n🏆 Ciclo ${referralDiscountApplied.ciclo} completado.\n\nContinue indicando para ganhar mais descontos! 🚀`;
              try {
                const { data: msgPadroes } = await supabaseAdmin.from('mensagens_padroes').select('indicacao_meta').eq('user_id', user.id).maybeSingle();
                if (msgPadroes?.indicacao_meta) {
                  indicadorMsg = msgPadroes.indicacao_meta
                    .replace(/\{nome\}/g, indicadorData.nome || '')
                    .replace(/\{desconto\}/g, descontoText)
                    .replace(/\{ciclo\}/g, String(referralDiscountApplied.ciclo))
                    .replace(/\{br\}/g, '\n');
                }
              } catch (tmplErr: any) {
                console.error('Error loading indicacao_meta template:', tmplErr.message);
              }

              await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: indicadorPhone, text: indicadorMsg, linkPreview: false })
              });
              console.log('✅ WhatsApp referral reward notification sent to indicador:', indicadorPhone);
            }
          } catch (indErr: any) {
            console.error('Error sending indicador notification:', indErr.message);
          }
        }
      }
    }
  } catch (whatsErr: any) {
    console.error('WhatsApp send error:', whatsErr.message);
    whatsappSent = false;
  }

  return new Response(JSON.stringify({ success: true, fatura, url: faturaUrl, whatsapp_sent: whatsappSent }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ──────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    // Public actions (no auth required)
    if (action === 'get-fatura') return handleGetFatura(body, supabaseAdmin);
    if (action === 'generate-pix') return handleGeneratePix(body, supabaseAdmin);
    if (action === 'apply-coupon') return handleApplyCoupon(body, supabaseAdmin);
    if (action === 'remove-coupon') return handleRemoveCoupon(body, supabaseAdmin);

    // Auth required for remaining actions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    if (action === 'create') return handleCreateFatura(body, user, authHeader, supabaseAdmin);

    return new Response(JSON.stringify({ error: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  } catch (error: any) {
    console.error('🚨 Generate Fatura Error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao processar fatura' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
