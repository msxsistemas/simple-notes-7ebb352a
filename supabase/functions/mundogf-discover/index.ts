// Edge function for MundoGF discovery

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

async function solve2Captcha(siteKey: string, pageUrl: string): Promise<string | null> {
  const apiKey = Deno.env.get('TWOCAPTCHA_API_KEY');
  if (!apiKey) return null;

  try {
    console.log(`🤖 2Captcha: Resolvendo reCAPTCHA v3...`);
    const submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&version=v3&action=login&min_score=0.3&json=1`;
    const submitResp = await withTimeout(fetch(submitUrl), 15000);
    const submitJson = await submitResp.json();
    if (submitJson.status !== 1) return null;

    const taskId = submitJson.request;
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resultUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`;
      const resultResp = await withTimeout(fetch(resultUrl), 10000);
      const resultJson = await resultResp.json();
      if (resultJson.status === 1) return resultJson.request;
      if (resultJson.request !== 'CAPCHA_NOT_READY') return null;
    }
    return null;
  } catch { return null; }
}

function mergeSetCookies(existing: string, setCookieHeader: string | null): string {
  if (!setCookieHeader) return existing;
  // Parse set-cookie can have multiple cookies separated by comma, but values can contain commas in expires
  // So we split by comma followed by a space and a cookie name pattern
  const parts = setCookieHeader.split(/,\s*(?=[A-Za-z_-]+=)/).map(c => c.split(';')[0].trim());
  const existingParts = existing ? existing.split('; ').filter(Boolean) : [];
  
  // Merge: newer cookies override older ones with same name
  const cookieMap = new Map<string, string>();
  for (const c of existingParts) {
    const name = c.split('=')[0];
    if (name) cookieMap.set(name, c);
  }
  for (const c of parts) {
    const name = c.split('=')[0];
    if (name) cookieMap.set(name, c);
  }
  return [...cookieMap.values()].join('; ');
}

async function loginMundoGF(baseUrl: string, username: string, password: string): Promise<{ success: boolean; cookies: string; error?: string }> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  
  // Step 1: GET login page
  const loginResp = await withTimeout(fetch(`${cleanBase}/login`, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
  }), 10000);
  const loginHtml = await loginResp.text();
  
  // Extract CSRF
  const csrfInput = loginHtml.match(/name=["']_token["']\s+value=["'](.*?)["']/);
  const csrfMeta = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
  const csrfToken = (csrfInput ? csrfInput[1] : null) || (csrfMeta ? csrfMeta[1] : null);
  
  // Extract reCAPTCHA site key
  const recaptchaMatch = loginHtml.match(/sitekey['":\s]+['"]([0-9A-Za-z_-]{20,})['"]/i)
    || loginHtml.match(/grecaptcha\.execute\(\s*['"]([0-9A-Za-z_-]{20,})['"]/i)
    || loginHtml.match(/recaptcha[\/\w]*api\.js\?.*render=([0-9A-Za-z_-]{20,})/i);
  const siteKey = recaptchaMatch ? recaptchaMatch[1] : null;

  // Solve reCAPTCHA
  let captchaToken = 'server-test-token';
  if (siteKey) {
    const solved = await solve2Captcha(siteKey, `${cleanBase}/login`);
    if (solved) captchaToken = solved;
    else console.log('⚠️ 2Captcha não resolveu, usando token dummy');
  }

  // Collect cookies from login page
  let allCookies = mergeSetCookies('', loginResp.headers.get('set-cookie'));
  console.log(`🍪 Cookies após GET /login: ${allCookies.slice(0, 200)}`);

  // Step 2: POST login
  const formBody = new URLSearchParams();
  if (csrfToken) formBody.append('_token', csrfToken);
  formBody.append('username', username);
  formBody.append('password', password);
  formBody.append('g-recaptcha-response', captchaToken);

  const postHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
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

  const postLocation = postResp.headers.get('location') || '';
  allCookies = mergeSetCookies(allCookies, postResp.headers.get('set-cookie'));
  await postResp.text(); // consume body
  
  console.log(`📊 POST /login → status: ${postResp.status}, location: ${postLocation}`);
  console.log(`🍪 Cookies após POST: ${allCookies.slice(0, 300)}`);

  const isSuccess = (postResp.status === 302 || postResp.status === 301) && postLocation && !postLocation.toLowerCase().includes('/login');
  
  if (!isSuccess) {
    return { success: false, cookies: '', error: `Login falhou (status: ${postResp.status}, location: ${postLocation})` };
  }

  // Step 3: Follow redirect to capture final session cookies
  console.log(`🔄 Seguindo redirect para: ${postLocation}`);
  const followUrl = postLocation.startsWith('http') ? postLocation : `${cleanBase}${postLocation}`;
  const followResp = await withTimeout(fetch(followUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Cookie': allCookies,
    },
    redirect: 'manual',
  }), 10000);
  allCookies = mergeSetCookies(allCookies, followResp.headers.get('set-cookie'));
  await followResp.text(); // consume body
  console.log(`🍪 Cookies finais: ${allCookies.slice(0, 300)}`);

  return { success: true, cookies: allCookies };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, username, password, action } = await req.json();

    if (!baseUrl || !username || !password) {
      return new Response(JSON.stringify({ success: false, error: "baseUrl, username e password são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const cleanBase = baseUrl.replace(/\/$/, '');

    // Step 1: Login
    console.log(`🔄 Autenticando no MundoGF: ${cleanBase}`);
    const login = await loginMundoGF(cleanBase, username, password);
    if (!login.success) {
      return new Response(JSON.stringify({ success: false, error: `Falha no login: ${login.error}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    console.log('✅ Login MundoGF bem-sucedido!');

    const sessionHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/html, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': login.cookies,
      'Referer': `${cleanBase}/`,
    };

    // Action: discover - Explore available endpoints
    if (action === 'discover') {
      console.log('🔍 Descobrindo endpoints do painel...');
      const discovered: Record<string, any> = {};

      // Common MundoGF/Laravel IPTV panel endpoints to probe
      const endpointsToProbe = [
        // Dashboard & stats
        { path: '/bonus/stats', label: 'Bonus Stats' },
        { path: '/ajax/getClientsStats2', label: 'Client Stats' },
        { path: '/dashboard', label: 'Dashboard' },
        // Client management
        { path: '/ajax/getClients', label: 'Get Clients (AJAX)' },
        { path: '/api/clients', label: 'API Clients' },
        { path: '/clients', label: 'Clients Page' },
        { path: '/users', label: 'Users Page' },
        { path: '/lines', label: 'Lines Page' },
        { path: '/mag', label: 'MAG Page' },
        { path: '/enigma', label: 'Enigma Page' },
        // Renewal/Credits
        { path: '/bonus', label: 'Bonus Page' },
        { path: '/credits', label: 'Credits Page' },
        { path: '/renew', label: 'Renew Page' },
        { path: '/ajax/renew', label: 'AJAX Renew' },
        { path: '/api/renew', label: 'API Renew' },
        // Line management
        { path: '/ajax/getLines', label: 'Get Lines (AJAX)' },
        { path: '/api/lines', label: 'API Lines' },
        { path: '/line/create', label: 'Create Line' },
        { path: '/line/renew', label: 'Renew Line' },
        // Bouquets/Packages
        { path: '/ajax/getBouquets', label: 'Get Bouquets' },
        { path: '/bouquets', label: 'Bouquets' },
        { path: '/packages', label: 'Packages' },
      ];

      for (const ep of endpointsToProbe) {
        try {
          const resp = await withTimeout(fetch(`${cleanBase}${ep.path}`, {
            method: 'GET',
            headers: sessionHeaders,
          }), 8000);
          const text = await resp.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}

          const isJson = json !== null;
          const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
          const isRedirectToLogin = resp.status === 302 || (isHtml && text.includes('/login'));
          
          if (!isRedirectToLogin && resp.status !== 404) {
            discovered[ep.path] = {
              label: ep.label,
              status: resp.status,
              type: isJson ? 'json' : (isHtml ? 'html' : 'other'),
              snippet: text.slice(0, 500),
              json: isJson ? json : undefined,
            };
            console.log(`✅ ${ep.path} → ${resp.status} (${isJson ? 'JSON' : isHtml ? 'HTML' : 'other'})`);
          } else {
            console.log(`❌ ${ep.path} → ${resp.status} (redirect/404)`);
          }
        } catch (e) {
          console.log(`⚠️ ${ep.path} → error: ${(e as Error).message}`);
        }
      }

      // Also try to discover from dashboard HTML (find JS routes, API calls etc)
      try {
        const dashResp = await withTimeout(fetch(`${cleanBase}/`, {
          method: 'GET',
          headers: { ...sessionHeaders, 'Accept': 'text/html' },
        }), 10000);
        const dashHtml = await dashResp.text();
        
        // Extract all URLs/paths from the dashboard
        const allPaths = dashHtml.match(/["'](\/[a-zA-Z0-9_\/-]+)["']/g)?.map(m => m.replace(/["']/g, '')) || [];
        const uniquePaths = [...new Set(allPaths)].filter(p => 
          !p.includes('.css') && !p.includes('.js') && !p.includes('.png') && !p.includes('.ico')
          && p.length > 1 && p.length < 50
        );
        
        // Extract sidebar/nav links
        const navLinks = dashHtml.match(/href=["'](\/[^"']+)["']/g)?.map(m => m.replace(/href=["']/g, '').replace(/["']/g, '')) || [];
        const uniqueNavLinks = [...new Set(navLinks)].filter(p => 
          !p.includes('.css') && !p.includes('.js') && p.length > 1
        );

        discovered['_dashboard_analysis'] = {
          label: 'Dashboard Analysis',
          allPaths: uniquePaths.slice(0, 50),
          navLinks: uniqueNavLinks.slice(0, 30),
          htmlSnippet: dashHtml.slice(0, 2000),
        };
      } catch {}

      return new Response(JSON.stringify({ success: true, action: 'discover', discovered }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Action: deep_discover - POST to endpoints and scrape client page for forms/actions
    if (action === 'deep_discover' || action === 'list_clients') {
      console.log('🔍 Deep discovery: buscando endpoints via POST e scraping...');
      const results: Record<string, any> = {};

      // 1. POST to /ajax/getClients with DataTables-style params
      try {
        console.log('📋 POST /ajax/getClients...');
        const csrfResp = await withTimeout(fetch(`${cleanBase}/clients`, {
          method: 'GET',
          headers: { ...sessionHeaders, 'Accept': 'text/html' },
        }), 10000);
        const clientsHtml = await csrfResp.text();
        const csrfMatch = clientsHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/);
        const csrf = csrfMatch ? csrfMatch[1] : '';

        // Extract all routes/ajax endpoints from the clients page JS
        const ajaxUrls = clientsHtml.match(/(?:url|ajax)\s*[:=]\s*["']([^"']+)["']/gi) || [];
        const formActions = clientsHtml.match(/action=["']([^"']+)["']/gi) || [];
        const dataUrls = clientsHtml.match(/["'](\/(?:ajax|api)[^"']+)["']/g) || [];
        const allJsEndpoints = clientsHtml.match(/["'](\/[a-zA-Z0-9_\/-]+)["']/g)?.map(m => m.replace(/["']/g, '')) || [];
        
        // Find renew/extend/credit-related endpoints
        const renewPatterns = clientsHtml.match(/(?:renew|renovar|extend|estender|credits?|creditos?|bonus|reactivate|reativar)[^<]*(?:<|'|"|`)/gi) || [];
        
        results['_clients_page_analysis'] = {
          ajaxUrls: [...new Set(ajaxUrls)].slice(0, 20),
          formActions: [...new Set(formActions)].slice(0, 20),
          dataUrls: [...new Set(dataUrls)].slice(0, 20),
          renewPatterns: [...new Set(renewPatterns)].slice(0, 20),
          jsEndpoints: [...new Set(allJsEndpoints)].filter(p => !p.includes('.css') && !p.includes('.js') && !p.includes('.png')).slice(0, 50),
          htmlSize: clientsHtml.length,
        };
        console.log(`📄 Clients page: ${clientsHtml.length} chars, ${ajaxUrls.length} ajax URLs, ${renewPatterns.length} renew patterns`);

        // Try POST /ajax/getClients with DataTables params
        const dtBody = new URLSearchParams();
        dtBody.append('draw', '1');
        dtBody.append('start', '0');
        dtBody.append('length', '10');
        dtBody.append('search[value]', '');

        const getClientsResp = await withTimeout(fetch(`${cleanBase}/ajax/getClients`, {
          method: 'POST',
          headers: {
            ...sessionHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-TOKEN': csrf,
          },
          body: dtBody.toString(),
        }), 10000);
        const gcText = await getClientsResp.text();
        let gcJson: any = null;
        try { gcJson = JSON.parse(gcText); } catch {}
        results['/ajax/getClients (POST)'] = {
          status: getClientsResp.status,
          type: gcJson ? 'json' : 'other',
          snippet: gcText.slice(0, 1000),
          json: gcJson ? { recordsTotal: gcJson.recordsTotal, recordsFiltered: gcJson.recordsFiltered, sampleData: gcJson.data?.slice(0, 2) } : undefined,
        };
        console.log(`📊 POST /ajax/getClients → ${getClientsResp.status}, records: ${gcJson?.recordsTotal}`);
      } catch (e) {
        console.log(`⚠️ Error in deep_discover: ${(e as Error).message}`);
        results['error'] = (e as Error).message;
      }

      // 2. Try more specific renewal/action endpoints via POST
      const postEndpoints = [
        { path: '/ajax/renewClient', label: 'Renew Client' },
        { path: '/ajax/extendClient', label: 'Extend Client' },
        { path: '/ajax/renewUser', label: 'Renew User' },
        { path: '/ajax/extendUser', label: 'Extend User' },
        { path: '/client/renew', label: 'Client Renew' },
        { path: '/client/extend', label: 'Client Extend' },
        { path: '/ajax/editClient', label: 'Edit Client' },
        { path: '/ajax/updateClient', label: 'Update Client' },
        { path: '/ajax/getClient', label: 'Get Single Client' },
        { path: '/ajax/clientAction', label: 'Client Action' },
        { path: '/bonus/use', label: 'Use Bonus' },
        { path: '/bonus/buy', label: 'Buy Bonus' },
        { path: '/ajax/renewLine', label: 'Renew Line' },
        { path: '/ajax/extendLine', label: 'Extend Line' },
      ];

      for (const ep of postEndpoints) {
        try {
          const resp = await withTimeout(fetch(`${cleanBase}${ep.path}`, {
            method: 'POST',
            headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }), 5000);
          const text = await resp.text();
          if (resp.status !== 404 && resp.status !== 302) {
            let json: any = null;
            try { json = JSON.parse(text); } catch {}
            results[ep.path] = { label: ep.label, status: resp.status, snippet: text.slice(0, 300), json };
            console.log(`✅ POST ${ep.path} → ${resp.status}`);
          } else {
            console.log(`❌ POST ${ep.path} → ${resp.status}`);
          }
        } catch (e) {
          console.log(`❌ POST ${ep.path} → error`);
        }
      }

      // 3. Scrape /clients page for full JS (look for inline scripts)
      try {
        const clientsResp2 = await withTimeout(fetch(`${cleanBase}/clients`, {
          method: 'GET',
          headers: { ...sessionHeaders, 'Accept': 'text/html' },
        }), 10000);
        const html2 = await clientsResp2.text();
        // Extract all <script> blocks
        const scripts = html2.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        const inlineScripts = scripts.filter(s => !s.includes('src=')).join('\n');
        // Find all AJAX/fetch calls in inline scripts
        const ajaxCalls = inlineScripts.match(/(?:\.ajax|fetch|axios\.\w+)\s*\(\s*(?:{[^}]*url\s*:\s*)?["']([^"']+)["']/g) || [];
        const postCalls = inlineScripts.match(/type\s*:\s*["']POST["'][^}]*url\s*:\s*["']([^"']+)["']/g) || [];
        
        results['_inline_scripts_analysis'] = {
          totalScripts: scripts.length,
          inlineScriptsLength: inlineScripts.length,
          ajaxCalls: [...new Set(ajaxCalls)].slice(0, 30),
          postCalls: [...new Set(postCalls)].slice(0, 20),
          inlineScriptSnippet: inlineScripts.slice(0, 3000),
        };
      } catch {}

      return new Response(JSON.stringify({ success: true, action: action, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Action inválida. Use: discover, deep_discover, list_clients' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });

  } catch (error) {
    console.error(`❌ Erro: ${(error as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
