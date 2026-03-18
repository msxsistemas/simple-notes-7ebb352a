import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

async function resolveVaultCreds(supabase: SupabaseClient, panel: any) {
  let u = panel.usuario, s = panel.senha;
  if (u === 'vault' || s === 'vault') {
    const [uR, sR] = await Promise.all([
      supabase.rpc('admin_get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `usuario_${panel.id}` }),
      supabase.rpc('admin_get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `senha_${panel.id}` }),
    ]);
    if (uR.data) u = uR.data;
    if (sR.data) s = sR.data;
  }
  return { usuario: u, senha: s };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// ── VPS Relay helper ──

async function relayFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: any,
): Promise<{ status: number; body: string }> {
  const VPS_RELAY_URL = Deno.env.get('VPS_RELAY_URL');
  const VPS_RELAY_SECRET = Deno.env.get('VPS_RELAY_SECRET');

  if (!VPS_RELAY_URL || !VPS_RELAY_SECRET) {
    throw new Error('VPS_RELAY_URL ou VPS_RELAY_SECRET não configurados');
  }

  const resp = await withTimeout(fetch(`${VPS_RELAY_URL}/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Relay-Secret': VPS_RELAY_SECRET,
    },
    body: JSON.stringify({
      url,
      method,
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
  }), 30000);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`VPS Relay erro: ${resp.status} - ${text.substring(0, 200)}`);
  }

  const data = await resp.json();
  return { status: data.status, body: data.body };
}

// ── Resolve Cloudflare via FlareSolverr ──

async function solveCloudflarViaRelay(baseUrl: string): Promise<void> {
  const VPS_RELAY_URL = Deno.env.get('VPS_RELAY_URL');
  const VPS_RELAY_SECRET = Deno.env.get('VPS_RELAY_SECRET');

  if (!VPS_RELAY_URL || !VPS_RELAY_SECRET) return;

  console.log(`🛡️ Sigma: resolvendo Cloudflare para ${baseUrl}...`);
  try {
    const resp = await withTimeout(fetch(`${VPS_RELAY_URL}/flaresolverr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Secret': VPS_RELAY_SECRET,
      },
      body: JSON.stringify({ url: baseUrl, maxTimeout: 60000 }),
    }), 90000);

    const data = await resp.json();
    if (data.success) {
      console.log(`✅ Cloudflare resolvido! ${data.cached ? '(cache)' : '(novo)'} - ${data.cookies?.length || 0} cookies`);
    } else {
      console.warn(`⚠️ FlareSolverr falhou: ${data.error || 'desconhecido'} - tentando sem CF cookies...`);
    }
  } catch (e: any) {
    console.warn(`⚠️ FlareSolverr indisponível: ${e.message} - tentando sem CF cookies...`);
  }
}

// ── Sigma via VPS Relay ──

async function sigmaLoginViaRelay(baseUrl: string, username: string, password: string): Promise<string> {
  // Primeiro resolve Cloudflare (cookies ficam em cache no relay)
  await solveCloudflarViaRelay(baseUrl);

  const url = `${baseUrl}/api/auth/login`;
  console.log(`🔑 Sigma (relay): login em ${url}`);

  const result = await relayFetch(url, 'POST', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }, {
    username,
    password,
    captcha: 'not-a-robot',
    captchaChecked: true,
    twofactor_code: '',
    twofactor_recovery_code: '',
    twofactor_trusted_device_id: '',
  });

  if (result.status !== 200) {
    console.error(`❌ Sigma login failed: ${result.status} - ${result.body.substring(0, 300)}`);
    throw new Error(`Login falhou (${result.status})`);
  }

  let data: any;
  try { data = JSON.parse(result.body); } catch {
    throw new Error('Login: resposta não-JSON');
  }

  if (!data.token) throw new Error('Login OK mas token não retornado.');
  console.log(`✅ Sigma (relay): login OK`);
  return data.token;
}

async function sigmaGetViaRelay(baseUrl: string, path: string, token: string): Promise<any> {
  const result = await relayFetch(`${baseUrl}${path}`, 'GET', {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  if (result.status !== 200) throw new Error(`GET ${path} falhou: ${result.status}`);
  return JSON.parse(result.body);
}

async function sigmaPostViaRelay(baseUrl: string, path: string, token: string, body: any): Promise<any> {
  const result = await relayFetch(`${baseUrl}${path}`, 'POST', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  }, body);

  if (result.status !== 200) throw new Error(`POST ${path} falhou: ${result.status} - ${result.body.substring(0, 200)}`);
  return JSON.parse(result.body);
}

/**
 * Auto-renew a client after payment confirmation.
 * 
 * Expects POST body:
 * {
 *   user_id: string,           // Owner user ID
 *   cliente_whatsapp: string,   // Client WhatsApp to find
 *   gateway: string,            // Gateway name for logging
 *   gateway_charge_id?: string  // Optional charge ID for tracking
 * }
 * 
 * This function:
 * 1. Finds the client by WhatsApp number
 * 2. Gets their plan to calculate renewal duration
 * 3. Updates the client's expiration date
 * 4. If product has auto-renewal + linked panel, triggers server renewal
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, cliente_whatsapp, gateway, gateway_charge_id } = body;

    if (!user_id || !cliente_whatsapp) {
      return new Response(JSON.stringify({ success: false, error: 'user_id e cliente_whatsapp são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    console.log(`🔄 Auto-renovação iniciada - WhatsApp: ***${String(cliente_whatsapp).slice(-4)}, Gateway: ${gateway}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Idempotência: se gateway_charge_id já foi processado (fatura paga), abortar ──
    if (gateway_charge_id) {
      const { data: faturaJaPaga } = await supabase
        .from('faturas')
        .select('id, status, paid_at')
        .eq('user_id', user_id)
        .eq('gateway_charge_id', gateway_charge_id)
        .eq('status', 'pago')
        .maybeSingle();

      if (faturaJaPaga?.paid_at) {
        // Verifica se paid_at foi há mais de 10 segundos (já processado por outra instância)
        const paidAt = new Date(faturaJaPaga.paid_at).getTime();
        const now = Date.now();
        if (now - paidAt > 10000) {
          console.log(`⚠️ Idempotência: fatura ${faturaJaPaga.id} já foi paga em ${faturaJaPaga.paid_at}. Ignorando chamada duplicada.`);
          return new Response(JSON.stringify({
            success: true,
            message: 'Renovação já processada anteriormente (idempotente)',
            already_processed: true,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 1. Find client (prefer exact cliente_id from fatura when gateway_charge_id is available)
    // Normalize WhatsApp: remove non-digits for comparison
    const normalizedWhatsapp = cliente_whatsapp.replace(/\D/g, '');

    let cliente: any = null;

    if (gateway_charge_id) {
      const { data: faturaByCharge, error: faturaByChargeError } = await supabase
        .from('faturas')
        .select('id, cliente_id, cliente_whatsapp, created_at')
        .eq('user_id', user_id)
        .eq('gateway_charge_id', gateway_charge_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (faturaByChargeError) {
        console.warn(`⚠️ Falha ao buscar fatura por gateway_charge_id ${gateway_charge_id}: ${faturaByChargeError.message}`);
      } else if (faturaByCharge?.cliente_id) {
        const { data: clienteById, error: clienteByIdError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', faturaByCharge.cliente_id)
          .eq('user_id', user_id)
          .eq('ativo', true)
          .maybeSingle();

        if (clienteByIdError) {
          console.warn(`⚠️ Falha ao buscar cliente por cliente_id ${faturaByCharge.cliente_id}: ${clienteByIdError.message}`);
        } else if (clienteById) {
          cliente = clienteById;
          console.log(`🎯 Cliente resolvido por fatura (${faturaByCharge.id}) -> cliente_id ${cliente.id}`);
        }
      }
    }

    if (!cliente) {
      const { data: clientes, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user_id)
        .eq('ativo', true);

      if (clienteError || !clientes || clientes.length === 0) {
        console.error('❌ Nenhum cliente encontrado');
        return new Response(JSON.stringify({ success: false, error: 'Nenhum cliente encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }

      const matchedClientes = clientes.filter(c => {
        const clienteNorm = (c.whatsapp || '').replace(/\D/g, '');
        return clienteNorm === normalizedWhatsapp ||
               clienteNorm.endsWith(normalizedWhatsapp) ||
               normalizedWhatsapp.endsWith(clienteNorm);
      });

      if (matchedClientes.length > 1) {
        console.error(`❌ WhatsApp ambíguo para auto-renovação: ${matchedClientes.length} clientes com ***${String(cliente_whatsapp).slice(-4)}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Mais de um cliente encontrado para este WhatsApp. Use cobrança/fatura com cliente_id para renovar com segurança.',
          code: 'AMBIGUOUS_CLIENT_WHATSAPP',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 });
      }

      cliente = matchedClientes[0] || null;
    }

    if (!cliente) {
      console.error(`❌ Cliente com WhatsApp ***${String(cliente_whatsapp).slice(-4)} não encontrado`);
      return new Response(JSON.stringify({ success: false, error: `Cliente com WhatsApp ${cliente_whatsapp} não encontrado` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    console.log(`✅ Cliente encontrado (ID: ${cliente.id})`);

    // 2. Get the plan to calculate duration
    let renewalMonths = 1; // default: 1 month
    let renewalDays = 30;

    if (cliente.plano) {
      const { data: plano } = await supabase
        .from('planos')
        .select('*')
        .eq('user_id', user_id)
        .eq('nome', cliente.plano)
        .maybeSingle();

      if (plano) {
        const quantidade = parseInt(plano.quantidade || '1') || 1;
        const tipo = plano.tipo || 'meses';
        
        if (tipo === 'meses') {
          renewalMonths = quantidade;
          renewalDays = quantidade * 30;
        } else if (tipo === 'dias') {
          renewalMonths = 0;
          renewalDays = quantidade;
        }
        console.log(`📋 Plano "${plano.nome}": ${quantidade} ${tipo}`);
      }
    }

    // 3. Calculate new expiration date
    const now = new Date();
    const currentExpiry = cliente.data_vencimento ? new Date(cliente.data_vencimento) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    
    let newExpiry: Date;

    if (cliente.fixo && currentExpiry && renewalMonths > 0) {
      // Fixed day: keep the same day of the month, advance by renewal months from now
      const fixedDay = currentExpiry.getUTCDate();
      newExpiry = new Date(now);
      // Move to next month(s) from current month
      const targetMonth = now.getUTCMonth() + renewalMonths;
      newExpiry.setUTCMonth(targetMonth);
      // Set the fixed day, clamping to last day of month if needed
      const lastDay = new Date(Date.UTC(newExpiry.getUTCFullYear(), newExpiry.getUTCMonth() + 1, 0)).getUTCDate();
      newExpiry.setUTCDate(Math.min(fixedDay, lastDay));
      // If the calculated date is in the past or today, advance one more month
      if (newExpiry <= now) {
        newExpiry.setUTCMonth(newExpiry.getUTCMonth() + 1);
        const lastDay2 = new Date(Date.UTC(newExpiry.getUTCFullYear(), newExpiry.getUTCMonth() + 1, 0)).getUTCDate();
        newExpiry.setUTCDate(Math.min(fixedDay, lastDay2));
      }
      console.log(`📌 Vencimento fixo: dia ${fixedDay} → ${newExpiry.toISOString()}`);
    } else {
      newExpiry = new Date(baseDate);
      if (renewalMonths > 0) {
        newExpiry.setMonth(newExpiry.getMonth() + renewalMonths);
      } else {
        newExpiry.setDate(newExpiry.getDate() + renewalDays);
      }
    }

    console.log(`📅 Nova data de vencimento: ${newExpiry.toISOString()}`);

    // 4. Update client expiration and mark as paid
    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        data_vencimento: newExpiry.toISOString(),
        fatura: 'Pago',
      })
      .eq('id', cliente.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar cliente:', updateError);
      return new Response(JSON.stringify({ success: false, error: 'Erro ao atualizar data de vencimento' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    console.log(`✅ Cliente ${cliente.nome} atualizado - vencimento: ${newExpiry.toISOString()}`);

    // 5. If product has auto-renewal and linked panel, trigger server renewal
    let serverRenewalResult: any = null;

    if (cliente.produto) {
      // produto field may contain UUID (id) or name - try both
      let produto: any = null;
      const { data: produtoById } = await supabase
        .from('produtos')
        .select('*, paineis_integracao(*)')
        .eq('user_id', user_id)
        .eq('id', cliente.produto)
        .maybeSingle();
      
      if (produtoById) {
        produto = produtoById;
      } else {
        const { data: produtoByNome } = await supabase
          .from('produtos')
          .select('*, paineis_integracao(*)')
          .eq('user_id', user_id)
          .eq('nome', cliente.produto)
          .maybeSingle();
        produto = produtoByNome;
      }

      if (produto?.renovacao_automatica && produto?.painel_id && produto?.paineis_integracao) {
        const painel = produto.paineis_integracao;
        console.log(`🔄 Renovação no servidor - Provedor: ${painel.provedor}, Painel: ${painel.nome}`);

        // ── SIGMA: via VPS Relay (painel bloqueia Edge Functions) ──
        if (painel.provedor === 'sigma') {
          try {
            const painelCreds = await resolveVaultCreds(supabase, painel);
            const baseUrl = painel.url.replace(/\/+$/, '');

            const token = await sigmaLoginViaRelay(baseUrl, painelCreds.usuario, painelCreds.senha);

            console.log(`🔍 Sigma: buscando "${cliente.usuario}"`);
            const searchData = await sigmaGetViaRelay(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(cliente.usuario)}&perPage=5`, token);
            const customers = searchData.data || [];
            const found = customers.find((c: any) => c.username === cliente.usuario);
            if (!found) throw new Error(`Cliente "${cliente.usuario}" não encontrado no painel`);

            console.log(`🔄 Sigma: renovando cliente id=${found.id}`);
            const renewData = await sigmaPostViaRelay(baseUrl, `/api/customers/${found.id}/renew`, token, {
              package_id: found.package_id,
              connections: found.connections || 1,
            });
            const renewed = renewData.data || renewData;
            serverRenewalResult = { success: true, customer: renewed };
            console.log(`✅ Sigma renovado: ${renewed.expires_at_tz || renewed.expires_at}`);

            // Acessos adicionais
            const acessos = (cliente as any).acessos_adicionais;
            if (Array.isArray(acessos) && acessos.length > 0) {
              for (const acesso of acessos) {
                if (!acesso.usuario) continue;
                try {
                  const adicSearch = await sigmaGetViaRelay(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(acesso.usuario)}&perPage=5`, token);
                  const adicFound = (adicSearch.data || []).find((c: any) => c.username === acesso.usuario);
                  if (adicFound) {
                    await sigmaPostViaRelay(baseUrl, `/api/customers/${adicFound.id}/renew`, token, {
                      package_id: adicFound.package_id,
                      connections: adicFound.connections || 1,
                    });
                    console.log(`✅ Acesso adicional ${acesso.usuario} renovado`);
                  }
                } catch (adicErr: any) {
                  console.error(`❌ Acesso adicional ${acesso.usuario}: ${adicErr.message}`);
                }
              }
            }
          } catch (err: any) {
            console.error(`❌ Sigma erro: ${err.message}`);
            console.log(`📌 Marcando renovacao_pendente para renovação via frontend...`);
            
            // Mark client for frontend-based renewal
            await supabase.from('clientes').update({
              renovacao_pendente: true,
              renovacao_pendente_dados: {
                painel_id: painel.id,
                provedor: painel.provedor,
                usuario_painel: cliente.usuario,
                acessos_adicionais: (cliente as any).acessos_adicionais || [],
                tentativa_em: new Date().toISOString(),
                erro: err.message,
              },
            }).eq('id', cliente.id);
            
            serverRenewalResult = { success: false, error: err.message, pendente_frontend: true };
          }
        } else if (painel.provedor === 'uniplay') {
          // ── Uniplay: marcar como pendente para o cron processar via BrowserBase ──
          console.log(`📌 Uniplay: marcando renovacao_pendente para processamento via cron (mesma lógica do manual)`);
          await supabase.from('clientes').update({
            renovacao_pendente: true,
            renovacao_pendente_dados: {
              painel_id: painel.id,
              provedor: painel.provedor,
              usuario_painel: cliente.usuario,
              acessos_adicionais: (cliente as any).acessos_adicionais || [],
              tentativa_em: new Date().toISOString(),
            },
          }).eq('id', cliente.id);
          serverRenewalResult = { success: true, pendente_cron: true, message: 'Marcado para renovação via cron' };
        } else {
        // ── Outros provedores: via edge function ──
        const providerFunctionMap: Record<string, string> = {
          'mundogf': 'mundogf-renew',
          'koffice-api': 'koffice-renew',
          'koffice-v2': 'koffice-renew',
          'playfast': 'playfast-renew',
          'unitv': 'universal-panel',
        };
        const functionName = providerFunctionMap[painel.provedor] || 'playfast-renew';

        try {
          const painelCreds = await resolveVaultCreds(supabase, painel);
          let renewBody: any;

          if (functionName === 'universal-panel') {
            renewBody = {
              action: 'renew',
              panelId: painel.id,
              clientUsername: cliente.usuario,
              duration: renewalMonths > 0 ? renewalMonths : renewalDays,
              durationIn: renewalMonths > 0 ? 'months' : 'days',
              tipoPainel: cliente.tipo_painel || null,
            };
          } else if (functionName === 'playfast-renew') {
            const playfastToken = (painelCreds.usuario && painelCreds.usuario !== 'vault') 
              ? painelCreds.usuario 
              : painel.url.split('/').pop() || '';
            renewBody = {
              token: playfastToken,
              secret: painelCreds.senha,
              username: cliente.usuario,
              month: renewalMonths || Math.ceil(renewalDays / 30),
              action: 'renew',
            };
          } else {
            renewBody = {
              action: 'renew_by_username',
              panelId: painel.id,
              username: cliente.usuario,
              duration: renewalMonths > 0 ? renewalMonths : renewalDays,
              durationIn: renewalMonths > 0 ? 'months' : 'days',
              clienteScreens: cliente.telas || 1,
            };
          }

          const renewTimeout = functionName === 'mundogf-renew' ? 90000 : (functionName === 'universal-panel') ? 120000 : 30000;
          console.log(`⏱️ Chamando ${functionName} (timeout: ${renewTimeout/1000}s)`);
          
          const renewResp = await withTimeout(
            fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify(renewBody),
            }),
            renewTimeout
          );

          const renewData = await renewResp.json();
          serverRenewalResult = renewData;

          if (renewData.success) {
            console.log(`✅ Renovação no servidor concluída: ${JSON.stringify(renewData)}`);
            
            const acessos = (cliente as any).acessos_adicionais;
            if (Array.isArray(acessos) && acessos.length > 0) {
              for (const acesso of acessos) {
                if (!acesso.usuario) continue;
                try {
                  console.log(`🔄 Renovando acesso adicional: ${acesso.usuario}`);
                  let adicBody: any;
                  if (functionName === 'universal-panel') {
                    adicBody = { action: 'renew', panelId: painel.id, clientUsername: acesso.usuario, duration: renewalMonths > 0 ? renewalMonths : renewalDays, durationIn: renewalMonths > 0 ? 'months' : 'days', tipoPainel: acesso.tipo_painel || cliente.tipo_painel || null };
                  } else if (functionName === 'playfast-renew') {
                    const adicPlayfastToken = (painelCreds.usuario && painelCreds.usuario !== 'vault') ? painelCreds.usuario : painel.url.split('/').pop() || '';
                    adicBody = { token: adicPlayfastToken, secret: painelCreds.senha, username: acesso.usuario, month: renewalMonths || Math.ceil(renewalDays / 30), action: 'renew' };
                  } else {
                    adicBody = { action: 'renew_by_username', panelId: painel.id, username: acesso.usuario, duration: renewalMonths > 0 ? renewalMonths : renewalDays, durationIn: renewalMonths > 0 ? 'months' : 'days' };
                  }
                  const adicResp = await withTimeout(fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                    body: JSON.stringify(adicBody),
                  }), renewTimeout);
                  const adicData = await adicResp.json();
                  console.log(`${adicData.success ? '✅' : '⚠️'} Acesso adicional ${acesso.usuario}: ${adicData.success ? 'OK' : adicData.error}`);
                } catch (adicErr: any) {
                  console.error(`❌ Erro acesso adicional ${acesso.usuario}: ${adicErr.message}`);
                }
              }
            }
          } else {
            console.warn(`⚠️ Renovação no servidor falhou: ${renewData.error || 'Erro desconhecido'}`);
            // Mark as pending for cron retry (especially for mundogf which needs Browserbase)
            if (painel.provedor === 'mundogf') {
              console.log(`📌 MundoGF: marcando renovacao_pendente para retry via cron...`);
              await supabase.from('clientes').update({
                renovacao_pendente: true,
                renovacao_pendente_dados: {
                  painel_id: painel.id,
                  provedor: painel.provedor,
                  usuario_painel: cliente.usuario,
                  acessos_adicionais: (cliente as any).acessos_adicionais || [],
                  tentativa_em: new Date().toISOString(),
                  erro: renewData.error || 'Falha na renovação automática',
                },
              }).eq('id', cliente.id);
            }
          }
        } catch (err: any) {
          console.error(`❌ Erro na renovação do servidor: ${err.message}`);
          serverRenewalResult = { success: false, error: err.message };
          // Mark as pending for cron retry
          if (painel.provedor === 'mundogf') {
            console.log(`📌 MundoGF: marcando renovacao_pendente após erro: ${err.message}`);
            await supabase.from('clientes').update({
              renovacao_pendente: true,
              renovacao_pendente_dados: {
                painel_id: painel.id,
                provedor: painel.provedor,
                usuario_painel: cliente.usuario,
                acessos_adicionais: (cliente as any).acessos_adicionais || [],
                tentativa_em: new Date().toISOString(),
                erro: err.message,
              },
            }).eq('id', cliente.id);
          }
        }
        }
      }
    }

    // 6. Log the auto-renewal
    await supabase.from('logs_painel').insert({
      user_id: user_id,
      acao: `Renovação automática via ${gateway}: ${cliente.nome} (${cliente_whatsapp}) → +${renewalMonths > 0 ? renewalMonths + ' meses' : renewalDays + ' dias'}${serverRenewalResult?.success ? ' + servidor renovado' : ''}`,
      tipo: 'renovacao',
    });

    // 7. Update cobranca status if charge_id provided
    if (gateway_charge_id) {
      await supabase
        .from('cobrancas')
        .update({ status: 'pago', renovado: true })
        .eq('gateway', gateway)
        .eq('gateway_charge_id', gateway_charge_id)
        .eq('user_id', user_id);
    }

    // 8. Send WhatsApp confirmation message
    let whatsappResult: any = null;
    try {
      // Get confirmation message template
      const { data: mensagensPadroes } = await supabase
        .from('mensagens_padroes')
        .select('confirmacao_pagamento')
        .eq('user_id', user_id)
        .maybeSingle();

      const templateMsg = mensagensPadroes?.confirmacao_pagamento;
      if (templateMsg) {
        // Get plan value and resolved name for variable replacement
        let valorPlano = '';
        let planoNome = cliente.plano || '';
        let produtoNome = cliente.produto || '';
        if (cliente.plano) {
          let planoData: any = null;
          const { data: pByNome } = await supabase
            .from('planos')
            .select('nome, valor')
            .eq('user_id', user_id)
            .eq('nome', cliente.plano)
            .maybeSingle();
          planoData = pByNome;
          if (!planoData) {
            const { data: pById } = await supabase
              .from('planos')
              .select('nome, valor')
              .eq('user_id', user_id)
              .eq('id', cliente.plano)
              .maybeSingle();
            planoData = pById;
          }
          if (planoData) {
            planoNome = planoData.nome || cliente.plano;
            if (planoData.valor) {
              valorPlano = `R$ ${parseFloat(planoData.valor).toFixed(2).replace('.', ',')}`;
            }
          }
        }
        // Resolve produto name if it's a UUID
        if (cliente.produto) {
          const { data: prodById } = await supabase
            .from('produtos')
            .select('nome')
            .eq('user_id', user_id)
            .eq('id', cliente.produto)
            .maybeSingle();
          if (prodById?.nome) produtoNome = prodById.nome;
        }

        // Get profile and checkout config for extra variables
        const { data: profileData } = await supabase
          .from('profiles')
          .select('nome_empresa')
          .eq('user_id', user_id)
          .maybeSingle();

        const { data: checkoutData } = await supabase
          .from('checkout_config')
          .select('pix_manual_key')
          .eq('user_id', user_id)
          .maybeSingle();

        // Get latest pending fatura for link_fatura
        let linkFatura = '';
        if (cliente.id) {
          const { data: faturaData } = await supabase
            .from('faturas')
            .select('id')
            .eq('cliente_id', cliente.id)
            .eq('user_id', user_id)
            .in('status', ['pendente', 'pago'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (faturaData?.id) {
            linkFatura = `https://gestormsx.pro/fatura/${faturaData.id}`;
          }
        }

        // Calculate total
        let totalValue = '';
        if (valorPlano) {
          const valorNum = parseFloat(valorPlano.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          const descontoNum = parseFloat((cliente.desconto || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          const total = Math.max(0, valorNum - descontoNum);
          totalValue = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        // Replace variables in template
        const nomeCompleto = cliente.nome || '';
        const partes = nomeCompleto.trim().split(' ');
        const sobrenome = partes.length > 1 ? partes[partes.length - 1] : '';
        const hour = new Date().getHours();
        const saudacao = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
        const dd = String(newExpiry.getDate()).padStart(2, '0');
        const mm = String(newExpiry.getMonth() + 1).padStart(2, '0');
        const yyyy = newExpiry.getFullYear();
        const vencFormatado = `${dd}/${mm}/${yyyy}`;

        const replacements: Record<string, string> = {
          '{saudacao}': saudacao,
          '{nome_cliente}': nomeCompleto,
          '{nome}': partes[0] || '',
          '{cliente}': nomeCompleto,
          '{sobrenome}': sobrenome,
          '{whatsapp}': cliente.whatsapp || '',
          '{email}': cliente.email || '',
          '{usuario}': cliente.usuario || '',
          '{senha}': cliente.senha || '',
          '{vencimento}': vencFormatado,
          '{data_vencimento}': vencFormatado,
          '{data_venc_app}': cliente.data_venc_app || '',
          '{nome_plano}': planoNome,
          '{plano}': planoNome,
          '{valor_plano}': valorPlano,
          '{valor}': valorPlano,
          '{total}': totalValue,
          '{desconto}': cliente.desconto || '',
          '{obs}': cliente.observacao || '',
          '{app}': cliente.app || '',
          '{dispositivo}': cliente.dispositivo || '',
          '{telas}': cliente.telas?.toString() || '',
          '{mac}': cliente.mac || '',
          '{pix}': checkoutData?.pix_manual_key || '',
          '{link_fatura}': linkFatura,
          '{fatura_pdf}': linkFatura,
          '{nome_empresa}': profileData?.nome_empresa || '',
          '{produto}': produtoNome,
          '{aniversario}': cliente.aniversario || '',
          '{codigo_indicacao}': cliente.indicador || '',
        };

        let finalMsg = templateMsg;
        Object.entries(replacements).forEach(([key, value]) => {
          finalMsg = finalMsg.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        });
        finalMsg = finalMsg.replace(/{br}/g, '\n');

        // Send via Evolution API
        const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
        const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          const instanceName = `user_${user_id.replace(/-/g, '_')}`;
          const apiUrl = EVOLUTION_API_URL.replace(/\/$/, '');
          const formattedPhone = (cliente.whatsapp || '').replace(/\D/g, '');

          const sendResp = await withTimeout(
            fetch(`${apiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
              body: JSON.stringify({ number: formattedPhone, text: finalMsg, delay: 1200, linkPreview: false }),
            }),
            15000
          );
          const sendData = await sendResp.json();
          whatsappResult = { success: sendResp.ok, data: sendData };
          console.log(`📱 WhatsApp enviado para ***${formattedPhone.slice(-4)}: ${sendResp.ok ? '✅' : '❌'}`);

          // Register message in whatsapp_messages table so it appears in the queue UI
          try {
            await supabase.from('whatsapp_messages').insert({
              user_id,
              session_id: instanceName,
              phone: formattedPhone,
              message: finalMsg,
              status: sendResp.ok ? 'sent' : 'failed',
              error_message: sendResp.ok ? null : JSON.stringify(sendData),
              sent_at: new Date().toISOString(),
            });
          } catch (insertErr: any) {
            console.warn(`⚠️ Falha ao registrar mensagem na fila: ${insertErr.message}`);
          }
        } else {
          console.warn('⚠️ Evolution API não configurada, mensagem não enviada');
          whatsappResult = { success: false, error: 'Evolution API não configurada' };
        }
      } else {
        console.log('ℹ️ Sem template de confirmação de pagamento configurado');
        whatsappResult = { success: false, error: 'Template não configurado' };
      }
    } catch (whatsErr: any) {
      console.error(`❌ Erro ao enviar WhatsApp: ${whatsErr.message}`);
      whatsappResult = { success: false, error: whatsErr.message };
    }

    // 9. Send payment notification to the OWNER's own WhatsApp
    let ownerNotifResult: any = null;
    try {
      // Get owner's WhatsApp number from notificacoes_config or profiles
      const { data: notifConfig } = await supabase
        .from('notificacoes_config')
        .select('whatsapp_pagamentos, notif_confirmacao_pagamento')
        .eq('user_id', user_id)
        .maybeSingle();

      let ownerPhone = notifConfig?.whatsapp_pagamentos || '';

      // Fallback to profile phone
      if (!ownerPhone) {
        const { data: profilePhone } = await supabase
          .from('profiles')
          .select('telefone')
          .eq('user_id', user_id)
          .maybeSingle();
        ownerPhone = profilePhone?.telefone || '';
      }

      ownerPhone = (ownerPhone || '').replace(/\D/g, '');

      if (ownerPhone && ownerPhone.length >= 10) {
        // Get server/panel name for the notification
        let servidorNome = '';
        if (cliente.produto) {
          let produtoInfo: any = null;
          const { data: pById } = await supabase
            .from('produtos')
            .select('nome, paineis_integracao(nome)')
            .eq('user_id', user_id)
            .eq('id', cliente.produto)
            .maybeSingle();
          produtoInfo = pById;
          if (!produtoInfo) {
            const { data: pByNome } = await supabase
              .from('produtos')
              .select('nome, paineis_integracao(nome)')
              .eq('user_id', user_id)
              .eq('nome', cliente.produto)
              .maybeSingle();
            produtoInfo = pByNome;
          }
          if (produtoInfo?.paineis_integracao?.nome) {
            servidorNome = produtoInfo.paineis_integracao.nome;
          }
        }

        // Get plan value and resolved name
        let valorFatura = '';
        let planoNomeResolvido = cliente.plano || 'N/A';
        if (cliente.plano) {
          let planoVal: any = null;
          const { data: pByNome } = await supabase
            .from('planos')
            .select('nome, valor')
            .eq('user_id', user_id)
            .eq('nome', cliente.plano)
            .maybeSingle();
          planoVal = pByNome;
          if (!planoVal) {
            const { data: pById } = await supabase
              .from('planos')
              .select('nome, valor')
              .eq('user_id', user_id)
              .eq('id', cliente.plano)
              .maybeSingle();
            planoVal = pById;
          }
          if (planoVal) {
            planoNomeResolvido = planoVal.nome || cliente.plano;
            if (planoVal.valor) {
              const rawValor = String(planoVal.valor).replace(/[R$\s]/g, '');
              const normalizedValor = rawValor.includes(',') ? rawValor.replace(/\./g, '').replace(',', '.') : rawValor;
              const valorNum = parseFloat(normalizedValor) || 0;
              const rawDesconto = String(cliente.desconto || '0').replace(/[R$\s]/g, '');
              const normalizedDesconto = rawDesconto.includes(',') ? rawDesconto.replace(/\./g, '').replace(',', '.') : rawDesconto;
              const descontoNum = parseFloat(normalizedDesconto) || 0;
              const total = Math.max(0, valorNum - descontoNum);
              valorFatura = `R$ ${total.toFixed(2).replace('.', ',')}`;
            }
          }
        }

        const ownerMsg = `O cliente *${cliente.nome}*${cliente.usuario ? ` (${cliente.usuario})` : ''}, WhatsApp (${cliente.whatsapp || cliente_whatsapp})${servidorNome ? ` do servidor *${servidorNome}*` : ''} pagou a fatura no valor de ${valorFatura || 'N/A'} referente ao plano *${planoNomeResolvido}* pelo Gestor Msx via *${gateway}*`;

        const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
        const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          const instanceName = `user_${user_id.replace(/-/g, '_')}`;
          const apiUrl = EVOLUTION_API_URL.replace(/\/$/, '');
          const normalizedOwnerPhone = !ownerPhone.startsWith('55') && ownerPhone.length >= 10 ? '55' + ownerPhone : ownerPhone;

          const ownerResp = await withTimeout(
            fetch(`${apiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
              body: JSON.stringify({ number: normalizedOwnerPhone, text: ownerMsg, delay: 1200, linkPreview: false }),
            }),
            15000
          );
          ownerNotifResult = { success: ownerResp.ok };
          console.log(`📱 Notificação ao dono enviada para ***${normalizedOwnerPhone.slice(-4)}: ${ownerResp.ok ? '✅' : '❌'}`);
        }
      } else {
        console.log('ℹ️ WhatsApp do dono não configurado, notificação não enviada');
      }
    } catch (ownerErr: any) {
      console.error(`⚠️ Erro ao notificar dono: ${ownerErr.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Cliente ${cliente.nome} renovado com sucesso`,
      cliente_nome: cliente.nome,
      nova_data_vencimento: newExpiry.toISOString(),
      server_renewal: serverRenewalResult,
      whatsapp_message: whatsappResult,
      owner_notification: ownerNotifResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('🚨 Auto-renew error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
