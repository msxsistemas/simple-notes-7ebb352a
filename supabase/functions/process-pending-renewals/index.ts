import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── VPS Relay helper ──

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

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
      console.log(`✅ Cloudflare resolvido! ${data.cached ? '(cache)' : '(novo)'}`);
    } else {
      console.warn(`⚠️ FlareSolverr falhou: ${data.error || 'desconhecido'}`);
    }
  } catch (e: any) {
    console.warn(`⚠️ FlareSolverr indisponível: ${e.message}`);
  }
}

// Sigma via VPS Relay (bypasses Cloudflare)
async function sigmaLogin(baseUrl: string, username: string, password: string): Promise<string> {
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

async function sigmaGet(baseUrl: string, path: string, token: string): Promise<any> {
  const result = await relayFetch(`${baseUrl}${path}`, 'GET', {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  });
  if (result.status !== 200) throw new Error(`GET ${path} falhou: ${result.status}`);
  return JSON.parse(result.body);
}

async function sigmaPost(baseUrl: string, path: string, token: string, body: any): Promise<any> {
  const result = await relayFetch(`${baseUrl}${path}`, 'POST', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  }, body);
  if (result.status !== 200) throw new Error(`POST ${path} falhou: ${result.status} - ${result.body.substring(0, 200)}`);
  return JSON.parse(result.body);
}

async function resolveVaultCreds(supabase: any, panel: any) {
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

async function reconcilePendingFaturas(supabase: any, supabaseUrl: string, supabaseKey: string) {
  // Reconcile ALL pending faturas with gateway_charge_id (not just Woovi)
  const { data: pendingFaturas, error } = await supabase
    .from('faturas')
    .select('id, status, gateway_charge_id, gateway, user_id, cliente_whatsapp, created_at')
    .eq('status', 'pendente')
    .not('gateway_charge_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error(`❌ Erro ao buscar faturas pendentes: ${error.message}`);
    return { checked: 0, paid: 0, errors: 1 };
  }

  if (!pendingFaturas || pendingFaturas.length === 0) {
    console.log('✅ Nenhuma fatura pendente para reconciliar');
    return { checked: 0, paid: 0, errors: 0 };
  }

  console.log(`🔄 Reconciliando ${pendingFaturas.length} fatura(s) pendente(s)...`);

  let checked = 0;
  let paid = 0;
  let errors = 0;

  for (const fatura of pendingFaturas) {
    checked++;
    try {
      // Call get-fatura which checks payment status in real-time
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-fatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ action: 'get-fatura', fatura_id: fatura.id }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        errors++;
        console.warn(`⚠️ Reconcile fatura ${fatura.id} (${fatura.gateway}): ${data?.error || `HTTP ${resp.status}`}`);
        continue;
      }

      if (data?.fatura?.status === 'pago') {
        paid++;
        console.log(`✅ Reconcile: fatura ${fatura.id} (${fatura.gateway}) confirmada como paga`);
      }
    } catch (reconcileErr: any) {
      errors++;
      console.error(`❌ Reconcile fatura ${fatura.id}: ${reconcileErr.message}`);
    }
  }

  return { checked, paid, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const invoiceReconciliation = await reconcilePendingFaturas(supabase, supabaseUrl, supabaseKey);

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('renovacao_pendente', true);

    if (error) throw error;

    const clientesPendentes = clientes || [];
    if (clientesPendentes.length === 0) {
      console.log('✅ Nenhuma renovação pendente em clientes');
    } else {
      console.log(`🔄 ${clientesPendentes.length} renovação(ões) pendente(s)`);
    }

    // Group by panel
    const byPanel = new Map<string, any[]>();
    for (const c of clientesPendentes) {
      const dados = c.renovacao_pendente_dados as any;
      if (!dados?.painel_id) continue;
      if (!byPanel.has(dados.painel_id)) byPanel.set(dados.painel_id, []);
      byPanel.get(dados.painel_id)!.push(c);
    }

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const [painelId, clientesList] of byPanel) {
      try {
        const { data: painel } = await supabase
          .from('paineis_integracao')
          .select('*')
          .eq('id', painelId)
          .maybeSingle();

        if (!painel) {
          console.warn(`⚠️ Painel ${painelId} não encontrado`);
          continue;
        }

        const provedor = painel.provedor || '';

        // For non-Sigma providers, delegate to the appropriate edge function
        if (['koffice-api', 'koffice-v2', 'mundogf', 'playfast', 'uniplay', 'unitv'].includes(provedor)) {
          const providerFunctionMap: Record<string, string> = {
            'koffice-api': 'koffice-renew',
            'koffice-v2': 'koffice-renew',
            'mundogf': 'mundogf-renew',
            'playfast': 'playfast-renew',
            'uniplay': 'universal-panel',
            'unitv': 'universal-panel',
          };
          const functionName = providerFunctionMap[provedor] || 'koffice-renew';

          for (const cliente of clientesList) {
            const dados = cliente.renovacao_pendente_dados as any;
            const username = dados?.usuario_painel || cliente.usuario;

            try {
              // Get plan info for duration
              let duration = 1;
              let durationIn = 'months';
              if (cliente.plano) {
                const { data: plano } = await supabase
                  .from('planos')
                  .select('quantidade, tipo')
                  .eq('user_id', cliente.user_id)
                  .eq('nome', cliente.plano)
                  .maybeSingle();
                if (!plano && cliente.plano.length > 30) {
                  const { data: planoById } = await supabase
                    .from('planos')
                    .select('quantidade, tipo')
                    .eq('id', cliente.plano)
                    .maybeSingle();
                  if (planoById) {
                    duration = parseInt(planoById.quantidade || '1') || 1;
                    durationIn = planoById.tipo === 'dias' ? 'days' : 'months';
                  }
                } else if (plano) {
                  duration = parseInt(plano.quantidade || '1') || 1;
                  durationIn = plano.tipo === 'dias' ? 'days' : 'months';
                }
              }

              console.log(`🔄 Delegando renovação pendente de "${username}" para ${functionName} (${provedor})`);

              let renewBody: any;
                if (functionName === 'universal-panel') {
                  renewBody = {
                    action: 'renew',
                    panelId: painel.id,
                    clientUsername: username,
                    duration,
                    durationIn,
                    runAsync: false,
                    userId: cliente.user_id,
                  };
                } else if (functionName === 'playfast-renew') {
                const creds = await resolveVaultCreds(supabase, painel);
                const pfToken = (creds.usuario && creds.usuario !== 'vault') ? creds.usuario : painel.url.split('/').pop() || '';
                renewBody = { token: pfToken, secret: creds.senha, username, month: duration, action: 'renew' };
              } else {
                renewBody = { action: 'renew_by_username', panelId: painel.id, username, duration, durationIn, clienteScreens: cliente.telas || 1 };
              }

              const renewResp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify(renewBody),
              });
              const renewText = await renewResp.text();
              let renewData: any = {};
              try {
                renewData = renewText ? JSON.parse(renewText) : {};
              } catch {
                throw new Error(`Resposta inválida de ${functionName}: ${renewText.substring(0, 200)}`);
              }

              if (!renewResp.ok) {
                throw new Error(renewData?.error || `${functionName} HTTP ${renewResp.status}`);
              }
              if (renewData?.async === true) {
                throw new Error(`${functionName} retornou assíncrono sem confirmação final`);
              }

              if (renewData.success) {
                console.log(`✅ "${username}" renovado via ${functionName}`);

                // Handle additional accesses
                const acessos = dados?.acessos_adicionais || [];
                for (const acesso of acessos) {
                  if (!acesso.usuario) continue;
                  try {
                    let adicBody: any;
                      if (functionName === 'universal-panel') {
                        adicBody = {
                          action: 'renew',
                          panelId: painel.id,
                          clientUsername: acesso.usuario,
                          duration,
                          durationIn,
                          runAsync: false,
                          userId: cliente.user_id,
                        };
                      } else if (functionName === 'playfast-renew') {
                      const adicCreds = await resolveVaultCreds(supabase, painel);
                      const adicPfToken = (adicCreds.usuario && adicCreds.usuario !== 'vault') ? adicCreds.usuario : painel.url.split('/').pop() || '';
                      adicBody = { token: adicPfToken, secret: adicCreds.senha, username: acesso.usuario, month: duration, action: 'renew' };
                    } else {
                      adicBody = { action: 'renew_by_username', panelId: painel.id, username: acesso.usuario, duration, durationIn, clienteScreens: cliente.telas || 1 };
                    }
                    const adicResp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                      body: JSON.stringify(adicBody),
                    });
                    const adicText = await adicResp.text();
                    let adicData: any = {};
                    try {
                      adicData = adicText ? JSON.parse(adicText) : {};
                    } catch {
                      throw new Error(`Resposta inválida acesso adicional: ${adicText.substring(0, 200)}`);
                    }
                    if (!adicResp.ok) {
                      throw new Error(adicData?.error || `${functionName} HTTP ${adicResp.status}`);
                    }
                    if (adicData?.async === true) {
                      throw new Error(`${functionName} adicional retornou assíncrono sem confirmação final`);
                    }
                    console.log(`${adicData.success ? '✅' : '⚠️'} Acesso adicional "${acesso.usuario}": ${adicData.success ? 'OK' : adicData.error}`);
                  } catch (adicErr: any) {
                    console.error(`❌ Acesso adicional "${acesso.usuario}": ${adicErr.message}`);
                  }
                }

                await supabase.from('clientes').update({
                  renovacao_pendente: false,
                  renovacao_pendente_dados: null,
                }).eq('id', cliente.id);

                await supabase.from('logs_painel').insert({
                  user_id: cliente.user_id,
                  acao: `Renovação pendente concluída (cron): ${cliente.nome} (${username}) via ${functionName}`,
                  tipo: 'renovacao',
                });

                processed++;
                results.push({ nome: cliente.nome, username, success: true });
              } else {
                throw new Error(renewData.error || 'Erro desconhecido');
              }
            } catch (renewErr: any) {
              console.error(`❌ "${username}": ${renewErr.message}`);
              failed++;
              results.push({ nome: cliente.nome, username, success: false, error: renewErr.message });

              const tentativas = (dados?.tentativas || 0) + 1;
              if (tentativas >= 6) {
                console.warn(`⚠️ Desistindo de ${cliente.nome} após ${tentativas} tentativas`);
                await supabase.from('clientes').update({
                  renovacao_pendente: false,
                  renovacao_pendente_dados: null,
                }).eq('id', cliente.id);
                await supabase.from('logs_painel').insert({
                  user_id: cliente.user_id,
                  acao: `Renovação pendente FALHOU após ${tentativas} tentativas: ${cliente.nome} - ${renewErr.message}`,
                  tipo: 'erro',
                });
              } else {
                await supabase.from('clientes').update({
                  renovacao_pendente_dados: { ...dados, tentativas, ultimo_erro: renewErr.message, ultima_tentativa: new Date().toISOString() },
                }).eq('id', cliente.id);
              }
            }
          }
          continue; // Skip Sigma logic below
        }

        // Sigma providers: use direct API calls
        const creds = await resolveVaultCreds(supabase, painel);
        const baseUrl = painel.url.replace(/\/+$/, '');

        console.log(`🔑 Login no painel ${painel.nome} (${baseUrl})...`);
        const token = await sigmaLogin(baseUrl, creds.usuario, creds.senha);

        for (const cliente of clientesList) {
          const dados = cliente.renovacao_pendente_dados as any;
          const username = dados?.usuario_painel || cliente.usuario;

          try {
            console.log(`🔍 Buscando "${username}"...`);
            const searchData = await sigmaGet(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(username)}&perPage=5`, token);
            const customers = searchData.data || [];
            const found = customers.find((c: any) => c.username === username);
            if (!found) throw new Error(`"${username}" não encontrado no painel`);

            console.log(`🔄 Renovando "${username}" (id=${found.id})...`);
            const renewData = await sigmaPost(baseUrl, `/api/customers/${found.id}/renew`, token, {
              package_id: found.package_id,
              connections: found.connections || 1,
            });
            const renewed = renewData.data || renewData;
            console.log(`✅ "${username}" renovado: ${renewed.expires_at_tz || renewed.expires_at}`);

            // Additional accesses
            const acessos = dados?.acessos_adicionais || [];
            for (const acesso of acessos) {
              if (!acesso.usuario) continue;
              try {
                const adicSearch = await sigmaGet(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(acesso.usuario)}&perPage=5`, token);
                const adicFound = (adicSearch.data || []).find((c: any) => c.username === acesso.usuario);
                if (adicFound) {
                  await sigmaPost(baseUrl, `/api/customers/${adicFound.id}/renew`, token, {
                    package_id: adicFound.package_id,
                    connections: adicFound.connections || 1,
                  });
                  console.log(`✅ Acesso adicional "${acesso.usuario}" renovado`);
                }
              } catch (adicErr: any) {
                console.error(`❌ Acesso adicional "${acesso.usuario}": ${adicErr.message}`);
              }
            }

            // Clear pending flag
            await supabase.from('clientes').update({
              renovacao_pendente: false,
              renovacao_pendente_dados: null,
            }).eq('id', cliente.id);

            await supabase.from('logs_painel').insert({
              user_id: cliente.user_id,
              acao: `Renovação pendente concluída (cron): ${cliente.nome} (${username})`,
              tipo: 'renovacao',
            });

            processed++;
            results.push({ nome: cliente.nome, username, success: true });
          } catch (renewErr: any) {
            console.error(`❌ "${username}": ${renewErr.message}`);
            failed++;
            results.push({ nome: cliente.nome, username, success: false, error: renewErr.message });
          }
        }
      } catch (panelErr: any) {
        console.error(`❌ Painel ${painelId}: ${panelErr.message}`);
        failed += clientesList.length;
        for (const c of clientesList) {
          const dados = c.renovacao_pendente_dados as any;
          const tentativas = (dados?.tentativas || 0) + 1;
          if (tentativas >= 6) {
            console.warn(`⚠️ Desistindo de ${c.nome} após ${tentativas} tentativas`);
            await supabase.from('clientes').update({
              renovacao_pendente: false,
              renovacao_pendente_dados: null,
            }).eq('id', c.id);
            await supabase.from('logs_painel').insert({
              user_id: c.user_id,
              acao: `Renovação pendente FALHOU após ${tentativas} tentativas: ${c.nome} - ${panelErr.message}`,
              tipo: 'erro',
            });
          } else {
            await supabase.from('clientes').update({
              renovacao_pendente_dados: { ...dados, tentativas, ultimo_erro: panelErr.message, ultima_tentativa: new Date().toISOString() },
            }).eq('id', c.id);
          }
        }
      }
    }

    console.log(`📊 Resultado: ${processed} renovado(s), ${failed} falha(s) | Reconcile: ${invoiceReconciliation.checked} verificada(s), ${invoiceReconciliation.paid} paga(s), ${invoiceReconciliation.errors} erro(s)`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      results,
      invoice_reconciliation: invoiceReconciliation,
    }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('🚨 Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
