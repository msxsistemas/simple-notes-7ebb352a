import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
  });
}

// ── Sigma API helpers (direct) ──

async function sigmaLogin(baseUrl: string, username: string, password: string): Promise<string> {
  const url = `${baseUrl}/api/auth/login`;
  console.log(`🔑 Sigma: login em ${url}`);

  const resp = await withTimeout(fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      captcha: 'not-a-robot',
      captchaChecked: true,
      twofactor_code: '',
      twofactor_recovery_code: '',
      twofactor_trusted_device_id: '',
    }),
  }), 15000);

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`❌ Sigma login failed: ${resp.status} - ${text.substring(0, 300)}`);
    throw new Error(`Login falhou (${resp.status}): Verifique suas credenciais.`);
  }

  const data = await resp.json();
  const token = data.token;
  if (!token) {
    throw new Error('Login OK mas token não retornado.');
  }
  console.log(`✅ Sigma: login OK`);
  return token;
}

async function sigmaGet(baseUrl: string, path: string, token: string): Promise<any> {
  const resp = await withTimeout(fetch(`${baseUrl}${path}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }), 15000);

  if (resp.status === 401 || resp.status === 403) throw new Error('SESSION_EXPIRED');
  if (!resp.ok) throw new Error(`GET ${path} falhou: ${resp.status}`);
  return resp.json();
}

async function sigmaPost(baseUrl: string, path: string, token: string, body: any): Promise<any> {
  const resp = await withTimeout(fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }), 15000);

  if (resp.status === 401 || resp.status === 403) throw new Error('SESSION_EXPIRED');
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`POST ${path} falhou: ${resp.status} - ${text.substring(0, 200)}`);
  }
  return resp.json();
}

// ── Token cache ──

async function getToken(
  supabase: any, panelId: string, userId: string,
  baseUrl: string, username: string, password: string,
  forceRefresh = false,
): Promise<string> {
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('cached_panel_sessions')
      .select('access_token, expires_at')
      .eq('painel_id', panelId).eq('user_id', userId).eq('provedor', 'sigma')
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log(`📦 Sigma: token cacheado`);
      return cached.access_token;
    }
  }

  const token = await sigmaLogin(baseUrl, username, password);

  await supabase.from('cached_panel_sessions').upsert({
    painel_id: panelId, user_id: userId, provedor: 'sigma',
    access_token: token,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'painel_id,user_id,provedor' });

  return token;
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { panelId, username, action } = await req.json();

    if (!panelId) {
      return new Response(JSON.stringify({ success: false, error: 'panelId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: panel } = await supabase
      .from('paineis_integracao').select('*')
      .eq('id', panelId).eq('user_id', user.id).single();

    if (!panel) {
      return new Response(JSON.stringify({ success: false, error: 'Painel não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = panel.url.replace(/\/$/, '');
    const panelUser = panel.usuario;
    const panelPass = panel.senha;

    const executeWithRetry = async (fn: (token: string) => Promise<any>) => {
      let token = await getToken(supabase, panelId, user.id, baseUrl, panelUser, panelPass);
      try {
        return await fn(token);
      } catch (e: any) {
        if (e.message === 'SESSION_EXPIRED') {
          console.log(`🔄 Sigma: token expirado, refazendo login...`);
          token = await getToken(supabase, panelId, user.id, baseUrl, panelUser, panelPass, true);
          return await fn(token);
        }
        throw e;
      }
    };

    // ── RENEW ──
    if (action === 'renew') {
      if (!username) {
        return new Response(JSON.stringify({ success: false, error: 'username obrigatório para renovação' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeWithRetry(async (token) => {
        console.log(`🔍 Sigma: buscando cliente "${username}"...`);
        const searchData = await sigmaGet(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(username)}&perPage=5`, token);
        const customers = searchData.data || [];
        if (customers.length === 0) throw new Error(`Cliente "${username}" não encontrado no painel.`);

        const customer = customers[0];
        console.log(`✅ Sigma: cliente encontrado - id=${customer.id}`);

        const renewResult = await sigmaPost(baseUrl, `/api/customers/${customer.id}/renew`, token, {
          package_id: customer.package_id,
          connections: customer.connections || 1,
        });

        const renewed = renewResult.data || renewResult;
        return {
          success: true,
          message: `Renovado com sucesso! Nova expiração: ${renewed.expires_at_tz || renewed.expires_at || 'N/A'}`,
          customer: {
            id: renewed.id, username: renewed.username, name: renewed.name,
            expires_at: renewed.expires_at_tz || renewed.expires_at,
            package: renewed.package, connections: renewed.connections,
          },
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SEARCH ──
    if (action === 'search') {
      if (!username) {
        return new Response(JSON.stringify({ success: false, error: 'username obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeWithRetry(async (token) => {
        const searchData = await sigmaGet(baseUrl, `/api/customers?page=1&username=${encodeURIComponent(username)}&perPage=20`, token);
        return { success: true, customers: searchData.data || [] };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CHECK CREDITS ──
    if (action === 'check-credits') {
      const result = await executeWithRetry(async (token) => {
        const data = await sigmaGet(baseUrl, '/api/auth/me', token);
        return { success: true, credits: data.credits, username: data.username, name: data.name };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Ação "${action}" não suportada. Use: renew, search, check-credits` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Sigma error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
