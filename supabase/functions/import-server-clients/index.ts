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

const PLAYFAST_API_BASE = 'https://api.painelcliente.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

function mergeSetCookies(existing: string, setCookieHeader: string | null): string {
  if (!setCookieHeader) return existing;
  const parts = setCookieHeader.split(/,\s*(?=[A-Za-z_-]+=)/).map(c => c.split(';')[0].trim());
  const existingParts = existing ? existing.split('; ').filter(Boolean) : [];
  const cookieMap = new Map<string, string>();
  for (const c of existingParts) { const n = c.split('=')[0]; if (n) cookieMap.set(n, c); }
  for (const c of parts) { const n = c.split('=')[0]; if (n) cookieMap.set(n, c); }
  return [...cookieMap.values()].join('; ');
}


// Helper: make request through VPS relay /proxy (returns headers with set-cookie)
async function relayProxyFetch(url: string, options: { method: string; headers: Record<string, string>; body?: string; followRedirects?: boolean }): Promise<{ text: string; status: number; headers: Record<string, string> }> {
  const relayUrl = Deno.env.get('VPS_RELAY_URL') || '';
  const relaySecret = Deno.env.get('VPS_RELAY_SECRET') || '';
  
  if (!relayUrl) throw new Error('VPS_RELAY_URL não configurada');
  
  console.log(`🔄 Relay proxy: ${options.method} ${url}`);
  const resp = await withTimeout(fetch(`${relayUrl}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
    body: JSON.stringify({
      url,
      method: options.method,
      headers: options.headers,
      body: options.body || undefined,
      followRedirects: options.followRedirects ?? true,
    }),
  }), 30000);
  
  const data = await resp.json();
  return {
    text: data.body || '',
    status: data.status || 0,
    headers: data.headers || {},
  };
}

// Helper: extract cookies from relay proxy response headers
function extractSetCookies(responseHeaders: Record<string, string>): string[] {
  const setCookie = responseHeaders['set-cookie'] || '';
  if (!setCookie) return [];
  return setCookie.split(/,\s*(?=[A-Za-z_-]+=)/).map(c => c.split(';')[0].trim()).filter(Boolean);
}

// ── KOffice API (Form Login + DataTable via Relay Proxy): list clients ──
async function listKofficeApiClients(baseUrl: string, panelUser: string, panelPass: string): Promise<any[]> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  console.log(`🔑 KOffice API: iniciando login via Relay Proxy em ${cleanBase}`);

  // First resolve Cloudflare via CF Solver
  const relayUrl = Deno.env.get('VPS_RELAY_URL') || '';
  const relaySecret = Deno.env.get('VPS_RELAY_SECRET') || '';
  let cfSolverUrl = '';
  try {
    const parsed = new URL(relayUrl);
    cfSolverUrl = `${parsed.protocol}//${parsed.hostname}:8191`;
  } catch {}

  if (cfSolverUrl) {
    try {
      console.log(`🌐 Resolvendo Cloudflare para ${cleanBase}...`);
      await withTimeout(fetch(`${cfSolverUrl}/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanBase }),
      }), 90000);
      console.log('✅ Cloudflare resolvido (cookies cacheados no relay)');
    } catch (e) {
      console.log(`⚠️ CF Solver falhou: ${(e as Error).message}, tentando sem ele...`);
    }
  }

  // Also call /flaresolverr on the relay to populate its cookie cache
  if (relayUrl) {
    try {
      await withTimeout(fetch(`${relayUrl}/flaresolverr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
        body: JSON.stringify({ url: cleanBase }),
      }), 90000);
    } catch {}
  }

  let allCookies = '';

  // Step 1: GET login page to get CSRF token and session cookie
  const loginPageResult = await relayProxyFetch(`${cleanBase}/login`, {
    method: 'GET',
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
  });
  const loginHtml = loginPageResult.text;
  console.log(`📊 KOffice API login page: status ${loginPageResult.status}, length ${loginHtml.length}`);

  // Accumulate cookies from GET response
  for (const c of extractSetCookies(loginPageResult.headers)) {
    allCookies = mergeSetCookies(allCookies, c);
  }
  console.log(`🍪 GET cookies: ${allCookies.substring(0, 150)}`);

  // Extract CSRF token
  const csrfMatch = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/) ||
    loginHtml.match(/name=["']csrf_token["']\s+value=["'](.*?)["']/) ||
    loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  console.log(`🔐 KOffice API: CSRF token ${csrfToken ? 'encontrado (' + csrfToken.substring(0, 20) + '...)' : 'não encontrado'}`);

  // Detect form field names
  const inputMatches = [...loginHtml.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*/gi)];
  const formInputs = inputMatches.map(m => {
    const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
    const valueMatch = m[0].match(/value=["']([^"']*?)["']/i);
    return { name: m[1], type: typeMatch?.[1] || 'text', value: valueMatch?.[1] || '' };
  });
  const userField = formInputs.find(f => /user|email|login|uname/i.test(f.name) && f.type !== 'hidden');
  const passField = formInputs.find(f => /pass|pwd|senha/i.test(f.name));
  const userFieldName = userField?.name || 'username';
  const passFieldName = passField?.name || 'password';
  console.log(`📝 Form fields: user=${userFieldName}, pass=${passFieldName}, hidden=${formInputs.filter(f => f.type === 'hidden').map(f => f.name).join(',')}`);

  // Build form body
  const formParts: string[] = [];
  for (const input of formInputs) {
    if (input.type === 'hidden' && input.value) {
      formParts.push(`${encodeURIComponent(input.name)}=${encodeURIComponent(input.value)}`);
    }
  }
  formParts.push(`${encodeURIComponent(userFieldName)}=${encodeURIComponent(panelUser)}`);
  formParts.push(`${encodeURIComponent(passFieldName)}=${encodeURIComponent(panelPass)}`);
  const formBody = formParts.join('&');

  // Step 2: POST login with cookies (NO redirect follow - capture Set-Cookie from 302)
  const postHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml',
    'Origin': cleanBase, 'Referer': `${cleanBase}/login`,
  };
  if (allCookies) postHeaders['Cookie'] = allCookies;
  const xsrfMatch = allCookies.match(/XSRF-TOKEN=([^;,\s]+)/);
  if (xsrfMatch) postHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);

  console.log(`🔑 KOffice API: fazendo POST login (no-redirect)...`);
  const loginResult = await relayProxyFetch(`${cleanBase}/login`, {
    method: 'POST', headers: postHeaders, body: formBody, followRedirects: false,
  });
  console.log(`📊 KOffice API login POST: status ${loginResult.status}, response length ${loginResult.text.length}`);
  console.log(`📊 KOffice API login POST headers: ${JSON.stringify(Object.keys(loginResult.headers))}`);

  // Accumulate cookies from POST response (PHPSESSID, laravel_session, etc.)
  for (const c of extractSetCookies(loginResult.headers)) {
    allCookies = mergeSetCookies(allCookies, c);
  }
  console.log(`🍪 POST cookies: ${allCookies.substring(0, 300)}`);

  // Follow redirects manually to accumulate cookies from each hop
  let location = loginResult.headers['location'] || '';
  let hops = 0;
  while (location && hops < 5) {
    hops++;
    const followUrl = location.startsWith('http') ? location : `${cleanBase}${location.startsWith('/') ? '' : '/'}${location}`;
    if (followUrl.includes('/login') && hops > 1) {
      throw new Error('Login KOffice API falhou - redirecionado de volta ao login.');
    }
    console.log(`🔄 KOffice API: seguindo redirect ${hops} → ${followUrl}`);
    const followResult = await relayProxyFetch(followUrl, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies },
      followRedirects: false,
    });
    for (const c of extractSetCookies(followResult.headers)) {
      allCookies = mergeSetCookies(allCookies, c);
    }
    console.log(`🍪 Redirect ${hops} cookies: ${allCookies.substring(0, 300)}`);
    location = followResult.headers['location'] || '';
  }

  // Check if login failed
  if (loginResult.status >= 400) {
    throw new Error('Login KOffice API falhou - verifique suas credenciais.');
  }

  // Step 3: GET /clients page to ensure session is active and get updated CSRF
  const clientsPageResult = await relayProxyFetch(`${cleanBase}/clients`, {
    method: 'GET',
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies },
    followRedirects: false,
  });
  for (const c of extractSetCookies(clientsPageResult.headers)) {
    allCookies = mergeSetCookies(allCookies, c);
  }
  console.log(`📊 KOffice API /clients page: status ${clientsPageResult.status}, length ${clientsPageResult.text.length}`);
  console.log(`🍪 Final cookies: ${allCookies.substring(0, 300)}`);

  // If redirected to login, session didn't stick
  if (clientsPageResult.headers['location']?.includes('/login') || 
      (clientsPageResult.text.includes('/login') && clientsPageResult.text.length < 2000)) {
    throw new Error('Sessão KOffice API não foi mantida após login. Cloudflare pode estar bloqueando.');
  }

  // If /clients returned a redirect (not to login), follow it
  if (clientsPageResult.headers['location']) {
    const loc = clientsPageResult.headers['location'];
    const followUrl = loc.startsWith('http') ? loc : `${cleanBase}${loc.startsWith('/') ? '' : '/'}${loc}`;
    const followResult = await relayProxyFetch(followUrl, {
      method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies },
    });
    for (const c of extractSetCookies(followResult.headers)) {
      allCookies = mergeSetCookies(allCookies, c);
    }
  }

  // Get updated CSRF from clients page
  const dashCsrf = clientsPageResult.text.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const finalCsrf = dashCsrf ? dashCsrf[1] : csrfToken;

  // Step 4: Fetch clients via DataTable API
  const dtBody = new URLSearchParams();
  dtBody.append('draw', '1');
  dtBody.append('start', '0');
  dtBody.append('length', '5000');
  dtBody.append('search[value]', '');
  dtBody.append('filter_value', '#');
  dtBody.append('reseller_id', '-1');
  for (let i = 0; i <= 11; i++) {
    dtBody.append(`columns[${i}][data]`, String(i));
    dtBody.append(`columns[${i}][name]`, '');
    dtBody.append(`columns[${i}][searchable]`, 'true');
    dtBody.append(`columns[${i}][orderable]`, 'true');
    dtBody.append(`columns[${i}][search][value]`, '');
    dtBody.append(`columns[${i}][search][regex]`, 'false');
  }
  dtBody.append('order[0][column]', '0');
  dtBody.append('order[0][dir]', 'desc');
  dtBody.append('search[regex]', 'false');

  const dtHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA, 'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': cleanBase, 'Referer': `${cleanBase}/clients/`,
    'Cookie': allCookies,
  };
  if (finalCsrf) dtHeaders['X-CSRF-TOKEN'] = finalCsrf;

  console.log(`🔍 KOffice API: buscando clientes via DataTable...`);
  const dtResult = await relayProxyFetch(`${cleanBase}/clients/api/?get_clients`, {
    method: 'POST', headers: dtHeaders, body: dtBody.toString(),
  });
  console.log(`📊 KOffice API DataTable: status ${dtResult.status}, snippet: ${dtResult.text.substring(0, 300)}`);

  let json: any;
  try { json = JSON.parse(dtResult.text); } catch {
    console.error(`❌ KOffice API: resposta não é JSON. Snippet: ${dtResult.text.substring(0, 500)}`);
    if (dtResult.text.includes('Just a moment') || dtResult.text.includes('Checking your browser')) {
      throw new Error('Cloudflare bloqueou a requisição. Verifique se o CF Solver está ativo no VPS.');
    }
    // Only treat as login failure if it's clearly a redirect to login page
    if (dtResult.status >= 300 || (dtResult.text.includes('<form') && dtResult.text.length < 5000)) {
      throw new Error('Sessão expirou ou login falhou. Tente novamente.');
    }
    throw new Error('Resposta inválida da API KOffice. Resposta: ' + dtResult.text.substring(0, 200));
  }

  if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error('Nenhum cliente encontrado no painel KOffice API.');
  }

  // Parse DataTable rows
  const clients: any[] = [];
  for (const row of json.data) {
    const usernameRaw = String(row[1] || '').replace(/<[^>]*>/g, '').trim();
    const passwordRaw = String(row[2] || '').replace(/<[^>]*>/g, '').trim();
    const expDateRaw = String(row[4] || row[3] || '').replace(/<[^>]*>/g, '').trim();
    const maxConns = parseInt(String(row[6] || '1').replace(/<[^>]*>/g, '').trim()) || 1;
    const nameRaw = String(row[7] || '').replace(/<[^>]*>/g, '').trim();
    const statusRaw = String(row[8] || '').replace(/<[^>]*>/g, '').trim();

    clients.push({
      name: nameRaw || '',
      username: usernameRaw,
      password: passwordRaw,
      mac: '',
      exp_date: expDateRaw,
      max_connections: maxConns,
      status: statusRaw.toLowerCase().includes('ativo') || statusRaw.toLowerCase().includes('activ') ? 'ACTIVE' : statusRaw,
    });
  }

  console.log(`✅ KOffice API: ${clients.length} clientes encontrados (total no painel: ${json.recordsFiltered || json.recordsTotal || '?'})`);
  return clients;
}

// ── KOffice V2 (Form Login + DataTable): list clients ──
async function listKofficeV2Clients(baseUrl: string, panelUser: string, panelPass: string): Promise<any[]> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  console.log(`🔑 KOffice V2: iniciando login em ${cleanBase}`);

  // Step 1: GET login page for CSRF + cookies
  const loginResp = await withTimeout(fetch(`${cleanBase}/login`, {
    method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  }), 10000);
  const loginHtml = await loginResp.text();
  let allCookies = mergeSetCookies('', loginResp.headers.get('set-cookie'));

  // Extract CSRF token
  const csrfMatch = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/) ||
    loginHtml.match(/name=["']csrf_token["']\s+value=["'](.*?)["']/) ||
    loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  // Detect form field names
  const inputMatches = [...loginHtml.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*/gi)];
  const formInputs = inputMatches.map(m => {
    const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
    const valueMatch = m[0].match(/value=["']([^"']*?)["']/i);
    return { name: m[1], type: typeMatch?.[1] || 'text', value: valueMatch?.[1] || '' };
  });

  const userField = formInputs.find(f => /user|email|login|uname/i.test(f.name) && f.type !== 'hidden');
  const passField = formInputs.find(f => /pass|pwd|senha/i.test(f.name));
  const userFieldName = userField?.name || 'username';
  const passFieldName = passField?.name || 'password';

  // Build form body
  const formBody = new URLSearchParams();
  for (const input of formInputs) {
    if (input.type === 'hidden' && input.value) formBody.append(input.name, input.value);
  }
  formBody.append(userFieldName, panelUser);
  formBody.append(passFieldName, panelPass);

  const formActionMatch = loginHtml.match(/<form[^>]*action=["']([^"']*?)["']/i);
  const formAction = formActionMatch?.[1] || '/login';
  let postUrl = formAction.startsWith('http') ? formAction : `${cleanBase}${formAction.startsWith('/') ? '' : '/'}${formAction}`;

  // Step 2: POST login
  const postHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml', 'Origin': cleanBase, 'Referer': `${cleanBase}/login`,
  };
  if (allCookies) postHeaders['Cookie'] = allCookies;
  const xsrfMatch = allCookies.match(/XSRF-TOKEN=([^;,\s]+)/);
  if (xsrfMatch) postHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);

  const postResp = await withTimeout(fetch(postUrl, {
    method: 'POST', headers: postHeaders, body: formBody.toString(), redirect: 'manual',
  }), 15000);

  let postSetCookieArr: string[] = [];
  try { postSetCookieArr = (postResp.headers as any).getSetCookie?.() || []; } catch {}
  const postSetCookie = postSetCookieArr.length > 0 ? postSetCookieArr.join(', ') : postResp.headers.get('set-cookie');
  allCookies = mergeSetCookies(allCookies, postSetCookie);
  await postResp.text(); // consume body

  // Follow redirects
  let location = postResp.headers.get('location') || '';
  let hops = 0;
  while (location && hops < 5) {
    hops++;
    const followUrl = location.startsWith('http') ? location : `${cleanBase}/${location.replace(/^\.\//, '')}`;
    if (followUrl.includes('/login')) throw new Error('Login KOffice V2 falhou - credenciais inválidas');
    const followResp = await withTimeout(fetch(followUrl, {
      method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies }, redirect: 'manual',
    }), 10000);
    allCookies = mergeSetCookies(allCookies, followResp.headers.get('set-cookie'));
    location = followResp.headers.get('location') || '';
    const dashHtml = await followResp.text();
    // Get updated CSRF from dashboard
    const dashCsrf = dashHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
    if (dashCsrf) { /* update csrf */ }
    if (!location) break;
  }

  console.log(`✅ KOffice V2: login OK, buscando clientes...`);

  // Step 3: Get CSRF from dashboard page
  const dashResp = await withTimeout(fetch(`${cleanBase}/clients`, {
    method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies },
  }), 10000);
  const dashHtml = await dashResp.text();
  allCookies = mergeSetCookies(allCookies, dashResp.headers.get('set-cookie'));
  const dashCsrf = dashHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const finalCsrf = dashCsrf ? dashCsrf[1] : csrfToken;

  // Step 4: Fetch clients via DataTable API
  const dtEndpoints = [
    `${cleanBase}/clients/api/?get_clients`,
    `${cleanBase}/clients/api?get_clients`,
    `${cleanBase}/dashboard/api/?get_almost_expired_clients`,
  ];

  for (const ep of dtEndpoints) {
    try {
      const dtBody = new URLSearchParams();
      dtBody.append('draw', '1');
      dtBody.append('start', '0');
      dtBody.append('length', '5000');
      dtBody.append('search[value]', '');

      console.log(`🔍 KOffice V2: tentando ${ep}`);
      const resp = await withTimeout(fetch(ep, {
        method: 'POST',
        headers: {
          'Cookie': allCookies, 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA,
          'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': finalCsrf, 'Referer': `${cleanBase}/clients`,
        },
        body: dtBody.toString(),
      }), 20000);

      const text = await resp.text();
      console.log(`📊 KOffice V2 ${ep}: status ${resp.status}, snippet: ${text.substring(0, 300)}`);
      let json: any = null;
      try { json = JSON.parse(text); } catch { continue; }

      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        const clients: any[] = [];
        for (const row of json.data) {
          // DataTable rows: [id, username_html, password, exp_date, max_connections, status, ...]
          const usernameRaw = String(row[1] || '').replace(/<[^>]*>/g, '').trim();
          const passwordRaw = String(row[2] || '').replace(/<[^>]*>/g, '').trim();
          const expDateRaw = String(row[3] || '').replace(/<[^>]*>/g, '').trim();
          const maxConns = parseInt(String(row[4] || '1').replace(/<[^>]*>/g, '').trim()) || 1;
          const statusRaw = String(row[5] || '').replace(/<[^>]*>/g, '').trim();

          clients.push({
            name: '', // KOffice V2 DataTable doesn't usually have a name column
            username: usernameRaw, password: passwordRaw, mac: '',
            exp_date: expDateRaw, max_connections: maxConns,
            status: statusRaw.toLowerCase().includes('activ') || statusRaw.toLowerCase().includes('ativo') ? 'ACTIVE' : statusRaw,
          });
        }
        console.log(`✅ KOffice V2: ${clients.length} clientes encontrados`);
        return clients;
      }
    } catch (e) { console.log(`⚠️ KOffice V2 ${ep}: ${(e as Error).message}`); }
  }

  throw new Error('Não foi possível listar clientes no KOffice V2. Verifique se o login está correto.');
}

// ── Playfast: list clients via web panel (API.php DataTable) ──
async function listPlayfastClients(token: string, secret: string, panelUrl?: string): Promise<any[]> {
  // The Playfast panel uses painelcliente.com with API.php?action=get_clients (DataTable)
  // We need to login to the web panel first, then fetch via DataTable
  const baseUrl = panelUrl ? panelUrl.replace(/\/$/, '') : 'https://painelcliente.com';
  console.log(`🔍 Playfast: iniciando login no painel web ${baseUrl}`);

  // Step 1: Try the REST API first (some panels support it)
  try {
    const profileResp = await withTimeout(fetch(`${PLAYFAST_API_BASE}/profile/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ secret }),
    }), 15000);
    const profileData = await profileResp.json();
    console.log(`📊 Playfast profile: ${JSON.stringify(profileData).substring(0, 200)}`);
  } catch (e) {
    console.log(`⚠️ Playfast profile check failed: ${(e as Error).message}`);
  }

  // Step 2: Login to web panel and fetch clients via API.php DataTable
  try {
    // GET login page
    const loginPageResp = await withTimeout(fetch(`${baseUrl}/login`, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'manual',
    }), 15000);
    const loginHtml = await loginPageResp.text();
    
    let setCookieArr: string[] = [];
    try { setCookieArr = (loginPageResp.headers as any).getSetCookie?.() || []; } catch {}
    let allCookies = mergeSetCookies('', setCookieArr.length > 0 ? setCookieArr.join(', ') : loginPageResp.headers.get('set-cookie'));
    
    // Extract CSRF
    const csrfMatch = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/) ||
      loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    console.log(`🔐 Playfast CSRF: ${csrfToken ? 'found' : 'not found'}`);

    // Detect form fields
    const inputMatches = [...loginHtml.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*/gi)];
    const formInputs = inputMatches.map(m => {
      const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
      const valueMatch = m[0].match(/value=["']([^"']*?)["']/i);
      return { name: m[1], type: typeMatch?.[1] || 'text', value: valueMatch?.[1] || '' };
    });
    const userField = formInputs.find(f => /user|email|login|uname/i.test(f.name) && f.type !== 'hidden');
    const passField = formInputs.find(f => /pass|pwd|senha/i.test(f.name));
    const userFieldName = userField?.name || 'username';
    const passFieldName = passField?.name || 'password';
    console.log(`📝 Playfast form fields: user=${userFieldName}, pass=${passFieldName}`);

    // Build form body
    const formBody = new URLSearchParams();
    for (const input of formInputs) {
      if (input.type === 'hidden' && input.value) formBody.append(input.name, input.value);
    }
    // Use token as username and secret as password for web panel login
    formBody.append(userFieldName, token);
    formBody.append(passFieldName, secret);

    // POST login
    const postHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml',
      'Origin': baseUrl, 'Referer': `${baseUrl}/login`,
    };
    if (allCookies) postHeaders['Cookie'] = allCookies;
    const xsrfMatch2 = allCookies.match(/XSRF-TOKEN=([^;,\s]+)/);
    if (xsrfMatch2) postHeaders['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch2[1]);

    console.log(`🔑 Playfast: POST login...`);
    const loginResp = await withTimeout(fetch(`${baseUrl}/login`, {
      method: 'POST', headers: postHeaders, body: formBody.toString(), redirect: 'manual',
    }), 15000);
    
    let postSetCookieArr: string[] = [];
    try { postSetCookieArr = (loginResp.headers as any).getSetCookie?.() || []; } catch {}
    const postSetCookie = postSetCookieArr.length > 0 ? postSetCookieArr.join(', ') : loginResp.headers.get('set-cookie');
    allCookies = mergeSetCookies(allCookies, postSetCookie);
    await loginResp.text();
    console.log(`📊 Playfast login: status ${loginResp.status}`);

    // Follow redirects
    let location = loginResp.headers.get('location') || '';
    let hops = 0;
    while (location && hops < 5) {
      hops++;
      const followUrl = location.startsWith('http') ? location : `${baseUrl}${location.startsWith('/') ? '' : '/'}${location}`;
      if (followUrl.includes('/login') && hops > 1) {
        console.log(`⚠️ Playfast: redirected back to login`);
        break;
      }
      const followResp = await withTimeout(fetch(followUrl, {
        method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies }, redirect: 'manual',
      }), 10000);
      let fSetCookieArr: string[] = [];
      try { fSetCookieArr = (followResp.headers as any).getSetCookie?.() || []; } catch {}
      allCookies = mergeSetCookies(allCookies, fSetCookieArr.length > 0 ? fSetCookieArr.join(', ') : followResp.headers.get('set-cookie'));
      location = followResp.headers.get('location') || '';
      await followResp.text();
    }

    // GET /clients page for CSRF and session verification
    const clientsResp = await withTimeout(fetch(`${baseUrl}/clients`, {
      method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': allCookies },
    }), 10000);
    const clientsHtml = await clientsResp.text();
    let cSetCookieArr: string[] = [];
    try { cSetCookieArr = (clientsResp.headers as any).getSetCookie?.() || []; } catch {}
    allCookies = mergeSetCookies(allCookies, cSetCookieArr.length > 0 ? cSetCookieArr.join(', ') : clientsResp.headers.get('set-cookie'));
    console.log(`📊 Playfast /clients: status ${clientsResp.status}, length ${clientsHtml.length}`);

    if (clientsHtml.includes('/login') && clientsHtml.length < 2000) {
      throw new Error('Login Playfast falhou - sessão não mantida');
    }

    const dashCsrf = clientsHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
    const finalCsrf = dashCsrf ? dashCsrf[1] : csrfToken;

    // Fetch via API.php?action=get_clients using GET with query params (as seen in F12)
    // The Playfast API uses named column data fields, not numeric indices
    const columnDefs = [
      { data: 'display_username' },
      { data: 'password' },
      { data: 'created_at' },
      { data: 'exp_date' },
      { data: 'max_connections' },
      { data: 'reseller_notes' },
      { data: 'status' },
      { data: 'action' },
    ];

    const dtParams = new URLSearchParams();
    dtParams.append('action', 'get_clients');
    dtParams.append('reseller', '');
    dtParams.append('draw', '1');
    dtParams.append('start', '0');
    dtParams.append('length', '5000');
    dtParams.append('search[value]', '');
    dtParams.append('search[regex]', 'false');
    dtParams.append('order[0][column]', '3');
    dtParams.append('order[0][dir]', 'desc');
    dtParams.append('_', String(Date.now()));
    for (let i = 0; i < columnDefs.length; i++) {
      dtParams.append(`columns[${i}][data]`, columnDefs[i].data);
      dtParams.append(`columns[${i}][name]`, '');
      dtParams.append(`columns[${i}][searchable]`, 'true');
      dtParams.append(`columns[${i}][orderable]`, 'true');
      dtParams.append(`columns[${i}][search][value]`, '');
      dtParams.append(`columns[${i}][search][regex]`, 'false');
    }

    const dtHeaders: Record<string, string> = {
      'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${baseUrl}/clients`,
      'Cookie': allCookies,
    };

    // Try API.php endpoints - GET method as seen in F12
    const apiEndpoints = [
      `${baseUrl}/API.php`,
      `${baseUrl}/api.php`,
    ];

    for (const ep of apiEndpoints) {
      try {
        const fullUrl = `${ep}?${dtParams.toString()}`;
        console.log(`🔍 Playfast DataTable GET: ${ep}?action=get_clients`);
        const dtResp = await withTimeout(fetch(fullUrl, {
          method: 'GET', headers: dtHeaders,
        }), 20000);
        const dtText = await dtResp.text();
        console.log(`📊 Playfast DT ${ep}: status ${dtResp.status}, snippet: ${dtText.substring(0, 300)}`);
        
        let json: any;
        try { json = JSON.parse(dtText); } catch { continue; }

        if (json.data && Array.isArray(json.data)) {
          const clients: any[] = [];
          for (const row of json.data) {
            // Response uses named fields matching column data names
            const loginRaw = String(row.display_username || row[0] || '').replace(/<[^>]*>/g, '').trim();
            const senhaRaw = String(row.password || row[1] || '').replace(/<[^>]*>/g, '').trim();
            const expRaw = String(row.exp_date || row[3] || '').replace(/<[^>]*>/g, '').trim();
            const connsRaw = String(row.max_connections || row[4] || '1').replace(/<[^>]*>/g, '').trim();
            const notesRaw = String(row.reseller_notes || row[5] || '').replace(/<[^>]*>/g, '').trim();
            const statusRaw = String(row.status || row[6] || '').replace(/<[^>]*>/g, '').trim();

            clients.push({
              name: notesRaw || '',
              username: loginRaw,
              password: senhaRaw,
              mac: '',
              exp_date: expRaw,
              max_connections: parseInt(connsRaw) || 1,
              status: statusRaw.toLowerCase().includes('activ') || statusRaw.toLowerCase().includes('ativo') || statusRaw.toLowerCase().includes('enabled') ? 'ACTIVE' : statusRaw,
            });
          }
          console.log(`✅ Playfast: ${clients.length} clientes encontrados via DataTable`);
          return clients;
        }
      } catch (e) {
        console.log(`⚠️ Playfast DT ${ep}: ${(e as Error).message}`);
      }
    }

    throw new Error('Playfast: login OK mas não foi possível buscar clientes via API.php');
  } catch (e) {
    console.log(`⚠️ Playfast web panel: ${(e as Error).message}`);
    throw new Error(`Falha ao importar clientes Playfast: ${(e as Error).message}`);
  }
}

// ── Sigma (SlimTV) API: list clients ──
async function listSigmaClients(baseUrl: string, username: string, password: string): Promise<any[]> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  console.log(`🔑 Sigma: login em ${cleanBase}/api/auth/login`);

  // Login
  const loginResp = await withTimeout(fetch(`${cleanBase}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': UA,
      'Origin': cleanBase,
      'Referer': `${cleanBase}/`,
    },
    body: JSON.stringify({
      username, password,
      captcha: 'not-a-robot', captchaChecked: true,
      twofactor_code: '', twofactor_recovery_code: '', twofactor_trusted_device_id: '',
    }),
  }), 15000);

  if (!loginResp.ok) throw new Error(`Sigma login falhou: ${loginResp.status}`);
  const loginData = await loginResp.json();
  const token = loginData.token;
  if (!token) throw new Error('Sigma: login OK mas token não retornado');
  console.log(`✅ Sigma: login OK`);

  // Fetch all customers (paginated)
  const allClients: any[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const resp = await withTimeout(fetch(`${cleanBase}/api/customers?page=${page}&perPage=100`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': UA,
        'Referer': `${cleanBase}/`,
      },
    }), 15000);

    if (!resp.ok) throw new Error(`Sigma: falha ao buscar clientes página ${page}: ${resp.status}`);
    const data = await resp.json();
    const customers = data.data || [];
    lastPage = data.meta?.last_page || 1;

    for (const c of customers) {
      allClients.push({
        name: c.name || '',
        username: c.username || '',
        password: c.password || '',
        mac: c.mac_address || '',
        exp_date: c.expires_at_tz || c.expires_at || '',
        max_connections: c.connections || 1,
        status: c.status === 'ACTIVE' ? 'ACTIVE' : c.status,
        whatsapp: c.whatsapp || '',
        email: c.email || '',
        package_id: c.package_id || '',
        server_id: c.server_id || '',
        package_name: c.package || '',
      });
    }

    console.log(`📦 Sigma: página ${page}/${lastPage}, ${customers.length} clientes`);
    page++;
  } while (page <= lastPage);

  console.log(`✅ Sigma: ${allClients.length} clientes importados`);
  return allClients;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { panelId } = await req.json();

    if (!panelId) {
      return new Response(JSON.stringify({ success: false, error: 'panelId é obrigatório' }), {
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

    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey);
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

    let panelUser = panel.usuario;
    let panelPass = panel.senha;
    if (panelUser === 'vault' || panelPass === 'vault') {
      const userToken = authHeader!.replace('Bearer ', '');
      const vaultClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
      });
      const [uRes, sRes] = await Promise.all([
        vaultClient.rpc('get_gateway_secret', { p_user_id: user.id, p_gateway: 'painel', p_secret_name: `usuario_${panel.id}` }),
        vaultClient.rpc('get_gateway_secret', { p_user_id: user.id, p_gateway: 'painel', p_secret_name: `senha_${panel.id}` }),
      ]);
      if (uRes.data) panelUser = uRes.data;
      if (sRes.data) panelPass = sRes.data;
    }

    let clients: any[] = [];
    const provedor = panel.provedor;
    console.log(`📦 Importando clientes do provedor: ${provedor}, painel: ${panel.nome}`);

    if (provedor === 'koffice-api') {
      clients = await listKofficeApiClients(panel.url, panelUser, panelPass);
    } else if (provedor === 'koffice-v2') {
      // Try Xtream API first, fallback to form login
      try {
        clients = await listKofficeApiClients(panel.url, panelUser, panelPass);
      } catch {
        console.log(`🔄 KOffice V2: Xtream API falhou, tentando via form login...`);
        clients = await listKofficeV2Clients(panel.url, panelUser, panelPass);
      }
    } else if (provedor === 'playfast') {
      clients = await listPlayfastClients(panelUser, panelPass, panel.url);
    } else if (provedor === 'sigma') {
      clients = await listSigmaClients(panel.url, panelUser, panelPass);
    } else {
      return new Response(JSON.stringify({ success: false, error: `Provedor "${provedor}" não suporta importação` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, clients, total: clients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Import server clients error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
