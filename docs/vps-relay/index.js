/**
 * VPS Relay Proxy - Com suporte a FlareSolverr + proxy residencial + 2Captcha
 * 
 * Instalar no VPS:
 *   1. npm init -y
 *   2. npm install express https-proxy-agent
 *   3. node index.js
 * 
 * Variáveis de ambiente:
 *   export RELAY_SECRET="sua_secret_aqui"
 *   export PROXY_URL="http://usuario:senha@proxy.iproyal.com:12321"
 *   export FLARESOLVERR_URL="http://localhost:8191/v1"
 *   export TWOCAPTCHA_API_KEY="sua_chave_2captcha"
 * 
 * Com PM2 (recomendado):
 *   npm install -g pm2
 *   pm2 start index.js --name relay
 *   pm2 save
 *   pm2 startup
 */

const express = require('express');
const { HttpsProxyAgent } = require('https-proxy-agent');
const app = express();

// Configurações
const RELAY_SECRET = process.env.RELAY_SECRET || 'MUDE_ESTA_SECRET_AQUI';
const PROXY_URL = process.env.PROXY_URL || '';
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY || '';
const PORT = process.env.PORT || 3456;

// Criar agente de proxy se configurado
let proxyAgent = null;
if (PROXY_URL) {
  proxyAgent = new HttpsProxyAgent(PROXY_URL);
  console.log(`🌐 Proxy residencial configurado: ${PROXY_URL.replace(/:[^:@]+@/, ':***@')}`);
}

app.use(express.json({ limit: '10mb' }));

// ==================== 2Captcha Helper ====================

async function solve2Captcha(imageBase64) {
  if (!TWOCAPTCHA_KEY) throw new Error('TWOCAPTCHA_API_KEY não configurada');

  console.log('[2CAP] Enviando captcha (' + imageBase64.length + ' chars)...');
  const createResp = await fetch('https://api.2captcha.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: TWOCAPTCHA_KEY,
      task: {
        type: 'ImageToTextTask',
        body: imageBase64,
        numeric: 1,
        minLength: 4,
        maxLength: 6,
      },
    }),
  });
  const createData = await createResp.json();
  if (createData.errorId !== 0) throw new Error('2Captcha erro: ' + (createData.errorDescription || createData.errorCode));
  
  const taskId = createData.taskId;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const resultResp = await fetch('https://api.2captcha.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: TWOCAPTCHA_KEY, taskId }),
    });
    const resultData = await resultResp.json();
    console.log('[2CAP] Poll ' + (i + 1) + ': status=' + resultData.status);
    if (resultData.status === 'ready') {
      const text = resultData.solution?.text;
      if (text) { console.log('[2CAP] ✅ Resolvido: ' + text); return text; }
      throw new Error('2Captcha resultado vazio');
    }
    if (resultData.errorId !== 0) throw new Error('2Captcha: ' + (resultData.errorDescription || resultData.errorCode));
  }
  throw new Error('2Captcha timeout (45s)');
}

// ==================== FlareSolverr Cache ====================
const cfCookieCache = new Map();
const CF_CACHE_TTL = 25 * 60 * 1000;

function getCachedCfCookies(domain) {
  const entry = cfCookieCache.get(domain);
  if (entry && Date.now() - entry.timestamp < CF_CACHE_TTL) {
    return entry;
  }
  cfCookieCache.delete(domain);
  return null;
}

// ==================== 2Captcha Endpoint ====================

/**
 * Resolve captcha via 2Captcha
 * POST /solve-captcha
 * Body: { image: "base64..." }
 * Response: { success, code, error? }
 */
app.post('/solve-captcha', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret !== RELAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image (base64) é obrigatória' });
  }

  try {
    const code = await solve2Captcha(image);
    return res.json({ success: true, code });
  } catch (error) {
    console.error('[2CAP] Error:', error.message);
    return res.json({ success: false, error: error.message });
  }
});

// ==================== FlareSolverr Endpoint ====================

app.post('/flaresolverr', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret !== RELAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, proxy, maxTimeout } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  const domain = new URL(url).hostname;
  
  const cached = getCachedCfCookies(domain);
  if (cached) {
    console.log(`[FLARE] Cache hit para ${domain} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return res.json({
      success: true,
      cached: true,
      cookies: cached.cookies,
      userAgent: cached.userAgent,
      cookieString: cached.cookieString,
    });
  }

  console.log(`[FLARE] Resolvendo Cloudflare para: ${url}`);

  try {
    const flarePayload = {
      cmd: 'request.get',
      url,
      maxTimeout: maxTimeout || 60000,
    };

    if (proxy || PROXY_URL) {
      const proxyUrl = proxy || PROXY_URL;
      try {
        const parsed = new URL(proxyUrl);
        flarePayload.proxy = {
          url: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
        };
        console.log(`[FLARE] Proxy: ${parsed.hostname}:${parsed.port} user=${parsed.username.substring(0,5)}...`);
      } catch {
        flarePayload.proxy = { url: proxyUrl };
      }
    }

    const flareResp = await fetch(FLARESOLVERR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flarePayload),
    });

    const flareData = await flareResp.json();

    console.log(`[FLARE] Status: ${flareData.status}, solution status: ${flareData.solution?.status}`);

    if (flareData.status === 'ok' && flareData.solution) {
      const cookies = flareData.solution.cookies || [];
      const userAgent = flareData.solution.userAgent || '';
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      const cacheEntry = { cookies, userAgent, cookieString, timestamp: Date.now() };
      cfCookieCache.set(domain, cacheEntry);

      console.log(`[FLARE] ✅ Cloudflare resolvido! ${cookies.length} cookies, UA: ${userAgent.substring(0, 50)}...`);

      return res.json({
        success: true,
        cached: false,
        cookies,
        userAgent,
        cookieString,
        responseStatus: flareData.solution.status,
      });
    }

    console.log(`[FLARE] ❌ Falhou: ${flareData.message || JSON.stringify(flareData).substring(0, 300)}`);
    return res.json({
      success: false,
      error: flareData.message || 'FlareSolverr não conseguiu resolver o desafio',
      raw: flareData,
    });

  } catch (error) {
    console.error(`[FLARE] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `FlareSolverr inacessível: ${error.message}`,
      hint: 'Verifique se o FlareSolverr está rodando: docker ps | grep flaresolverr',
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'vps-relay', 
    proxy_enabled: !!PROXY_URL,
    flaresolverr_url: FLARESOLVERR_URL,
    twocaptcha: !!TWOCAPTCHA_KEY,
    cf_cache_entries: cfCookieCache.size,
    timestamp: new Date().toISOString() 
  });
});

// Proxy endpoint
app.post('/proxy', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret !== RELAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, method, headers, body, followRedirects } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  console.log(`[RELAY] ${method || 'GET'} ${url} ${proxyAgent ? '(via proxy)' : '(direto)'}${followRedirects === false ? ' [no-redirect]' : ''}`);

  try {
    const domain = new URL(url).hostname;
    const cachedCf = getCachedCfCookies(domain);
    
    const fetchOptions = {
      method: method || 'GET',
      redirect: followRedirects === false ? 'manual' : 'follow',
      headers: {
        'User-Agent': cachedCf?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...headers,
      },
    };

    if (cachedCf?.cookieString) {
      const existingCookie = fetchOptions.headers['Cookie'] || fetchOptions.headers['cookie'] || '';
      fetchOptions.headers['Cookie'] = existingCookie 
        ? `${cachedCf.cookieString}; ${existingCookie}` 
        : cachedCf.cookieString;
      console.log(`[RELAY] 🍪 Injetando ${cachedCf.cookies.length} cookies CF do cache`);
    }

    if (proxyAgent) {
      fetchOptions.agent = proxyAgent;
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes((method || '').toUpperCase())) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseBody = await response.text();

    const isCloudflareBlock = response.status === 403 && (responseBody.includes('cf-error') || responseBody.includes('cf-challenge') || responseBody.includes('Just a moment'));
    if (isCloudflareBlock) {
      console.warn(`[RELAY] ⚠️ Cloudflare bloqueou! Tente chamar /flaresolverr primeiro.`);
      if (cachedCf) {
        cfCookieCache.delete(domain);
        console.log(`[RELAY] 🗑️ Cache CF invalidado para ${domain}`);
      }
    }

    console.log(`[RELAY] Response: status=${response.status}, size=${responseBody.length}${isCloudflareBlock ? ' [CLOUDFLARE BLOCK]' : ''}`);

    res.json({
      status: response.status,
      headers: responseHeaders,
      body: responseBody,
      cloudflare_blocked: isCloudflareBlock,
    });

  } catch (error) {
    console.error(`[RELAY] Error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      status: 500,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VPS Relay rodando na porta ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/proxy`);
  console.log(`   POST http://localhost:${PORT}/flaresolverr`);
  console.log(`   POST http://localhost:${PORT}/solve-captcha`);
  console.log(`🔑 Secret: ${RELAY_SECRET === 'MUDE_ESTA_SECRET_AQUI' ? '⚠️  PADRÃO (mude!)' : '✅ OK'}`);
  console.log(`🌐 Proxy: ${PROXY_URL ? '✅ Ativo' : '❌ Não configurado (use PROXY_URL)'}`);
  console.log(`🛡️ FlareSolverr: ${FLARESOLVERR_URL}`);
  console.log(`🤖 2Captcha: ${TWOCAPTCHA_KEY ? '✅ Configurado' : '❌ Não configurado (use TWOCAPTCHA_API_KEY)'}`);
});
