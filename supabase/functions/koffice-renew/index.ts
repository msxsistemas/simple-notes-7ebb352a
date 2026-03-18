import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

async function resolveVaultCreds(supabase: SupabaseClient, panel: any, userToken?: string) {
  let u = panel.usuario, s = panel.senha;
  if (u === 'vault' || s === 'vault') {
    let vaultClient = supabase;
    let rpcName = 'admin_get_gateway_secret';
    if (userToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      vaultClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
      });
      rpcName = 'get_gateway_secret';
    }
    const [uR, sR] = await Promise.all([
      vaultClient.rpc(rpcName, { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `usuario_${panel.id}` }),
      vaultClient.rpc(rpcName, { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `senha_${panel.id}` }),
    ]);
    if (uR.data) u = uR.data;
    if (sR.data) s = sR.data;
  }
  return { usuario: u, senha: s };
}

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

function getJwtRole(token?: string): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role || null;
  } catch {
    return null;
  }
}

function mergeSetCookies(existing: string, setCookieHeader: string | null): string {
  if (!setCookieHeader) return existing;
  const parts = setCookieHeader.split(/,\s*(?=[A-Za-z_-]+=)/).map(c => c.split(';')[0].trim());
  const existingParts = existing ? existing.split('; ').filter(Boolean) : [];
  const cookieMap = new Map<string, string>();
  for (const c of existingParts) { const n = c.split('=')[0]; if (n) cookieMap.set(n, c); }
  for (const c of parts) { const n = c.split('=')[0]; if (n) cookieMap.set(n, c); }
  return [...cookieMap.values()].join('; ');
}

function extractInputValue(html: string, inputName: string): string {
  const tags = html.match(/<input\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1] !== inputName) continue;
    const valueMatch = tag.match(/\bvalue=["']([^"']*)["']/i);
    if (valueMatch) return valueMatch[1];
  }
  return '';
}

// ==================== VPS Relay via CF-Solver (Puppeteer) ====================
// Routes all panel HTTP requests through CF-Solver on port 8191 to bypass Cloudflare
function createPanelFetch(): typeof fetch {
  const relayUrlRaw = (Deno.env.get('VPS_RELAY_URL') || Deno.env.get('URL_DE_RELAY_VPS') || '').replace(/\/$/, '');
  const relaySecret = Deno.env.get('VPS_RELAY_SECRET') || '';

  if (!relayUrlRaw || !relaySecret) {
    console.log('🌐 VPS Relay: não configurado, usando fetch direto');
    return fetch;
  }

  // Derive cf-solver URL: replace port 3456 with 8191
  const cfSolverUrl = relayUrlRaw.replace(/:3456\b/, ':8191');
  console.log(`🌐 VPS Relay CF-Solver: ativo → ${cfSolverUrl}`);

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const options = init || {};

    // Build headers object
    const hdrs: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => { hdrs[k] = v; });
      } else if (Array.isArray(options.headers)) {
        for (const [k, v] of options.headers) { hdrs[k] = v; }
      } else {
        Object.assign(hdrs, options.headers);
      }
    }

    // Extract base URL for the CF-solver session domain
    let baseUrl: string;
    try {
      const parsed = new URL(url);
      baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      baseUrl = url;
    }

    const relayPayload: Record<string, unknown> = {
      url,
      method: options.method || 'GET',
      headers: hdrs,
      baseUrl,
    };

    if (options.body) {
      relayPayload.body = typeof options.body === 'string' ? options.body : String(options.body);
    }

    try {
      const resp = await fetch(`${cfSolverUrl}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
        body: JSON.stringify(relayPayload),
      });

      const data = await resp.json();

      if (data.error) {
        console.warn(`⚠️ CF-Solver error: ${data.error}`);
      }

      // Reconstruct Response from relay JSON
      const responseHeaders = new Headers();
      if (data.headers && typeof data.headers === 'object') {
        for (const [k, v] of Object.entries(data.headers)) {
          try { responseHeaders.set(k, String(v)); } catch {}
        }
      }

      return new Response(data.body || '', {
        status: data.status || 500,
        headers: responseHeaders,
      });
    } catch (e) {
      console.error(`❌ CF-Solver fetch failed: ${(e as Error).message}, falling back to direct fetch`);
      // Fallback to direct fetch if cf-solver is down
      return fetch(input, init);
    }
  };
}

const panelFetch = createPanelFetch();

// Shared: form login + get session cookies
async function formLogin(cleanBase: string, panelUser: string, panelPass: string): Promise<{ success: boolean; cookies: string; csrf: string; error?: string }> {
  const loginResp = await withTimeout(panelFetch(`${cleanBase}/login`, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
  }), 15000);
  const loginHtml = await loginResp.text();

  // Extract all form inputs to detect actual field names
  const inputMatches = [...loginHtml.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*/gi)];
  const formInputs = inputMatches.map(m => {
    const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
    const valueMatch = m[0].match(/value=["']([^"']*?)["']/i);
    return { name: m[1], type: typeMatch?.[1] || 'text', value: valueMatch?.[1] || '' };
  });
  console.log(`📋 Login form inputs: ${JSON.stringify(formInputs)}`);

  // Also check form action
  const formActionMatch = loginHtml.match(/<form[^>]*action=["']([^"']*?)["']/i);
  const formAction = formActionMatch?.[1] || '/login';
  console.log(`📋 Form action: ${formAction}`);

  const csrfFromInput = extractInputValue(loginHtml, 'csrf_token');
  const laravelFromInput = extractInputValue(loginHtml, '_token');
  const metaCsrf = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const csrfToken = csrfFromInput || laravelFromInput || (metaCsrf ? metaCsrf[1] : '') || '';

  let allCookies = mergeSetCookies('', loginResp.headers.get('set-cookie'));

  // Build form body dynamically
  const formBody = new URLSearchParams();
  
  // Add all hidden fields first (CSRF tokens, etc.)
  for (const input of formInputs) {
    if (input.type === 'hidden' && input.value) {
      formBody.append(input.name, input.value);
    }
  }
  
  // Find actual username/password field names
  const userField = formInputs.find(f => /user|email|login|uname/i.test(f.name) && f.type !== 'hidden');
  const passField = formInputs.find(f => /pass|pwd|senha/i.test(f.name));
  const userFieldName = userField?.name || 'username';
  const passFieldName = passField?.name || 'password';
  console.log(`🔑 Using fields: user="${userFieldName}", pass="${passFieldName}"`);
  
  formBody.append(userFieldName, panelUser);
  formBody.append(passFieldName, panelPass);

  // Resolve form action URL properly
  let postUrl = `${cleanBase}/login`;
  if (formAction && formAction !== '/login') {
    postUrl = formAction.startsWith('http') ? formAction : `${cleanBase}${formAction.startsWith('/') ? '' : '/'}${formAction}`;
  }
  console.log(`📤 POST URL: ${postUrl}`);

  const postHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': cleanBase,
    'Referer': `${cleanBase}/login`,
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
  };
  if (allCookies) postHeaders['Cookie'] = allCookies;
  const xsrfMatch = allCookies.match(/XSRF-TOKEN=([^;,\s]+)/);
  if (xsrfMatch) postHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);

  const postResp = await withTimeout(panelFetch(postUrl, {
    method: 'POST',
    headers: postHeaders,
    body: formBody.toString(),
    redirect: 'manual',
  }), 20000);

  // Log ALL response headers to understand the server behavior
  const allHeaders: Record<string, string> = {};
  postResp.headers.forEach((value, key) => { allHeaders[key] = value; });
  console.log(`📋 POST ALL headers: ${JSON.stringify(allHeaders)}`);
  
  // Try getSetCookie for multiple set-cookie headers
  let postSetCookieArr: string[] = [];
  try { postSetCookieArr = (postResp.headers as any).getSetCookie?.() || []; } catch {}
  console.log(`🍪 POST getSetCookie(): ${JSON.stringify(postSetCookieArr)}`);
  
  const postSetCookie = postSetCookieArr.length > 0 ? postSetCookieArr.join(', ') : postResp.headers.get('set-cookie');
  console.log(`🍪 GET cookies: ${allCookies}`);
  console.log(`🍪 POST set-cookie: ${postSetCookie}`);
  console.log(`📝 POST body sent: ${formBody.toString()}`);
  allCookies = mergeSetCookies(allCookies, postSetCookie);
  console.log(`🍪 Merged cookies: ${allCookies}`);
  const postBody = await postResp.text();
  console.log(`📄 POST response body (first 500): ${postBody.substring(0, 500)}`);
  const postLocation = postResp.headers.get('location') || '';
  console.log(`📊 Form login → status: ${postResp.status}, location: ${postLocation}`);

  // Follow redirect (may need multiple hops)
  if (postLocation) {
    let followUrl = postLocation.startsWith('http') ? postLocation : `${cleanBase}/${postLocation.replace(/^\.\//, '')}`;
    let hops = 0;
    while (hops < 5) {
      hops++;
      console.log(`🔗 Follow redirect #${hops}: ${followUrl}`);
      const followResp = await withTimeout(panelFetch(followUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Cookie': allCookies },
        redirect: 'manual',
      }), 15000);
      allCookies = mergeSetCookies(allCookies, followResp.headers.get('set-cookie'));
      const nextLocation = followResp.headers.get('location');
      console.log(`📊 Follow #${hops} → status: ${followResp.status}, location: ${nextLocation}, cookies: ${allCookies.substring(0, 100)}`);
      
      if (followResp.status >= 300 && followResp.status < 400 && nextLocation) {
        // Check if redirected back to login = failed
        if (nextLocation.includes('/login')) {
          await followResp.text();
          return { success: false, cookies: allCookies, csrf: csrfToken, error: 'Login falhou - redirecionado para login' };
        }
        followUrl = nextLocation.startsWith('http') ? nextLocation : `${cleanBase}/${nextLocation.replace(/^\.\//, '')}`;
        await followResp.text();
        continue;
      }
      
      const dashHtml = await followResp.text();
      console.log(`📄 Follow #${hops} body snippet: ${dashHtml.substring(0, 300)}`);
      
      // If we landed on dashboard (not login page), session is valid
      if (!dashHtml.includes('/login') && (dashHtml.includes('dashboard') || dashHtml.includes('Dashboard') || followResp.ok)) {
        const dashCsrf = dashHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
        return { success: true, cookies: allCookies, csrf: dashCsrf ? dashCsrf[1] : csrfToken };
      }
      
      // Landed on login page = failed
      if (dashHtml.includes('/login') || dashHtml.includes('try_login')) {
        return { success: false, cookies: allCookies, csrf: csrfToken, error: 'Login falhou - credenciais inválidas' };
      }
      break;
    }
  }

  // Verify session via API
  console.log(`🔍 Verifying session via API with cookies: ${allCookies.substring(0, 100)}`);
  const verifyResp = await withTimeout(panelFetch(`${cleanBase}/dashboard/api?get_info&month=0`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': allCookies,
      'Referer': `${cleanBase}/dashboard/`,
    },
  }), 15000);
  const verifyText = await verifyResp.text();
  console.log(`📊 Verify API → status: ${verifyResp.status}, snippet: ${verifyText.substring(0, 200)}`);
  let verifyJson: any = null;
  try { verifyJson = JSON.parse(verifyText); } catch {}

  if (verifyResp.ok && verifyJson && typeof verifyJson === 'object' && !verifyText.includes('/login')) {
    return { success: true, cookies: allCookies, csrf: csrfToken };
  }

  return { success: false, cookies: allCookies, csrf: csrfToken, error: 'Login falhou - sessão não validada' };
}

// Fetch client stats using JWT token (for koffice-api where senha = api_key)
async function fetchClientStatsViaToken(baseUrl: string, token: string, panelUser: string, panelPass: string, ua: string): Promise<{ total: string | null; active: string | null }> {
  // Strategy 1: Try dashboard API with JWT token in various auth mechanisms
  const dashboardApiUrl = `${baseUrl}/dashboard/api?get_info&month=0`;
  const authMethods = [
    { label: 'Bearer', headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' } },
    { label: 'X-Auth-Token', headers: { 'X-Auth-Token': token, 'X-Requested-With': 'XMLHttpRequest' } },
    { label: 'Token-cookie', headers: { 'Cookie': `token=${token}`, 'X-Requested-With': 'XMLHttpRequest' } },
  ];
  
  for (const method of authMethods) {
    try {
      console.log(`📋 fetchClientStatsViaToken: trying dashboard API with ${method.label}...`);
      const resp = await withTimeout(panelFetch(dashboardApiUrl, {
        method: 'GET',
        headers: { 'User-Agent': ua, 'Accept': 'application/json, */*', 'Referer': `${baseUrl}/dashboard/`, ...method.headers },
      }), 15000);
      const text = await resp.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      console.log(`📋 dashboard API (${method.label}) → status: ${resp.status}, isJSON: ${!!json}, snippet: ${text.substring(0, 300)}`);
      if (resp.ok && json && !text.includes('/login')) {
        if (json.iptv) return { total: String(json.iptv.clients_count || 0), active: String(json.iptv.active_clients_count || 0) };
        if (json.clients_count !== undefined) return { total: String(json.clients_count || 0), active: String(json.active_clients_count || 0) };
      }
    } catch (e) {
      console.log(`⚠️ dashboard API (${method.label}): ${(e as Error).message}`);
    }
  }

  // Strategy 2: Login via /api/login to get a session, then use that session for dashboard
  try {
    console.log(`📋 fetchClientStatsViaToken: trying /api/login to get session cookies...`);
    const loginResp = await withTimeout(panelFetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `username=${encodeURIComponent(panelUser)}&api_key=${encodeURIComponent(panelPass)}`,
    }), 15000);
    
    // Collect session cookies from the API login response
    let apiCookies = '';
    try {
      const setCookieArr = (loginResp.headers as any).getSetCookie?.() || [];
      apiCookies = setCookieArr.map((c: string) => c.split(';')[0]).join('; ');
    } catch {}
    if (!apiCookies) {
      apiCookies = mergeSetCookies('', loginResp.headers.get('set-cookie'));
    }
    const loginText = await loginResp.text();
    let loginJson: any = null;
    try { loginJson = JSON.parse(loginText); } catch {}
    console.log(`📋 /api/login session → cookies: ${apiCookies}, result: ${loginText.substring(0, 200)}`);
    
    if (loginJson?.result === 'success' && apiCookies) {
      // Visit /dashboard/ with these cookies to initialize session
      const dashVisit = await withTimeout(panelFetch(`${baseUrl}/dashboard/`, {
        method: 'GET',
        headers: { 'User-Agent': ua, 'Accept': 'text/html', 'Cookie': apiCookies },
        redirect: 'manual',
      }), 15000);
      apiCookies = mergeSetCookies(apiCookies, dashVisit.headers.get('set-cookie'));
      const dashVisitBody = await dashVisit.text();
      console.log(`📋 /dashboard/ via API cookies → status: ${dashVisit.status}, cookies: ${apiCookies.substring(0, 150)}, snippet: ${dashVisitBody.substring(0, 200)}`);
      
      // Now try dashboard API
      const apiResp = await withTimeout(panelFetch(dashboardApiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'application/json, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': apiCookies,
          'Referer': `${baseUrl}/dashboard/`,
        },
      }), 15000);
      const apiText = await apiResp.text();
      let apiJson: any = null;
      try { apiJson = JSON.parse(apiText); } catch {}
      console.log(`📋 dashboard API via API session → status: ${apiResp.status}, isJSON: ${!!apiJson}, snippet: ${apiText.substring(0, 300)}`);
      if (apiResp.ok && apiJson && !apiText.includes('/login')) {
        if (apiJson.iptv) return { total: String(apiJson.iptv.clients_count || 0), active: String(apiJson.iptv.active_clients_count || 0) };
        if (apiJson.clients_count !== undefined) return { total: String(apiJson.clients_count || 0), active: String(apiJson.active_clients_count || 0) };
      }
    }
  } catch (e) {
    console.log(`⚠️ API session strategy: ${(e as Error).message}`);
  }

  // Strategy 3: Try various REST API endpoints with JWT
  const tokenEndpoints = ['/api/clients', '/api/users', '/api/resellers', '/api/v1/clients', '/api/v1/users'];
  for (const ep of tokenEndpoints) {
    try {
      console.log(`📋 fetchClientStatsViaToken: trying ${ep}...`);
      const resp = await withTimeout(panelFetch(`${baseUrl}${ep}`, {
        method: 'GET',
        headers: { 'User-Agent': ua, 'Accept': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
      }), 15000);
      const text = await resp.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      if (resp.ok && json && !text.includes('/login')) {
        if (Array.isArray(json) && json.length > 0) {
          const total = json.length;
          const active = json.filter((c: any) => c.status === 'active' || c.status === 'Enabled' || c.enabled === true || c.is_active === true || c.status === 1).length;
          return { total: String(total), active: String(active) };
        }
        if (json.iptv) return { total: String(json.iptv.clients_count || 0), active: String(json.iptv.active_clients_count || 0) };
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const total = json.data.length;
          const active = json.data.filter((c: any) => c.status === 'active' || c.status === 'Enabled' || c.enabled === true).length;
          return { total: String(total), active: String(active) };
        }
      }
    } catch (e) {
      console.log(`⚠️ token ${ep}: ${(e as Error).message}`);
    }
  }
  
  return { total: null, active: null };
}

// Fetch client stats - tries session cookies (form login) to get dashboard data
async function fetchClientStatsViaCookies(baseUrl: string, panelUser: string, panelPass: string, ua: string): Promise<{ total: string | null; active: string | null }> {
  try {
    console.log(`📋 fetchClientStats: doing form login to get session cookies...`);
    const loginResult = await formLogin(baseUrl, panelUser, panelPass);
    if (!loginResult.success || !loginResult.cookies) {
      console.log(`📋 fetchClientStats: form login failed, cannot get stats`);
      return { total: null, active: null };
    }
    console.log(`📋 fetchClientStats: form login OK, visiting /dashboard/ first...`);
    
    // Visit /dashboard/ first to ensure server sets up the session for API access
    let cookies = loginResult.cookies;
    try {
      const dashResp = await withTimeout(panelFetch(`${baseUrl}/dashboard/`, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookies,
          'Referer': baseUrl + '/',
        },
        redirect: 'manual',
      }), 15000);
      cookies = mergeSetCookies(cookies, dashResp.headers.get('set-cookie'));
      const dashBody = await dashResp.text();
      console.log(`📋 /dashboard/ → status: ${dashResp.status}, cookies: ${cookies.substring(0, 150)}, body snippet: ${dashBody.substring(0, 200)}`);
      
      // Follow redirect if needed
      const dashLocation = dashResp.headers.get('location');
      if (dashLocation && dashResp.status >= 300 && dashResp.status < 400) {
        const followUrl = dashLocation.startsWith('http') ? dashLocation : `${baseUrl}${dashLocation.startsWith('/') ? '' : '/'}${dashLocation}`;
        const followResp = await withTimeout(panelFetch(followUrl, {
          method: 'GET',
          headers: { 'User-Agent': ua, 'Accept': 'text/html', 'Cookie': cookies },
          redirect: 'manual',
        }), 15000);
        cookies = mergeSetCookies(cookies, followResp.headers.get('set-cookie'));
        await followResp.text();
        console.log(`📋 /dashboard/ follow → status: ${followResp.status}, cookies: ${cookies.substring(0, 150)}`);
      }
    } catch (e) {
      console.log(`⚠️ /dashboard/ visit error: ${(e as Error).message}`);
    }
    
    // Now fetch the dashboard API with the enriched cookies
    console.log(`📋 fetchClientStats: fetching dashboard API...`);
    const resp = await withTimeout(panelFetch(`${baseUrl}/dashboard/api?get_info&month=0`, {
      method: 'GET',
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookies,
        'Referer': `${baseUrl}/dashboard/`,
      },
    }), 15000);
    const text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`📋 dashboard/api → status: ${resp.status}, isJSON: ${!!json}, response: ${text.substring(0, 300)}`);
    
    if (resp.ok && json) {
      if (json.iptv) {
        return { total: String(json.iptv.clients_count || 0), active: String(json.iptv.active_clients_count || 0) };
      }
      if (json.clients_count !== undefined) {
        return { total: String(json.clients_count || 0), active: String(json.active_clients_count || 0) };
      }
    }
  } catch (e) {
    console.log(`⚠️ fetchClientStats error: ${(e as Error).message}`);
  }
  return { total: null, active: null };
}

// Test connection - try Xtream API first, then form login (fast path)
async function testConnection(baseUrl: string, panelUser: string, panelPass: string, provedor?: string): Promise<{ success: boolean; clients_count?: string; active_clients_count?: string; error?: string }> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  const isV2 = provedor === 'koffice-v2';
  const isApi = provedor === 'koffice-api';

  // Strategy 1: Try Xtream/Panel API — ONLY for koffice-api (or unknown)
  if (!isV2) {
    const apiPaths = ['/panel_api.php', '/api.php'];
    for (const path of apiPaths) {
      try {
        const apiUrl = `${cleanBase}${path}?username=${encodeURIComponent(panelUser)}&password=${encodeURIComponent(panelPass)}`;
        console.log(`🔍 Trying Xtream API: ${path}`);
        const resp = await withTimeout(panelFetch(apiUrl, {
          method: 'GET',
          headers: { 'User-Agent': ua, 'Accept': 'application/json' },
        }), 10000);
        const text = await resp.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        console.log(`📊 Xtream ${path} → status: ${resp.status}, isJSON: ${!!json}`);
        
        if (resp.ok && json && typeof json === 'object') {
          if (json.user_info || json.server_info || json.result === true || json.success) {
            return {
              success: true,
              clients_count: json.clients_count || json.user_info?.max_connections || 'n/d',
              active_clients_count: json.user_info?.active_cons || json.active_clients_count || 'n/d',
            };
          }
        }
      } catch (e) {
        console.log(`⚠️ Xtream ${path}: ${(e as Error).message}`);
      }
    }
  }
  
  // Strategy 2: Try JSON API login — ONLY for koffice-api (or unknown)
  if (!isV2) {
    const apiEndpoints = ['/api/login', '/api/v1/login'];
    
    // Try JSON payloads
    const apiPayloadVariants = [
      { label: 'username,api_key (json)', build: (u: string, p: string) => ({ username: u, api_key: p }) },
      { label: 'username,password (json)', build: (u: string, p: string) => ({ username: u, password: p }) },
      { label: 'login,api_key (json)', build: (u: string, p: string) => ({ login: u, api_key: p }) },
      { label: 'login,password (json)', build: (u: string, p: string) => ({ login: u, password: p }) },
    ];
    for (const ep of apiEndpoints) {
      for (const variant of apiPayloadVariants) {
        try {
          const payload = variant.build(panelUser, panelPass);
          console.log(`🔑 Trying ${ep} (${variant.label})`);
          const resp = await withTimeout(panelFetch(`${cleanBase}${ep}`, {
            method: 'POST',
            headers: { 'User-Agent': ua, 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(payload),
          }), 10000);
          const text = await resp.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          console.log(`📊 ${ep} (${variant.label}) → status: ${resp.status}, response: ${text.substring(0, 200)}`);
          
          if (json && json.result !== 'failed' && json.result !== 'invalid_data' && (json.token || json.access_token || json.success || json.result === 'success' || json.result === true || json.session_id || json.user)) {
            // Try JWT token first for stats, then fall back to cookies
            const jwtToken = json.token || json.access_token;
            let clientStats = { total: null as string | null, active: null as string | null };
            if (jwtToken) {
              clientStats = await fetchClientStatsViaToken(cleanBase, jwtToken, panelUser, panelPass, ua);
            }
            if (!clientStats.total) {
              clientStats = await fetchClientStatsViaCookies(cleanBase, panelUser, panelPass, ua);
            }
            return { success: true, clients_count: clientStats.total || json.clients_count || 'n/d', active_clients_count: clientStats.active || json.active_clients_count || 'n/d' };
          }
        } catch (e) {
          console.log(`⚠️ ${ep} (${variant.label}): ${(e as Error).message}`);
        }
      }

      // Also try x-www-form-urlencoded format
      const formVariants = [
        { label: 'username,api_key (form)', uField: 'username', pField: 'api_key' },
        { label: 'username,password (form)', uField: 'username', pField: 'password' },
        { label: 'login,api_key (form)', uField: 'login', pField: 'api_key' },
        { label: 'login,password (form)', uField: 'login', pField: 'password' },
      ];
      for (const variant of formVariants) {
        try {
          const formBody = new URLSearchParams();
          formBody.append(variant.uField, panelUser);
          formBody.append(variant.pField, panelPass);
          console.log(`🔑 Trying ${ep} (${variant.label})`);
          const resp = await withTimeout(panelFetch(`${cleanBase}${ep}`, {
            method: 'POST',
            headers: { 'User-Agent': ua, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
            body: formBody.toString(),
          }), 10000);
          const text = await resp.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          console.log(`📊 ${ep} (${variant.label}) → status: ${resp.status}, response: ${text.substring(0, 200)}`);
          
          if (json && json.result !== 'failed' && json.result !== 'invalid_data' && (json.token || json.access_token || json.success || json.result === 'success' || json.result === true || json.session_id || json.user)) {
            const jwtToken = json.token || json.access_token;
            let clientStats = { total: null as string | null, active: null as string | null };
            if (jwtToken) {
              clientStats = await fetchClientStatsViaToken(cleanBase, jwtToken, panelUser, panelPass, ua);
            }
            if (!clientStats.total) {
              clientStats = await fetchClientStatsViaCookies(cleanBase, panelUser, panelPass, ua);
            }
            return { success: true, clients_count: clientStats.total || json.clients_count || 'n/d', active_clients_count: clientStats.active || json.active_clients_count || 'n/d' };
          }
        } catch (e) {
          console.log(`⚠️ ${ep} (${variant.label}): ${(e as Error).message}`);
        }
      }
    }

    // For koffice-api: if none of the API strategies worked, fail immediately — do NOT fallback to form login
    if (isApi) {
      return { success: false, error: 'Nenhuma API Xtream ou JSON encontrada. Verifique se este painel suporta API. Se usa login por formulário, cadastre como KOffice V2.' };
    }
  }
  
  // Strategy 3: Form login — ONLY for koffice-v2 (or unknown)
  console.log(`🔄 Trying form login...`);
  const loginResult = await formLogin(cleanBase, panelUser, panelPass);

  if (!loginResult.success) {
    return { success: false, error: isV2 ? 'Usuário ou senha inválidos.' : 'Nenhum método de autenticação funcionou.' };
  }

  // Try to get dashboard info with session
  const infoResp = await withTimeout(panelFetch(`${cleanBase}/dashboard/api?get_info&month=0`, {
    method: 'GET',
    headers: {
      'User-Agent': ua,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': loginResult.cookies,
      'Referer': `${cleanBase}/dashboard/`,
    },
  }), 15000);

  const infoText = await infoResp.text();
  let infoJson: any = null;
  try { infoJson = JSON.parse(infoText); } catch {}

  if (infoResp.ok && infoJson?.iptv) {
    return {
      success: true,
      clients_count: infoJson.iptv.clients_count,
      active_clients_count: infoJson.iptv.active_clients_count,
    };
  }

  if (infoText.includes('/login')) {
    return { success: false, error: 'Usuário ou senha inválidos.' };
  }

  return { success: false, error: 'Não foi possível verificar a sessão no painel.' };
}

// KOffice API (Xtream-style) renewal
async function xtreamRenew(baseUrl: string, panelUser: string, panelPass: string, clientUsername: string, duration: number, durationIn: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const apiPaths = ['/panel_api.php', '/api.php'];

  for (const path of apiPaths) {
    const searchUrl = `${cleanBase}${path}?username=${encodeURIComponent(panelUser)}&password=${encodeURIComponent(panelPass)}&action=user&sub=list`;
    try {
      console.log(`🔍 KOffice Xtream: Buscando clientes via ${path}`);
      const searchResp = await withTimeout(panelFetch(searchUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }), 20000);
      const searchText = await searchResp.text();
      console.log(`📋 Xtream ${path} search → status: ${searchResp.status}, length: ${searchText.length}, snippet: ${searchText.substring(0, 300)}`);
      let searchJson: any = null;
      try { searchJson = JSON.parse(searchText); } catch {}

      if (!searchResp.ok || !searchJson) {
        console.log(`⚠️ Xtream ${path}: resposta inválida (ok=${searchResp.ok}, isJSON=${!!searchJson})`);
        continue;
      }

      let clientId: string | null = null;
      const isObject = typeof searchJson === 'object' && !Array.isArray(searchJson);
      const isArray = Array.isArray(searchJson);
      console.log(`📋 Xtream ${path}: tipo=${isObject ? 'object' : isArray ? 'array' : typeof searchJson}, keys=${isObject ? Object.keys(searchJson).length : isArray ? searchJson.length : 0}`);

      if (isObject) {
        for (const [id, user] of Object.entries(searchJson as Record<string, any>)) {
          if ((user.username || '').toLowerCase() === clientUsername.toLowerCase()) {
            clientId = id;
            break;
          }
        }
      } else if (isArray) {
        const match = searchJson.find((u: any) => (u.username || '').toLowerCase() === clientUsername.toLowerCase());
        if (match) clientId = String(match.id || match.user_id);
      }

      if (!clientId) {
        console.log(`⚠️ KOffice Xtream: Usuário "${clientUsername}" não encontrado via ${path}. Primeiros 3 usernames: ${
          isObject 
            ? Object.entries(searchJson as Record<string, any>).slice(0, 3).map(([id, u]: [string, any]) => `${id}:${u.username}`).join(', ')
            : isArray
              ? searchJson.slice(0, 3).map((u: any) => u.username).join(', ')
              : 'N/A'
        }`);
        continue;
      }

      console.log(`✅ KOffice: Cliente encontrado (ID: ${clientId})`);

      const extendUrl = `${cleanBase}${path}?username=${encodeURIComponent(panelUser)}&password=${encodeURIComponent(panelPass)}&action=user&sub=extend&user_id=${clientId}&duration=${duration}&duration_in=${durationIn}`;
      const extendResp = await withTimeout(panelFetch(extendUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }), 20000);
      const extendText = await extendResp.text();
      console.log(`📋 Xtream extend → status: ${extendResp.status}, body: ${extendText.substring(0, 300)}`);
      let extendJson: any = null;
      try { extendJson = JSON.parse(extendText); } catch {}

      if (extendResp.ok && (extendJson?.result === true || extendJson?.success || extendJson?.result === 1)) {
        return { success: true, message: 'Cliente renovado com sucesso via Xtream API' };
      }

      const altExtendUrl = `${cleanBase}${path}?username=${encodeURIComponent(panelUser)}&password=${encodeURIComponent(panelPass)}&action=edit_user&user_id=${clientId}&duration=${duration}&duration_in=${durationIn}`;
      const altResp = await withTimeout(panelFetch(altExtendUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }), 20000);
      const altText = await altResp.text();
      console.log(`📋 Xtream edit_user → status: ${altResp.status}, body: ${altText.substring(0, 300)}`);
      let altJson: any = null;
      try { altJson = JSON.parse(altText); } catch {}

      if (altResp.ok && (altJson?.result === true || altJson?.success || altJson?.result === 1)) {
        return { success: true, message: 'Cliente renovado com sucesso via Xtream API' };
      }
      
      console.log(`⚠️ Xtream ${path}: extend/edit_user falhou. extend: ${JSON.stringify(extendJson)}, edit_user: ${JSON.stringify(altJson)}`);
    } catch (e) {
      console.log(`⚠️ KOffice Xtream ${path}: ${(e as Error).message}`);
    }
  }

  return { success: false, error: 'Não foi possível renovar via Xtream API' };
}

// KOffice V2 (form-based) renewal
// Based on actual KOffice Panel v4.4 API captured via F12:
//   Search: POST /clients/api/?get_clients (DataTables with search[value]=USERNAME)
//   Renew:  POST /clients/api/?renew_client_plus&client_id=ID&months=N (empty body)
//   Response: {"result":"success"}
async function kofficeV2Renew(baseUrl: string, panelUser: string, panelPass: string, clientUsername: string, duration: number, durationIn: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const loginResult = await formLogin(cleanBase, panelUser, panelPass);

  if (!loginResult.success) {
    return { success: false, error: `Login KOffice V2 falhou: ${loginResult.error}` };
  }

  console.log(`✅ KOffice V2: Login OK, buscando cliente "${clientUsername}"`);

  const baseHeaders: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  };
  if (loginResult.cookies) baseHeaders['Cookie'] = loginResult.cookies;

  // ---- Step 1: Search for client using EXACT DataTables format from KOffice Panel v4.4 ----
  let clientId: string | null = null;

  // Build the exact DataTables payload the panel sends (10 columns, empty names, filter_value, reseller_id)
  const dtBody = new URLSearchParams();
  dtBody.append('draw', '1');
  for (let i = 0; i <= 9; i++) {
    dtBody.append(`columns[${i}][data]`, String(i));
    dtBody.append(`columns[${i}][name]`, '');
    dtBody.append(`columns[${i}][searchable]`, 'true');
    dtBody.append(`columns[${i}][orderable]`, 'true');
    dtBody.append(`columns[${i}][search][value]`, '');
    dtBody.append(`columns[${i}][search][regex]`, 'false');
  }
  dtBody.append('order[0][column]', '0');
  dtBody.append('order[0][dir]', 'desc');
  dtBody.append('start', '0');
  dtBody.append('length', '10');
  dtBody.append('search[value]', clientUsername);
  dtBody.append('search[regex]', 'false');
  dtBody.append('filter_value', '#');
  dtBody.append('reseller_id', '-1');

  try {
    const searchUrl = `${cleanBase}/clients/api/?get_clients`;
    console.log(`🔍 KOffice V2: POST ${searchUrl} search=${clientUsername}`);
    const resp = await withTimeout(panelFetch(searchUrl, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': cleanBase,
        'Referer': `${cleanBase}/clients/`,
      },
      body: dtBody.toString(),
    }), 20000);

    const text = await resp.text();
    console.log(`📋 KOffice V2 search → status: ${resp.status}, length: ${text.length}, snippet: ${text.substring(0, 400)}`);
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (resp.ok && json?.data && Array.isArray(json.data)) {
      // DataTables format: data is array of arrays: [[id, login, senha, adicionado, vencimento, master, conexoes, notas, status, acoes, ...], ...]
      // Column 0 = ID, Column 1 = Login (may have HTML like <i> tags)
      for (const row of json.data) {
        if (!Array.isArray(row)) continue;
        // Strip HTML from login column and check match
        const loginRaw = String(row[1] || '').replace(/<[^>]*>/g, '').trim();
        if (loginRaw.toLowerCase() === clientUsername.toLowerCase()) {
          clientId = String(row[0]).replace(/<[^>]*>/g, '').trim();
          console.log(`✅ KOffice V2: Cliente encontrado (ID: ${clientId}, Login: ${loginRaw})`);
          break;
        }
      }
      if (!clientId && json.data.length > 0) {
        // Log first few entries for debugging
        const firstLogins = json.data.slice(0, 3).map((r: any[]) => String(r[1] || '').replace(/<[^>]*>/g, '').trim());
        console.log(`⚠️ KOffice V2: "${clientUsername}" não encontrado em ${json.recordsFiltered} resultados. Primeiros: ${firstLogins.join(', ')}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ KOffice V2 search error: ${(e as Error).message}`);
  }

  if (!clientId) {
    return { success: false, error: `Usuário "${clientUsername}" não encontrado no painel KOffice` };
  }

  // ---- Step 2: Renew using renew_client_plus endpoint (exact format from F12) ----
  // Convert duration/durationIn to months
  let months = duration;
  if (durationIn === 'days') months = Math.max(1, Math.round(duration / 30));
  else if (durationIn === 'years') months = duration * 12;
  // If durationIn is already 'months' or 'month', use as-is

  const renewUrl = `${cleanBase}/clients/api/?renew_client_plus&client_id=${clientId}&months=${months}`;
  console.log(`🔄 KOffice V2: POST ${renewUrl} (empty body)`);

  try {
    const renewResp = await withTimeout(panelFetch(renewUrl, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': cleanBase,
        'Referer': `${cleanBase}/clients/`,
      },
      body: '', // empty body - exactly like the browser does
    }), 20000);

    const renewText = await renewResp.text();
    console.log(`📋 KOffice V2 renew → status: ${renewResp.status}, response: ${renewText.substring(0, 300)}`);
    let renewJson: any = null;
    try { renewJson = JSON.parse(renewText); } catch {}

    if (renewResp.ok && renewJson?.result === 'success') {
      return { success: true, message: `Cliente renovado com sucesso por ${months} mês(es) no KOffice V2` };
    }

    // Also check for other success indicators
    if (renewResp.ok && (renewJson?.success === true || renewJson?.result === true || renewJson?.result === 1)) {
      return { success: true, message: renewJson?.message || `Cliente renovado com sucesso no KOffice V2` };
    }

    return { success: false, error: `Renovação falhou: ${renewText.substring(0, 200)}` };
  } catch (e) {
    return { success: false, error: `Erro ao renovar: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, panelId, username, duration, durationIn, url: directUrl, panelUser: directUser, panelPass: directPass, providerId } = body;

    const authHeader = req.headers.get('Authorization') || '';
    const userToken = authHeader.replace('Bearer ', '');
    const isServiceRoleRequest = getJwtRole(userToken) === 'service_role';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection action
    if (action === 'test_connection') {
      let testUrl: string, testUser: string, testPass: string;
      let resolvedProvedor: string | undefined = providerId;

      if (panelId) {
        const { data: testPanel } = await supabase
          .from('paineis_integracao')
          .select('*')
          .eq('id', panelId)
          .in('provedor', ['koffice-api', 'koffice-v2'])
          .single();
        if (!testPanel) {
          return new Response(JSON.stringify({ success: false, error: 'Painel não encontrado' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
          });
        }
        const testCreds = await resolveVaultCreds(supabase, testPanel, userToken);
        testUrl = testPanel.url;
        testUser = testCreds.usuario;
        testPass = testCreds.senha;
        resolvedProvedor = testPanel.provedor || providerId;
      } else {
        testUrl = directUrl;
        testUser = directUser;
        testPass = directPass;
      }

      if (!testUrl || !testUser || !testPass) {
        return new Response(JSON.stringify({ success: false, error: 'URL, usuário e senha são obrigatórios' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      console.log(`🧪 KOffice test_connection: ${testUrl} (user: ${testUser}, provedor: ${resolvedProvedor})`);
      const result = await testConnection(testUrl, testUser, testPass, resolvedProvedor);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Renew action
    const { data: panel } = await supabase
      .from('paineis_integracao')
      .select('*')
      .eq('id', panelId)
      .in('provedor', ['koffice-api', 'koffice-v2'])
      .single();

    if (!panel) {
      return new Response(JSON.stringify({ success: false, error: 'Painel KOffice não encontrado' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (action === 'renew_by_username') {
      if (!username || !duration || !durationIn) {
        return new Response(JSON.stringify({ success: false, error: 'username, duration e durationIn são obrigatórios' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      console.log(`🔄 KOffice (${panel.provedor}): Renovando "${username}" no painel ${panel.nome}`);

      // For service_role requests (auto-renew), don't pass userToken so it uses admin_get_gateway_secret
      const renewCreds = await resolveVaultCreds(supabase, panel, isServiceRoleRequest ? undefined : userToken);
      let result;
      if (panel.provedor === 'koffice-api' || panel.provedor === 'koffice-v2') {
        // Use V2 DataTables API first (proven to work), fallback to Xtream for koffice-api
        result = await kofficeV2Renew(panel.url, renewCreds.usuario, renewCreds.senha, username, Number(duration), durationIn);
        if (!result.success && panel.provedor === 'koffice-api') {
          console.log(`⚠️ V2 DataTables falhou (${result.error}), tentando via Xtream API...`);
          result = await xtreamRenew(panel.url, renewCreds.usuario, renewCreds.senha, username, Number(duration), durationIn);
        }
      } else {
        result = await kofficeV2Renew(panel.url, renewCreds.usuario, renewCreds.senha, username, Number(duration), durationIn);

        // Fallback for manual requests: use AI browser agent when API lookup fails
        if (!result.success && !isServiceRoleRequest) {
          try {
            console.warn(`⚠️ KOffice V2 API falhou (${result.error}), acionando fallback universal-panel...`);
            const fallbackResp = await fetch(`${supabaseUrl}/functions/v1/universal-panel`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {}),
              },
              body: JSON.stringify({
                action: 'renew',
                panelId,
                clientUsername: username,
                duration: Number(duration),
                durationIn,
                userId: panel.user_id,
                runAsync: false,
              }),
            });
            const fallbackData = await fallbackResp.json();
            if (fallbackData?.success) {
              result = {
                ...fallbackData,
                message: fallbackData.message || 'Renovação iniciada via fallback automático',
              };
            } else {
              result = {
                ...result,
                error: `${result.error} | fallback universal-panel: ${fallbackData?.error || 'falhou'}`,
              };
            }
          } catch (fallbackErr: any) {
            result = {
              ...result,
              error: `${result.error} | fallback universal-panel erro: ${fallbackErr.message}`,
            };
          }
        }
      }

      if (result.success) {
        const authHeader = req.headers.get('authorization');
        if (authHeader) {
          const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
          const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
          if (user?.id) {
            await supabase.from('logs_painel').insert({
              user_id: user.id,
              acao: `Renovação KOffice: cliente ${username} → +${duration} ${durationIn} (Painel: ${panel.nome})`,
              tipo: 'renovacao',
            });
          }
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Action inválida. Use: test_connection, renew_by_username' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  } catch (error) {
    console.error(`❌ Erro: ${(error as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
