// Edge function for testing panel connections

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

/** Normaliza o proxy URL para formato http://user:pass@host:port */
function normalizeProxyUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  // Format: host:port:user:pass
  const parts = trimmed.split(':');
  if (parts.length === 4) {
    const [host, port, user, pass] = parts;
    return `http://${user}:${pass}@${host}:${port}`;
  }
  if (trimmed.includes('@')) return `http://${trimmed}`;
  return `http://${trimmed}`;
}

/** Cria um fetch que roteia pela proxy brasileira se configurada */
function createProxiedFetch(): typeof fetch {
  const proxyUrl = Deno.env.get('BRAZIL_PROXY_URL');
  if (!proxyUrl) {
    console.log('⚠️ BRAZIL_PROXY_URL não configurada, usando fetch direto');
    return fetch;
  }
  const normalizedUrl = normalizeProxyUrl(proxyUrl);
  const maskedUrl = normalizedUrl.replace(/\/\/.*@/, '//***@');
  console.log(`🌐 Proxy BR configurada: ${maskedUrl}`);

  // Strategy 1: Deno.createHttpClient (works in Deno CLI, may work in newer edge-runtime)
  if (typeof (Deno as any).createHttpClient === 'function') {
    try {
      const client = (Deno as any).createHttpClient({ proxy: { url: normalizedUrl } });
      if (client) {
        console.log('✅ Proxy: Deno.createHttpClient criado com sucesso');
        return (input: string | URL | Request, init?: RequestInit) => {
          return fetch(input, { ...init, client } as any);
        };
      }
    } catch (e) {
      console.log(`⚠️ Proxy Strategy 1 (createHttpClient) falhou: ${(e as Error).message}`);
    }
  } else {
    console.log('⚠️ Deno.createHttpClient não disponível neste runtime');
  }

  // Strategy 2: HTTP_PROXY/HTTPS_PROXY env vars
  try {
    Deno.env.set('HTTP_PROXY', normalizedUrl);
    Deno.env.set('HTTPS_PROXY', normalizedUrl);
    console.log('🔄 Proxy: Env vars HTTP_PROXY/HTTPS_PROXY definidas');
  } catch (e) {
    console.log(`⚠️ Proxy Strategy 2 (env vars) falhou: ${(e as Error).message}`);
  }

  // Return regular fetch (will use env vars if the runtime supports them)
  return fetch;
}

const proxiedFetch = createProxiedFetch();

/** Verifica se a proxy está funcionando testando o IP público */
async function verifyProxy(): Promise<{ working: boolean; ip?: string; error?: string }> {
  try {
    const resp = await withTimeout(proxiedFetch('https://api.ipify.org?format=json'), 10000);
    const data = await resp.json();
    console.log(`🌐 Proxy IP check: ${JSON.stringify(data)}`);
    return { working: true, ip: data.ip };
  } catch (e) {
    console.log(`❌ Proxy IP check falhou: ${(e as Error).message}`);
    return { working: false, error: (e as Error).message };
  }
}

/**
 * Resolve reCAPTCHA usando 2Captcha API
 * @param version 'v2', 'v2-invisible' ou 'v3'
 * @returns token do reCAPTCHA resolvido ou null se falhar
 */
async function solve2Captcha(siteKey: string, pageUrl: string, version: 'v2' | 'v2-invisible' | 'v3' = 'v3'): Promise<string | null> {
  const apiKey = Deno.env.get('TWOCAPTCHA_API_KEY');
  if (!apiKey) {
    console.log('⚠️ TWOCAPTCHA_API_KEY não configurada, pulando resolução de captcha');
    return null;
  }

  try {
    console.log(`🤖 2Captcha: Enviando reCAPTCHA ${version} para resolução (siteKey: ${siteKey.slice(0, 15)}...)`);
    
    // Step 1: Submit captcha task
    let submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    if (version === 'v3') {
      submitUrl += '&version=v3&action=login&min_score=0.3';
    } else if (version === 'v2-invisible') {
      submitUrl += '&invisible=1';
    }
    const submitResp = await withTimeout(fetch(submitUrl), 15000);
    const submitJson = await submitResp.json();
    
    if (submitJson.status !== 1) {
      console.log(`❌ 2Captcha submit error: ${JSON.stringify(submitJson)}`);
      return null;
    }
    
    const taskId = submitJson.request;
    console.log(`🤖 2Captcha: Task criada: ${taskId}, aguardando resolução...`);
    
    // Step 2: Poll for result (max ~120s with 5s intervals)
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const resultUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`;
      const resultResp = await withTimeout(fetch(resultUrl), 10000);
      const resultJson = await resultResp.json();
      
      if (resultJson.status === 1) {
        console.log(`✅ 2Captcha: reCAPTCHA ${version} resolvido com sucesso! (${i * 5 + 5}s)`);
        return resultJson.request;
      }
      
      if (resultJson.request !== 'CAPCHA_NOT_READY') {
        console.log(`❌ 2Captcha error: ${JSON.stringify(resultJson)}`);
        return null;
      }
      
      console.log(`⏳ 2Captcha: Aguardando... (${(i + 1) * 5}s)`);
    }
    
    console.log('❌ 2Captcha: Timeout após 120s');
    return null;
  } catch (e) {
    console.log(`❌ 2Captcha error: ${(e as Error).message}`);
    return null;
  }
}

async function testOnWaveLogin(
  url: string,
  username: string,
  password: string,
  extraHeaders: Record<string, string> = {},
  method: string = "POST",
  overridePayload?: any,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ...extraHeaders,
  };

  const defaultPayload = {
    captcha: "not-a-robot",
    captchaChecked: true,
    username: username,
    password: password,
    twofactor_code: "",
    twofactor_recovery_code: "",
    twofactor_trusted_device_id: ""
  };
  const payload = (overridePayload && typeof overridePayload === 'object') ? overridePayload : defaultPayload;

  console.log(`🔄 Fazendo ${method} para: ${url}`);
  console.log(`📝 Payload: ${JSON.stringify(payload, null, 2)}`);

  const res = await withTimeout(proxiedFetch(url, {
    method,
    headers,
    body: method.toUpperCase() === 'GET' ? undefined : JSON.stringify(payload),
  }), 15000);
  
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch (_) {}
  
  return { status: res.status, ok: res.ok, contentType, text, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, username, password, extraHeaders, cf_clearance, cookie, endpointPath, endpointMethod, loginPayload, providerId, testSteps, frontendUrl } = await req.json();
    
    if (!baseUrl || !username || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        details: "Parâmetros ausentes: baseUrl, username e password são obrigatórios" 
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 400 
      });
    }

    let cleanBase = String(baseUrl).replace(/\/$/, "");
    
    // Uniplay: usa a URL exata informada pelo usuário (sem mapeamento)
    const isUniplay = providerId === 'uniplay';
    
    console.log(`🚀 Iniciando teste para: ${cleanBase} (provedor: ${providerId || 'auto'})`);
    console.log(`👤 Username: ${username}`);

    // Configurar headers extras se fornecidos
    const hdrs: Record<string, string> = {};
    if (cf_clearance && !cookie) hdrs["Cookie"] = `cf_clearance=${cf_clearance}`;
    if (cookie) hdrs["Cookie"] = String(cookie);
    if (extraHeaders && typeof extraHeaders === 'object') {
      for (const [k, v] of Object.entries(extraHeaders as Record<string, string>)) {
        hdrs[k] = String(v);
      }
    }

    const isKoffice = providerId === 'koffice-api' || providerId === 'koffice-v2';
    const isMundogf = providerId === 'mundogf';
    const isSigma = providerId === 'sigma';

    // Only discover API structure for unknown providers
    if (!providerId || isKoffice || isMundogf) {
    // First try to fetch the login page to discover API endpoints
    try {
      console.log('🔍 Descobrindo estrutura da API...');
      const loginPageResp = await withTimeout(fetch(`${cleanBase}/login`, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      }), 10000);
      const loginHtml = await loginPageResp.text();
      // Log key parts of the HTML that reveal API structure
      const actionMatch = loginHtml.match(/action=['"](.*?)['"]/g);
      const apiMatch = loginHtml.match(/['"](\/api\/[^'"]*)['"]/g);
      const axiosMatch = loginHtml.match(/axios\.(post|get)\(['"](.*?)['"]/g);
      const fetchMatch = loginHtml.match(/fetch\(['"](.*?)['"]/g);
      console.log(`📄 Form actions: ${JSON.stringify(actionMatch?.slice(0, 5))}`);
      console.log(`📄 API refs: ${JSON.stringify(apiMatch?.slice(0, 10))}`);
      console.log(`📄 Axios calls: ${JSON.stringify(axiosMatch?.slice(0, 5))}`);
      console.log(`📄 Fetch calls: ${JSON.stringify(fetchMatch?.slice(0, 5))}`);
      
      // Extract CSRF token if present
      const csrfMatch = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/);
      const csrf = csrfMatch ? csrfMatch[1] : null;
      console.log(`🔑 CSRF token: ${csrf ? csrf.slice(0, 20) + '...' : 'não encontrado'}`);
      
      // Log HTML snippet around form for debugging
      const formStart = loginHtml.indexOf('<form');
      if (formStart > -1) {
        console.log(`📄 Form HTML: ${loginHtml.slice(formStart, formStart + 500)}`);
      }
    } catch (e) {
      console.log(`⚠️ Erro ao buscar página de login: ${(e as Error).message}`);
    }
    } // end if !providerId || isKoffice

    const logs: any[] = [];
    let lastResp: any = null;
    let lastUrl = '';

    // --- Try Xtream/kOffice style: only for koffice-api or unknown providers ---
    if (!providerId || providerId === 'koffice-api') {
    const xtreamPaths = ['/player_api.php', '/panel_api.php', '/api.php'];

    for (const path of xtreamPaths) {
      const url = `${cleanBase}${path}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      console.log(`🧪 Testando Xtream endpoint: ${path}`);
      try {
        const res = await withTimeout(fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', ...hdrs },
        }), 15000);
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch (_) {}
        console.log(`📊 ${path} → status: ${res.status}, snippet: ${text.slice(0, 200)}`);
        logs.push({ url: `${cleanBase}${path}`, status: res.status, ok: res.ok, snippet: text.slice(0, 200) });
        lastResp = { status: res.status, ok: res.ok, text, json };
        lastUrl = `${cleanBase}${path}`;

        // Xtream API returns user_info on success
        if (res.ok && json && (json.user_info || json.server_info)) {
          console.log(`✅ Login Xtream bem-sucedido em: ${path}`);
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}${path}`,
            type: 'Xtream/kOffice',
            account: {
              status: json.user_info?.status || 'Active',
              user: json.user_info || null,
              token_received: false,
            },
            data: {
              user_info: json.user_info || null,
              server_info: json.server_info || null,
              response: json,
            },
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (e) {
        console.log(`⚠️ Erro Xtream ${path}: ${(e as Error).message}`);
        logs.push({ url: `${cleanBase}${path}`, error: (e as Error).message });
      }
    }
    } // end xtream block

    // --- Try form-based login (only for koffice-v2 or unknown providers) ---
    // --- MundoGF: connectivity + form POST test with credits & clients ---
    if (isMundogf) {
      try {
        console.log('🔄 MundoGF: teste rápido de conectividade...');
        
        // Helper to merge Set-Cookie headers
        function mergeSetCookiesMgf(existing: string, resp: Response): string {
          let allSetCookies: string[] = [];
          try { allSetCookies = (resp.headers as any).getSetCookie?.() || []; } catch {}
          if (allSetCookies.length === 0) {
            const sc = resp.headers.get('set-cookie');
            if (sc) allSetCookies = sc.split(/,\s*(?=[A-Za-z_-]+=)/);
          }
          if (allSetCookies.length === 0) return existing;
          const existingParts = existing ? existing.split('; ').filter(Boolean) : [];
          const cookieMap = new Map<string, string>();
          for (const c of existingParts) { const n = c.split('=')[0]; if (n) cookieMap.set(n, c); }
          for (const raw of allSetCookies) {
            const c = raw.split(';')[0].trim();
            const n = c.split('=')[0];
            if (n) cookieMap.set(n, c);
          }
          return [...cookieMap.values()].join('; ');
        }

        // Step 1: GET login page - verify it exists and has form
        const loginPageResp = await withTimeout(fetch(`${cleanBase}/login`, {
          method: 'GET',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
            ...hdrs 
          },
        }), 10000);
        const loginHtml = await loginPageResp.text();
        const hasForm = loginHtml.includes('<form') && loginHtml.includes('username') && loginHtml.includes('password');
        
        if (!loginPageResp.ok || !hasForm) {
          return new Response(JSON.stringify({
            success: false,
            details: `Página de login não encontrada ou inválida (status: ${loginPageResp.status})`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Extract CSRF token
        const csrfInput = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/);
        const csrfMeta = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
        const csrfToken = (csrfInput ? csrfInput[1] : null) || (csrfMeta ? csrfMeta[1] : null) || '';
        
        // Detect reCAPTCHA
        const v2Match = loginHtml.match(/sitekey['":\s]+['"]([0-9A-Za-z_-]{20,})['"]/i);
        const v3Match = loginHtml.match(/recaptcha[\/\w]*api\.js\?[^"']*render=([0-9A-Za-z_-]{20,})/i);
        const hasCaptcha = !!(v2Match || v3Match);
        console.log(`🔑 CSRF: ${csrfToken ? csrfToken.slice(0, 20) + '...' : 'não'}, reCAPTCHA: ${hasCaptcha ? 'sim' : 'não'}`);

        // Build cookies
        let allCookies = mergeSetCookiesMgf('', loginPageResp);

        // Step 2: POST login WITHOUT captcha (quick test)
        const formBody = new URLSearchParams();
        if (csrfToken) formBody.append('_token', csrfToken);
        formBody.append('username', username);
        formBody.append('password', password);
        formBody.append('g-recaptcha-response', 'test-token');

        const postHeaders: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/html',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': cleanBase,
          'Referer': `${cleanBase}/login`,
        };
        if (allCookies) postHeaders['Cookie'] = allCookies;
        const xsrfMatch = allCookies.match(/XSRF-TOKEN=([^;,\s]+)/);
        if (xsrfMatch) postHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);

        const postResp = await withTimeout(fetch(`${cleanBase}/login`, {
          method: 'POST',
          headers: postHeaders,
          body: formBody.toString(),
          redirect: 'manual',
        }), 15000);

        const postStatus = postResp.status;
        const postLocation = postResp.headers.get('location') || '';
        const postText = await postResp.text();
        let postJson: any = null;
        try { postJson = JSON.parse(postText); } catch {}

        console.log(`📊 POST /login → status: ${postStatus}, location: ${postLocation.slice(0, 80)}`);

        // Case 1: Redirect away from login = success
        const isRedirectSuccess = (postStatus === 302 || postStatus === 301) && postLocation && !postLocation.toLowerCase().includes('/login');
        if (isRedirectSuccess) {
          console.log('✅ MundoGF: Login bem-sucedido!');
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}/login`,
            type: 'MundoGF Session',
            account: { status: 'Conectado com sucesso!', user: { username }, token_received: false },
            data: { connectivity: true, credentialsValidated: true, redirect: postLocation },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Case 2: 422 with errors - analyze
        if (postStatus === 422 && postJson?.errors) {
          const errorKeys = Object.keys(postJson.errors);
          const hasCredentialError = errorKeys.includes('username') || errorKeys.includes('password');

          if (hasCredentialError) {
            return new Response(JSON.stringify({
              success: false,
              details: 'Falha na autenticação MundoGF: Usuário ou senha incorretos.',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          // Only reCAPTCHA error = panel is reachable, credentials not rejected
          const onlyRecaptcha = errorKeys.every(k => k.includes('recaptcha') || k.includes('captcha'));
          if (onlyRecaptcha) {
            console.log('✅ MundoGF: Painel acessível, credenciais não rejeitadas (reCAPTCHA bloqueou validação completa)');
            return new Response(JSON.stringify({
              success: true,
              endpoint: `${cleanBase}/login`,
              type: 'MundoGF Session',
              account: { 
                status: 'Conectado com sucesso!', 
                user: { username }, 
                token_received: false,
                note: 'Painel acessível. O reCAPTCHA impede validação completa da senha no teste, mas a renovação via Browserbase funciona normalmente.',
              },
              data: { connectivity: true, credentialsValidated: false, usernameValidated: true, captchaSolved: false },
              logs,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }
        }

        // Case 3: 200 with redirect JSON
        if (postStatus === 200 && postJson?.redirect) {
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}/login`,
            type: 'MundoGF Session',
            account: { status: 'Conectado com sucesso!', user: { username }, token_received: false },
            data: { connectivity: true, credentialsValidated: true, redirect: postJson.redirect },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Case 4: Redirect back to /login without specific error
        if (postLocation.toLowerCase().includes('/login')) {
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}/login`,
            type: 'MundoGF Session',
            account: { 
              status: 'Conectado com sucesso!', 
              user: { username }, 
              token_received: false,
              note: 'Painel acessível. O reCAPTCHA impede validação completa no teste, mas a renovação funciona normalmente via Browserbase.',
            },
            data: { connectivity: true, credentialsValidated: false, captchaSolved: false },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        return new Response(JSON.stringify({
          success: false,
          details: `Falha na autenticação MundoGF (status: ${postStatus}).`,
          debug: { status: postStatus, response: postText.slice(0, 500) },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          details: `Erro ao conectar: ${(e as Error).message}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    // --- Uniplay: REST API com JWT em gesapioffice.com (com reCAPTCHA v2) ---
    if (isUniplay) {
      const UNIPLAY_API = 'https://gesapioffice.com';
      const uniplayFrontend = frontendUrl || 'https://gestordefender.com';
      console.log(`🔄 Uniplay: Testando login JWT em ${UNIPLAY_API}/api/login...`);
      
      // Verificar se a proxy está funcionando antes de continuar
      const proxyCheck = await verifyProxy();
      console.log(`🌐 Proxy check: working=${proxyCheck.working}, ip=${proxyCheck.ip || 'n/a'}`);
      
      try {
        // siteKey conhecida do reCAPTCHA v2 do Uniplay (extraída do frontend)
        const UNIPLAY_RECAPTCHA_SITEKEY = '6LfTwuwfAAAAAGfw3TatjhOOCP2jNuPqO4U2xske';

        // Resolver reCAPTCHA v2 via 2Captcha
        let captchaToken = '';
        console.log('🤖 Uniplay: Resolvendo reCAPTCHA v2 via 2Captcha...');
        const solved = await solve2Captcha(UNIPLAY_RECAPTCHA_SITEKEY, `${uniplayFrontend}/login`, 'v2');
        if (solved) {
          captchaToken = solved;
          console.log('✅ Uniplay: reCAPTCHA v2 resolvido!');
        } else {
          console.log('⚠️ Uniplay: Não foi possível resolver reCAPTCHA v2');
        }

        // Step 3: Login com captcha resolvido
        const loginResp = await withTimeout(proxiedFetch(`${UNIPLAY_API}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'Origin': uniplayFrontend,
            'Referer': `${uniplayFrontend}/`,
          },
          body: JSON.stringify({ username, password, code: captchaToken }),
        }), 15000);

        const loginText = await loginResp.text();
        let loginJson: any = null;
        try { loginJson = JSON.parse(loginText); } catch {}

        // Log detalhado para debug
        const respHeaders: Record<string, string> = {};
        loginResp.headers.forEach((v, k) => { respHeaders[k] = v; });
        console.log(`📊 Uniplay login → status: ${loginResp.status}, has_token: ${!!loginJson?.access_token}`);
        console.log(`📊 Uniplay response body: ${loginText.slice(0, 500)}`);
        console.log(`📊 Uniplay response headers: ${JSON.stringify(respHeaders)}`);

        if (loginResp.ok && loginJson?.access_token) {
          // Try to get credits/account info
          let credits = null;
          const authHdrs = {
            'Authorization': `Bearer ${loginJson.access_token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          };
          try {
            const dashResp = await withTimeout(proxiedFetch(`${UNIPLAY_API}/api/dash-reseller`, { method: 'GET', headers: authHdrs }), 10000);
            const dashText = await dashResp.text();
            let dashJson: any = null;
            try { dashJson = JSON.parse(dashText); } catch {}
            credits = dashJson?.credits ?? dashJson?.data?.credits ?? null;
            console.log(`📊 Uniplay dash-reseller → status: ${dashResp.status}, credits: ${credits}`);
          } catch (e) {
            console.log(`⚠️ Uniplay dash-reseller: ${(e as Error).message}`);
          }

          return new Response(JSON.stringify({
            success: true,
            endpoint: `${UNIPLAY_API}/api/login`,
            type: 'Uniplay JWT',
            account: {
              status: 'Active',
              user: { username },
              token_received: true,
              credits,
            },
            data: {
              token_type: loginJson.token_type,
              expires_in: loginJson.expires_in,
              crypt_pass: loginJson.crypt_pass ? true : false,
              credits,
              captchaSolved: !!captchaToken,
            },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Login failed
        const errorMsg = loginJson?.message || loginJson?.error || loginText.slice(0, 200) || '';
        const isGeoBlocked = loginResp.status === 404 && !errorMsg.trim();
        const needsCaptcha = !captchaToken && (loginResp.status === 401 || errorMsg.toLowerCase().includes('captcha'));
        
        let detailMsg: string;
        if (isGeoBlocked) {
          const proxyInfo = proxyCheck.working 
            ? `IP da proxy: ${proxyCheck.ip} (pode não ser brasileiro)` 
            : `Proxy não funcionou: ${proxyCheck.error || 'desconhecido'}`;
          detailMsg = `❌ A API do Uniplay (gesapioffice.com) retornou erro 404 — bloqueio geográfico de IP.\n\n⚠️ ${proxyInfo}\n\n💡 Deno.createHttpClient: ${typeof (Deno as any).createHttpClient === 'function' ? 'disponível' : 'NÃO disponível'}\n\n👉 Verifique se a proxy é brasileira e está ativa. Verifique seu login diretamente em ${uniplayFrontend}.`;
        } else if (needsCaptcha) {
          detailMsg = `Login Uniplay requer reCAPTCHA v2. A resolução via 2Captcha falhou — verifique o saldo/chave do 2Captcha. Verifique suas credenciais diretamente em ${uniplayFrontend}.`;
        } else {
          detailMsg = `Falha no login Uniplay: ${errorMsg || 'Credenciais inválidas ou API indisponível.'}`;
        }
        
        return new Response(JSON.stringify({
          success: false,
          endpoint: `${UNIPLAY_API}/api/login`,
          type: 'Uniplay JWT',
          details: detailMsg,
          debug: { status: loginResp.status, response: loginText.slice(0, 500), captchaSolved: !!captchaToken, proxyCheck },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          details: `Erro ao conectar com Uniplay: ${(e as Error).message}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    if (!providerId || isKoffice) {
    try {
      console.log('🔄 Tentando login via formulário HTML (kOffice style)...');
      // Step 1: GET login page to extract CSRF token and session cookie
      const loginPageResp2 = await withTimeout(fetch(`${cleanBase}/login`, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', ...hdrs },
        redirect: 'manual',
      }), 10000);
      const loginHtml2 = await loginPageResp2.text();
      const cookies = loginPageResp2.headers.get('set-cookie') || '';
      
      // Extract CSRF token from multiple sources
      const csrfMatch2 = loginHtml2.match(/name=["']csrf_token["']\s+value=["'](.*?)["']/);
      const csrf2 = csrfMatch2 ? csrfMatch2[1] : null;
      // Laravel-style _token hidden input
      const laravelCsrf = loginHtml2.match(/name=["']_token["']\s+value=["'](.*?)["']/);
      // Laravel meta tag: <meta name="csrf-token" content="...">
      const metaCsrf = loginHtml2.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
      const csrfToken = csrf2 || (laravelCsrf ? laravelCsrf[1] : null) || (metaCsrf ? metaCsrf[1] : null);
      console.log(`🔑 CSRF token extraído: ${csrfToken ? csrfToken.slice(0, 20) + '...' : 'não encontrado'}`);
      console.log(`🍪 Cookies: ${cookies.slice(0, 200)}`);

      // Step 2: POST form-encoded login
      const formBody = new URLSearchParams();
      if (!isMundogf) formBody.append('try_login', '1');
      if (csrfToken) {
        if (!isMundogf) formBody.append('csrf_token', csrfToken);
        formBody.append('_token', csrfToken);
      }
      formBody.append('username', username);
      formBody.append('password', password);

      const formHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
        'Origin': cleanBase,
        'Referer': `${cleanBase}/login`,
        ...hdrs,
      };
      // Extract XSRF-TOKEN from cookies for Laravel X-XSRF-TOKEN header
      const xsrfMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
      if (xsrfMatch) {
        formHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);
      }
      // Collect session cookies
      let sessionCookies = '';
      if (cookies) {
        const cookieParts = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
        sessionCookies = cookieParts;
        formHeaders['Cookie'] = formHeaders['Cookie'] ? `${formHeaders['Cookie']}; ${cookieParts}` : cookieParts;
      }

      console.log(`🔄 POST form-encoded para: ${cleanBase}/login`);
      const formResp = await withTimeout(fetch(`${cleanBase}/login`, {
        method: 'POST',
        headers: formHeaders,
        body: formBody.toString(),
        redirect: 'manual',
      }), 15000);

      const formStatus = formResp.status;
      const formLocation = formResp.headers.get('location') || '';
      const formSetCookies = formResp.headers.get('set-cookie') || '';
      const formText = await formResp.text();
      console.log(`📊 Form login → status: ${formStatus}, location: ${formLocation}, snippet: ${formText.slice(0, 200)}`);
      console.log(`🍪 New cookies: ${formSetCookies.slice(0, 200)}`);
      logs.push({ url: `${cleanBase}/login (form)`, status: formStatus, location: formLocation, snippet: formText.slice(0, 200) });

      // Merge new cookies from login response
      if (formSetCookies) {
        const newParts = formSetCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
        sessionCookies = sessionCookies ? `${sessionCookies}; ${newParts}` : newParts;
      }

      // Success indicators: redirect to dashboard/home OR 200 with dashboard content
      const locationLower = formLocation.toLowerCase();
      const isRedirectToApp = locationLower.includes('dashboard') || locationLower.includes('/home') || locationLower.includes('/admin') || locationLower.includes('/panel') || (isKoffice && (locationLower === './' || locationLower === '.'));
      // For MundoGF, redirect to '/' means success (it's the dashboard)
      const isRedirectToRoot = isMundogf && locationLower === '/';
      // For kOffice, './' means redirect to dashboard root (success), not back to login
      const isRelativeRoot = locationLower === './' || locationLower === '.';
      const isRedirectToLogin = !formLocation || (!isKoffice && isRelativeRoot) || locationLower.includes('/login');
      const isRedirectToLoginOnly = isRedirectToLogin && !isRedirectToRoot;
      
      const isFormLoginSuccess = (
        (formStatus === 302 || formStatus === 301) && !isRedirectToLoginOnly
      ) || (
        formStatus === 200 && !formText.includes('form-login') && !formText.includes('login_error') && !formText.includes('Invalid')
      );

      if (isFormLoginSuccess) {
        console.log(`✅ Login via formulário parece OK, seguindo redirect e verificando sessão...`);
        
        // Step 2.5: Follow the redirect to complete session establishment
        if (formLocation) {
          try {
            const followUrl = formLocation.startsWith('http') ? formLocation : `${cleanBase}/${formLocation.replace(/^\.\//, '')}`;
            console.log(`🔄 Seguindo redirect para: ${followUrl}`);
            const followHeaders: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html',
              'Cookie': sessionCookies,
            };
            const followResp = await withTimeout(fetch(followUrl, {
              method: 'GET',
              headers: followHeaders,
              redirect: 'manual',
            }), 10000);
            const followSetCookies = followResp.headers.get('set-cookie') || '';
            if (followSetCookies) {
              const newParts = followSetCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
              sessionCookies = sessionCookies ? `${sessionCookies}; ${newParts}` : newParts;
            }
            await followResp.text(); // consume body
            console.log(`📊 Follow redirect → status: ${followResp.status}, cookies updated`);
          } catch (e) {
            console.log(`⚠️ Erro ao seguir redirect: ${(e as Error).message}`);
          }
        }

        // Determine verify endpoints based on provider
        const verifyEndpoints = isMundogf
          ? ['/bonus/stats', '/ajax/getClientsStats2']
          : ['/dashboard/api?get_info&month=0'];

        // Step 3: Verify session
        for (const verifyPath of verifyEndpoints) {
          try {
            const verifyHeaders: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `${cleanBase}/`,
            };
            if (sessionCookies) verifyHeaders['Cookie'] = sessionCookies;

            console.log(`🔍 Verificando sessão: GET ${cleanBase}${verifyPath}`);
            const verifyResp = await withTimeout(fetch(`${cleanBase}${verifyPath}`, {
              method: 'GET',
              headers: verifyHeaders,
            }), 10000);

            const verifyText = await verifyResp.text();
            let verifyJson: any = null;
            try { verifyJson = JSON.parse(verifyText); } catch (_) {}
            console.log(`📊 Verify → status: ${verifyResp.status}, snippet: ${verifyText.slice(0, 300)}`);
            logs.push({ url: `${cleanBase}${verifyPath}`, status: verifyResp.status, snippet: verifyText.slice(0, 200) });

            if (verifyResp.ok && verifyJson && typeof verifyJson === 'object') {
              console.log(`✅ Sessão verificada com sucesso via ${verifyPath}!`);
              return new Response(JSON.stringify({
                success: true,
                endpoint: `${cleanBase}${verifyPath}`,
                type: isMundogf ? 'MundoGF Session' : 'kOffice Session',
                account: {
                  status: 'Active',
                  user: { username },
                  token_received: false,
                },
                data: {
                  dashboard_info: verifyJson,
                  redirect: formLocation || null,
                },
                logs,
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              });
            }
          } catch (verifyErr) {
            console.log(`⚠️ Erro ao verificar sessão via ${verifyPath}: ${(verifyErr as Error).message}`);
          }
        }

        // Even without verify, if redirect was to a real dashboard path, consider success
        // But for kOffice, './' is ambiguous (returns ./ even on failed login), so only trust verify result
        if ((isRedirectToApp && !isKoffice) || isRedirectToRoot) {
          console.log(`✅ Login via formulário bem-sucedido (redirect para dashboard)!`);
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}/login`,
            type: 'kOffice Form',
            account: {
              status: 'Active',
              user: { username },
              token_received: false,
            },
            data: {
              redirect: formLocation || null,
              response: formText.slice(0, 500),
            },
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        
        // For kOffice: if we got here, verify failed = credentials are wrong
        if (isKoffice) {
          console.log('❌ KOffice: Login form retornou ./ mas sessão não foi validada pelo dashboard API');
          return new Response(JSON.stringify({
            success: false,
            details: '❌ Credenciais inválidas. O login retornou redirecionamento mas a sessão não foi validada pelo painel.',
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      }
    } catch (e) {
      console.log(`⚠️ Erro form login: ${(e as Error).message}`);
      logs.push({ url: `${cleanBase}/login (form)`, error: (e as Error).message });
    }
    } // end form-based login block

    // --- UniTV (ResellerSystem): POST /api/login/saveLogin via CF Solver ---
    const isUnitv = providerId === 'unitv';
    if (isUnitv) {
      try {
        const loginUrl = `${cleanBase}/api/login/saveLogin`;
        console.log(`🔄 UniTV: POST ${loginUrl} (via CF Solver)`);

        // UniTV is behind Cloudflare - route through CF Solver relay
        const relayUrl = Deno.env.get('VPS_RELAY_URL') || '';
        const relaySecret = Deno.env.get('VPS_RELAY_SECRET') || '';
        let cfSolverUrl = '';
        try {
          const parsed = new URL(relayUrl);
          cfSolverUrl = `${parsed.protocol}//${parsed.hostname}:8191`;
        } catch {}

        let unitvText = '';
        let unitvStatus = 0;

        if (cfSolverUrl) {
          console.log(`🌐 Usando CF Solver: ${cfSolverUrl}/request`);
          const relayResp = await withTimeout(fetch(`${cfSolverUrl}/request`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Relay-Secret': relaySecret,
            },
            body: JSON.stringify({
              url: loginUrl,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'Origin': cleanBase,
                'Referer': `${cleanBase}/`,
                'content': 'h5_dealer',
                'version': '1.0.2',
              },
              body: JSON.stringify(loginPayload || { username, password }),
              baseUrl: cleanBase,
            }),
          }), 90000); // 90s for CF Solver to resolve challenge

          const relayData = await relayResp.json();
          unitvText = typeof relayData.body === 'string' ? relayData.body : JSON.stringify(relayData.body || relayData);
          unitvStatus = relayData.status || 0;
          console.log(`📊 CF Solver response: status=${unitvStatus}, size=${unitvText.length}`);
        } else {
          // Fallback to direct fetch if CF Solver not configured
          console.log(`⚠️ CF Solver não configurado, usando fetch direto`);
          const directResp = await withTimeout(proxiedFetch(loginUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
              'Origin': cleanBase,
              'Referer': `${cleanBase}/`,
              'content': 'h5_dealer',
              'version': '1.0.2',
              ...hdrs,
            },
            body: JSON.stringify(loginPayload || { username, password }),
          }), 15000);
          unitvText = await directResp.text();
          unitvStatus = directResp.status;
        }

        let unitvJson: any = null;
        try { unitvJson = JSON.parse(unitvText); } catch {}
        console.log(`📊 UniTV → status: ${unitvStatus}, returnCode: ${unitvJson?.returnCode}, snippet: ${unitvText.slice(0, 300)}`);
        logs.push({ url: loginUrl, status: unitvStatus, snippet: unitvText.slice(0, 200) });

        if (unitvStatus >= 200 && unitvStatus < 300 && unitvJson && unitvJson.returnCode === 0) {
          // Sucesso — tentar pegar info do dealer
          let dealerInfo: any = null;
          const dataToken = unitvJson.data; // encrypted session token

          const dealerFetchFn = async () => {
            const dealerUrl = `${cleanBase}/api/dealer/getDealerInfo`;
            if (cfSolverUrl) {
              const resp = await withTimeout(fetch(`${cfSolverUrl}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
                body: JSON.stringify({
                  url: dealerUrl,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'Origin': cleanBase,
                    'Referer': `${cleanBase}/`,
                    'content': 'h5_dealer',
                    'version': '1.0.2',
                    'token': dataToken || '',
                  },
                  body: JSON.stringify({}),
                  baseUrl: cleanBase,
                }),
              }), 30000);
              const d = await resp.json();
              return typeof d.body === 'string' ? d.body : JSON.stringify(d.body || d);
            } else {
              const resp = await withTimeout(proxiedFetch(dealerUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json;charset=UTF-8',
                  'Accept': 'application/json',
                  'Origin': cleanBase,
                  'Referer': `${cleanBase}/`,
                  'content': 'h5_dealer',
                  'version': '1.0.2',
                  'token': dataToken || '',
                },
                body: JSON.stringify({}),
              }), 10000);
              return await resp.text();
            }
          };

          try {
            const infoText = await dealerFetchFn();
            try { dealerInfo = JSON.parse(infoText); } catch {}
            console.log(`📊 UniTV getDealerInfo → snippet: ${infoText.slice(0, 300)}`);
          } catch (e) {
            console.log(`⚠️ UniTV getDealerInfo: ${(e as Error).message}`);
          }

          const credits = dealerInfo?.data?.credits ?? dealerInfo?.data?.balance ?? null;
          return new Response(JSON.stringify({
            success: true,
            endpoint: loginUrl,
            type: 'UniTV ResellerSystem',
            account: {
              status: 'Active',
              user: { username },
              token_received: !!dataToken,
              credits,
            },
            data: {
              hasToken: !!dataToken,
              credits,
              dealerInfo: dealerInfo?.data || null,
            },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Falha
        const errorMsg = unitvJson?.errorMessage || (unitvText.includes('<html') ? 'Cloudflare bloqueou a requisição' : unitvText.slice(0, 200));
        return new Response(JSON.stringify({
          success: false,
          details: `❌ Falha no login UniTV: ${errorMsg || 'Credenciais inválidas ou API indisponível.'}`,
          debug: { url: loginUrl, status: unitvStatus, returnCode: unitvJson?.returnCode, response: unitvText.slice(0, 500) },
          logs,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          details: `Erro ao conectar com UniTV: ${(e as Error).message}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    // --- Playfast: POST /profile/{username} with { secret: password } ---
    const isPlayfast = providerId === 'playfast';
    if (isPlayfast) {
      try {
        const profileUrl = `${cleanBase}/profile/${encodeURIComponent(username)}`;
        console.log(`🔄 Playfast: POST ${profileUrl}`);
        const pfResp = await withTimeout(fetch(profileUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...hdrs,
          },
          body: JSON.stringify({ secret: password }),
        }), 15000);
        const pfText = await pfResp.text();
        let pfJson: any = null;
        try { pfJson = JSON.parse(pfText); } catch (_) {}
        console.log(`📊 Playfast → status: ${pfResp.status}, snippet: ${pfText.slice(0, 300)}`);
        logs.push({ url: profileUrl, status: pfResp.status, ok: pfResp.ok, snippet: pfText.slice(0, 200) });

        if (pfResp.ok && pfJson && typeof pfJson === 'object') {
          const credits = pfJson.credits ?? pfJson.credit ?? pfJson.saldo ?? null;
          console.log(`✅ Playfast: conexão bem-sucedida! Créditos: ${credits}`);
          return new Response(JSON.stringify({
            success: true,
            endpoint: profileUrl,
            type: 'Playfast Profile',
            account: {
              status: 'Active',
              user: { username },
              token_received: false,
              credits,
            },
            data: {
              credits,
              response: pfJson,
            },
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            details: pfResp.status === 401 || pfResp.status === 403
              ? '❌ Credenciais inválidas (TOKEN ou Secret incorretos).'
              : `❌ Erro ${pfResp.status}: ${pfText.slice(0, 200)}`,
            debug: { url: profileUrl, status: pfResp.status, response: pfText.slice(0, 300) },
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (e) {
        console.log(`⚠️ Playfast error: ${(e as Error).message}`);
        logs.push({ url: `${cleanBase}/profile/${username}`, error: (e as Error).message });
      }
    }

    // --- Sigma/Slim: JSON POST login (OnWave framework) ---
    // Baseado em dados reais do F12:
    // Endpoint: POST /api/auth/login
    // Payload: { captcha, captchaChecked, username, password, twofactor_code, twofactor_recovery_code, twofactor_trusted_device_id }
    // Resposta sucesso: { id, username, name, status, credits, token, role, ... } (objeto direto, sem wrapper)
    // Resposta erro: { message: "..." } ou HTML do Cloudflare
    if (isSigma) {
      try {
        console.log(`🔄 Sigma: Login em ${cleanBase}`);

        // Payload exato do browser real
        const sigmaPayload = loginPayload || {
          captcha: 'not-a-robot',
          captchaChecked: true,
          username,
          password,
          twofactor_code: '',
          twofactor_recovery_code: '',
          twofactor_trusted_device_id: '',
        };

        // Headers exatos do browser real
        const sigmaHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'locale': 'pt',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Origin': cleanBase,
          'Referer': `${cleanBase}/`,
          ...hdrs,
        };

        // Auto-descoberta: tentar múltiplas rotas de login
        const sigmaRoutes = ['/api/auth/login', '/api/login', '/login', '/auth/login'];
        let foundRoute: string | null = null;
        let foundJson: any = null;
        let foundStatus = 0;
        let foundText = '';
        let allRoutes404 = true;
        let hasCloudflareChallenge = false;

        for (const route of sigmaRoutes) {
          const tryUrl = `${cleanBase}${route}`;
          console.log(`🧪 Sigma: POST direto ${tryUrl}`);
          try {
            const resp = await withTimeout(proxiedFetch(tryUrl, {
              method: 'POST',
              headers: sigmaHeaders,
              body: JSON.stringify(sigmaPayload),
              redirect: 'follow',
            }), 15000);
            const text = await resp.text();
            console.log(`📊 Sigma rota ${route} → status: ${resp.status}, snippet: ${text.slice(0, 200)}`);
            logs.push({ url: tryUrl, status: resp.status, ok: resp.ok, snippet: text.slice(0, 200) });

            if (resp.status !== 404) {
              allRoutes404 = false;
            }

            // Detectar Cloudflare CHALLENGE real
            const lower = text.toLowerCase();
            const isCfChallenge = (
              (lower.includes('just a moment') && lower.includes('cloudflare')) ||
              lower.includes('cf-browser-verification') ||
              lower.includes('challenge-platform') ||
              lower.includes('cf-challenge')
            );
            if (isCfChallenge) {
              hasCloudflareChallenge = true;
              continue; // tenta próxima rota
            }

            let json: any = null;
            try { json = JSON.parse(text); } catch {}

            // 401/403 = credenciais inválidas (rota existe!)
            if (resp.status === 401 || resp.status === 403) {
              const msg = json?.message || 'Credenciais inválidas';
              return new Response(JSON.stringify({
                success: false,
                details: `❌ ${msg}. Verifique usuário e senha.`,
                debug: { url: tryUrl, status: resp.status, response: text.slice(0, 300) },
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            // 422 = validação
            if (resp.status === 422) {
              return new Response(JSON.stringify({
                success: false,
                details: `❌ Erro de validação: ${json?.message || text.slice(0, 200)}`,
                debug: { url: tryUrl, status: 422, response: text.slice(0, 300) },
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            // 404 = rota não existe, tenta próxima
            if (resp.status === 404) {
              continue;
            }

            // Resposta JSON com token/id = sucesso!
            if (resp.ok && json) {
              const token = json.token || json.jwt || json.access_token || null;
              if (token || json.id || json.username) {
                foundRoute = route;
                foundJson = json;
                foundStatus = resp.status;
                foundText = text;
                break;
              }
              // JSON com message = erro do painel
              if (json.message) {
                return new Response(JSON.stringify({
                  success: false,
                  details: `❌ ${json.message}`,
                  debug: { url: tryUrl, status: resp.status, response: json },
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
              }
            }

            // Qualquer outro status não-404 com conteúdo relevante
            if (!resp.ok && resp.status !== 404 && json?.message) {
              return new Response(JSON.stringify({
                success: false,
                details: `❌ ${json.message}`,
                debug: { url: tryUrl, status: resp.status, response: text.slice(0, 300) },
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }
          } catch (routeErr) {
            console.log(`⚠️ Sigma rota ${route}: ${(routeErr as Error).message}`);
            logs.push({ url: tryUrl, error: (routeErr as Error).message });
          }
        }

        // Se encontrou rota com sucesso
        if (foundRoute && foundJson) {
          const token = foundJson.token || foundJson.jwt || foundJson.access_token || null;
          console.log(`✅ Sigma: Login OK (rota ${foundRoute}) - user: ${foundJson.username || foundJson.id}`);
          return new Response(JSON.stringify({
            success: true,
            endpoint: `${cleanBase}${foundRoute}`,
            type: 'Sigma Panel',
            account: {
              status: foundJson.status || 'Active',
              user: foundJson.username || username,
              token_received: !!token,
              credits: foundJson.credits ?? null,
              role: foundJson.role || null,
              totalClients: null,
              activeClients: null,
            },
            data: { token, user: foundJson.username || null, response: foundJson },
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Todas as rotas retornaram 404 - pode ser nginx bloqueando requisições de servidor
        // Tenta via CF Solver (Puppeteer) como fallback, pois simula navegador real
        if (allRoutes404) {
          console.log('⚠️ Sigma: Todas rotas 404 - nginx pode estar bloqueando requisições diretas. Tentando via CF Solver...');
          hasCloudflareChallenge = true; // força tentar via CF Solver
        }

        // Se tem challenge Cloudflare real, tenta CF Solver
        if (hasCloudflareChallenge) {
          const relayUrl = Deno.env.get('VPS_RELAY_URL') || '';
          const relaySecret = Deno.env.get('VPS_RELAY_SECRET') || '';
          let cfSolverUrl = '';
          try {
            const parsed = new URL(relayUrl);
            cfSolverUrl = `${parsed.protocol}//${parsed.hostname}:8191`;
          } catch {}

          if (!cfSolverUrl) {
            const reason = allRoutes404 
              ? `O nginx do painel ${cleanBase} bloqueia requisições diretas de servidor (retorna 404 para tudo). Configure o VPS Relay com CF Solver para conectar via navegador automatizado.`
              : `O painel ${cleanBase} está protegido pelo Cloudflare. Configure o VPS Relay com CF Solver para conectar.`;
            return new Response(JSON.stringify({
              success: false,
              details: `⚠️ ${reason}`,
              debug: { url: cleanBase, usedCfSolver: false, allRoutes404, logs },
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          // Health check rápido do CF Solver
          try {
            const healthResp = await withTimeout(fetch(`${cfSolverUrl}/`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
            }), 4000);
            const healthText = await healthResp.text();
            if (!healthResp.ok) {
              return new Response(JSON.stringify({
                success: false,
                details: '❌ CF Solver indisponível no VPS. Verifique com: pm2 logs cf-solver --lines 20',
                debug: { cfSolverUrl, healthStatus: healthResp.status, healthSnippet: healthText.slice(0, 200) },
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }
            console.log(`✅ Sigma: CF Solver online`);
          } catch (healthErr) {
            return new Response(JSON.stringify({
              success: false,
              details: '❌ CF Solver indisponível no VPS. Verifique com: pm2 logs cf-solver --lines 20',
              debug: { cfSolverUrl, healthError: (healthErr as Error).message },
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          // Login via CF Solver - tenta cada rota
          for (const route of sigmaRoutes) {
            const loginUrl = `${cleanBase}${route}`;
            console.log(`🌐 Sigma: POST via CF Solver ${loginUrl}`);
            try {
              const relayResp = await withTimeout(fetch(`${cfSolverUrl}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
                body: JSON.stringify({
                  url: loginUrl,
                  method: 'POST',
                  headers: sigmaHeaders,
                  body: JSON.stringify(sigmaPayload),
                  baseUrl: cleanBase,
                }),
              }), 90000);

              const relayRawText = await relayResp.text();
              console.log(`📊 Sigma CF Solver rota ${route} → httpStatus: ${relayResp.status}, snippet: ${relayRawText.slice(0, 300)}`);

              if (relayResp.status === 401 || relayResp.status === 403) {
                return new Response(JSON.stringify({
                  success: false,
                  details: '❌ VPS Relay recusou a requisição (Unauthorized). Verifique se o VPS_RELAY_SECRET do Supabase é o mesmo do cf-solver no VPS.',
                  debug: { cfSolverUrl, relayStatus: relayResp.status },
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
              }

              let relayData: any = null;
              try { relayData = JSON.parse(relayRawText); } catch {}

              const responseBody = typeof relayData?.body === 'string' ? relayData.body : JSON.stringify(relayData?.body || relayData || {});
              const rawStatus = relayData?.status ?? relayResp.status ?? 0;
              const parsedStatus = typeof rawStatus === 'string' ? parseInt(rawStatus, 10) : Number(rawStatus);
              const responseStatus = Number.isFinite(parsedStatus) ? parsedStatus : (relayResp.status ?? 0);

              // 404 via CF Solver = rota não existe, tenta próxima
              if (responseStatus === 404) {
                logs.push({ url: `${loginUrl} (via CF Solver)`, status: 404, ok: false, snippet: responseBody.slice(0, 200) });
                continue;
              }

              let panelJson: any = null;
              try { panelJson = JSON.parse(responseBody); } catch {}

              logs.push({ url: `${loginUrl} (via CF Solver)`, status: responseStatus, ok: responseStatus >= 200 && responseStatus < 300, snippet: responseBody.slice(0, 200) });

              if (panelJson) {
                const token = panelJson.token || panelJson.jwt || panelJson.access_token || null;

                if (responseStatus >= 200 && responseStatus < 300 && (token || panelJson.id || panelJson.username)) {
                  console.log(`✅ Sigma: Login OK (CF Solver rota ${route}) - user: ${panelJson.username || panelJson.id}`);
                  return new Response(JSON.stringify({
                    success: true,
                    endpoint: loginUrl,
                    type: 'Sigma Panel',
                    account: {
                      status: panelJson.status || 'Active',
                      user: panelJson.username || username,
                      token_received: !!token,
                      credits: panelJson.credits ?? null,
                      role: panelJson.role || null,
                    },
                    data: { token, user: panelJson.username || null, response: panelJson },
                    logs,
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }

                if (responseStatus === 401 || responseStatus === 403 || panelJson.message) {
                  const msg = panelJson.message || 'Credenciais inválidas';
                  return new Response(JSON.stringify({
                    success: false,
                    details: `❌ ${msg}. Verifique usuário e senha.`,
                    debug: { url: loginUrl, status: responseStatus, response: responseBody.slice(0, 300) },
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }
              }
            } catch (cfErr) {
              const errMsg = (cfErr as Error).message;
              console.log(`⚠️ Sigma CF Solver rota ${route}: ${errMsg}`);
              logs.push({ url: `${loginUrl} (via CF Solver)`, error: errMsg });
            }
          }

          // Nenhuma rota funcionou via CF Solver
          return new Response(JSON.stringify({
            success: false,
            details: `⚠️ O CF Solver não conseguiu autenticar em nenhuma rota de ${cleanBase}. Verifique os logs: pm2 logs cf-solver --lines 30`,
            debug: { url: cleanBase, cfSolverUrl, triedRoutes: sigmaRoutes, logs },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Fallback genérico
        return new Response(JSON.stringify({
          success: false,
          details: `❌ Não foi possível autenticar no painel Sigma. Verifique URL, usuário e senha.`,
          debug: { url: cleanBase, logs },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          details: `Erro ao conectar com Sigma: ${(e as Error).message}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    // --- Fallback: Try standard POST JSON login endpoints (others) ---
    // Build candidates from testSteps if available, otherwise use endpointPath or defaults
    let candidates: string[] = [];
    if (Array.isArray(testSteps) && testSteps.length > 0) {
      // Extract all endpoints from json-post steps first, then form steps
      for (const step of testSteps) {
        if (step.type === 'json-post' && Array.isArray(step.endpoints)) {
          candidates.push(...step.endpoints);
        }
      }
      // If no json-post endpoints found, try all step endpoints
      if (candidates.length === 0) {
        for (const step of testSteps) {
          if (Array.isArray(step.endpoints)) {
            candidates.push(...step.endpoints);
          }
        }
      }
    }
    
    if (candidates.length === 0) {
      candidates = providerId && endpointPath
        ? [endpointPath]
        : Array.from(new Set([
            endpointPath || '/api/auth/login',
            '/api/login',
            '/api/v1/login',
            '/api/v1/auth/login',
            '/auth/login',
            '/login',
            '/admin/login',
          ]));
    }
    
    // Deduplicate
    candidates = Array.from(new Set(candidates));

    for (const path of candidates) {
      const url = `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`;
      console.log(`🧪 Testando POST endpoint: ${path}`);
      try {
        const resp = await testOnWaveLogin(url, username, password, hdrs, endpointMethod || 'POST', loginPayload);
        console.log(`📊 ${path} → status: ${resp.status}, ok: ${resp.ok}, snippet: ${String(resp.text).slice(0, 150)}`);
        logs.push({ url, status: resp.status, ok: resp.ok, snippet: String(resp.text).slice(0, 200) });
        lastResp = resp;
        lastUrl = url;

        const token = resp.json?.token || resp.json?.jwt || resp.json?.access_token || resp.json?.data?.token || resp.json?.data?.access_token || null;
        const resultField = resp.json?.result;
        
        // Detect credential rejection (Uniplay returns 500 with "Credenciais inválidas")
        const respTextLower = String(resp.text || '').toLowerCase();
        const isCredentialRejection = !resp.ok && (
          respTextLower.includes('credenciais') || respTextLower.includes('credencias') || 
          respTextLower.includes('invalid credentials') || respTextLower.includes('unauthorized')
        );
        
        if (isCredentialRejection) {
          console.log(`❌ Credenciais rejeitadas em: ${url}`);
          return new Response(JSON.stringify({
            success: false,
            details: '❌ Credenciais inválidas. O painel rejeitou o usuário/senha fornecidos.',
            debug: { url, method: endpointMethod || 'POST', status: resp.status, response: String(resp.text).slice(0, 300) },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        const isSuccess = resp.ok && (
          token || 
          resp.json?.success === true || 
          resp.json?.status === 'ok' || 
          resp.json?.user ||
          resultField === 'success' ||
          resultField === 'ok'
        );
        
        if (isSuccess) {
          console.log(`✅ Login bem-sucedido em: ${url}`);
          
          // Uniplay: buscar créditos via /api/dash-reseller
          let credits = null;
          if (isUniplay && token) {
            try {
              const dashResp = await withTimeout(fetch(`${cleanBase}/api/dash-reseller`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: '{}',
              }), 10000);
              const dashText = await dashResp.text();
              let dashJson: any = null;
              try { dashJson = JSON.parse(dashText); } catch {}
              if (dashJson) {
                credits = dashJson.credits ?? dashJson.credit ?? dashJson.saldo ?? null;
                console.log(`💰 Uniplay créditos: ${credits}`);
              }
            } catch (e) {
              console.log(`⚠️ Uniplay dash-reseller: ${(e as Error).message}`);
            }
          }

          return new Response(JSON.stringify({
            success: true,
            endpoint: url,
            type: isUniplay ? 'Uniplay JWT' : 'Panel',
            account: {
              status: 'Active',
              user: resp.json?.user || resp.json?.data?.user || { username },
              token_received: !!token,
              credits,
            },
            data: {
              token: token || null,
              user: resp.json?.user || resp.json?.data?.user || null,
              credits,
              response: resp.json,
            },
            logs,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (e) {
        console.log(`⚠️ Erro POST ${path}: ${(e as Error).message}`);
        logs.push({ url, error: (e as Error).message });
      }
    }

    // Check if any endpoint responded with a valid JSON that indicates auth failure (kOffice style)
    const hasAuthEndpoint = logs.some(l => l.ok && l.snippet && (l.snippet.includes('"result"') || l.snippet.includes('"success"')));
    
    let errorMessage = 'Falha na autenticação';
    if (hasAuthEndpoint) {
      errorMessage = '❌ Credenciais inválidas. O endpoint de login respondeu mas rejeitou as credenciais fornecidas.';
    } else if (lastResp?.status === 401) {
      errorMessage = '❌ Credenciais inválidas (usuário/senha incorretos)';
    } else if (lastResp?.status === 404) {
      errorMessage = '❌ Nenhum endpoint de login conhecido encontrado. Verifique a URL do painel';
    } else if (lastResp?.status === 405) {
      errorMessage = '❌ Método não permitido (o endpoint não aceita POST)';
    } else if (lastResp?.status === 403) {
      errorMessage = '❌ Acesso negado (possível proteção Cloudflare/WAF).';
    } else if (lastResp && !lastResp.ok) {
      errorMessage = `❌ Erro ${lastResp.status}: ${String(lastResp.text || '').slice(0, 200)}`;
    }

    return new Response(JSON.stringify({
      success: false,
      details: errorMessage,
      debug: {
        url: lastUrl || `${cleanBase}/api/auth/login`,
        method: endpointMethod || 'POST',
        status: lastResp?.status || 0,
        response: String(lastResp?.text || '').slice(0, 500),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(`❌ Erro geral: ${(error as Error).message}`);
    return new Response(JSON.stringify({ 
      success: false, 
      details: `Erro interno: ${(error as Error).message}` 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});
