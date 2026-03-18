const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.CF_SOLVER_PORT || 8191;
const RELAY_SECRET = process.env.RELAY_SECRET || 'MUDE_ESTA_SECRET_AQUI';
const PROXY_URL = process.env.PROXY_URL || '';
const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY || '';
app.use(express.json({ limit: '10mb' }));

// ==================== Browser Pool ====================
const browserSessions = new Map(); // domain -> { browser, page, userAgent, ts }
const SESSION_TTL = 20 * 60 * 1000; // 20 min

// UniTV login sessions: panelId -> { browser, page, state, token, ... }
const unitvSessions = new Map();
const UNITV_SESSION_TTL = 10 * 60 * 1000; // 10 min

async function getOrCreateSession(domain, url) {
  let session = browserSessions.get(domain);
  if (session && Date.now() - session.ts < SESSION_TTL) {
    try {
      await session.page.evaluate(() => true);
      console.log('[CF] Reutilizando sessão para ' + domain);
      return session;
    } catch {
      console.log('[CF] Sessão expirada, criando nova');
      try { await session.browser.close(); } catch {}
      browserSessions.delete(domain);
    }
  }

  console.log('[CF] Criando nova sessão para ' + domain);
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled', '--window-size=1920,1080'];
  let proxyUser = '', proxyPass = '';
  if (PROXY_URL) {
    try {
      const p = new URL(PROXY_URL);
      args.push('--proxy-server=http://' + p.hostname + ':' + p.port);
      proxyUser = decodeURIComponent(p.username);
      proxyPass = decodeURIComponent(p.password);
      console.log('[CF] Proxy: ' + p.hostname + ':' + p.port + ' (user: ' + proxyUser + ')');
    } catch (e) {
      console.log('[CF] Erro ao parsear PROXY_URL: ' + e.message);
    }
  }

  const browser = await puppeteer.launch({ headless: 'new', args });
  const page = await browser.newPage();
  if (proxyUser) await page.authenticate({ username: proxyUser, password: proxyPass });
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('[CF] Navegando para ' + url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const start = Date.now();
  let solved = false;
  while (Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 3000));
    const title = await page.title();
    const body = await page.evaluate(() => (document.body?.innerText || '').substring(0, 300));
    console.log('[CF] title="' + title + '"');
    if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('attention') &&
        !title.toLowerCase().includes('checking') && !body.includes('Verify you are human') && title !== '') {
      solved = true;
      break;
    }
  }

  if (!solved) {
    await browser.close();
    throw new Error('Cloudflare não resolvido em 60s');
  }

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const cookies = await page.cookies();
  console.log('[CF] ✅ Sessão criada! ' + cookies.length + ' cookies');

  session = { browser, page, userAgent, cookies, ts: Date.now() };
  browserSessions.set(domain, session);
  return session;
}

// ==================== 2Captcha Helper ====================

async function solve2Captcha(imageBase64) {
  if (!TWOCAPTCHA_KEY) throw new Error('TWOCAPTCHA_API_KEY não configurada no VPS');

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

// ==================== Existing Endpoints ====================

app.get('/', (req, res) => res.json({ 
  status: 'ok', service: 'cf-solver', 
  sessions: browserSessions.size,
  unitvSessions: unitvSessions.size,
  twocaptcha: !!TWOCAPTCHA_KEY,
}));

app.post('/v1', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ status: 'error', message: 'URL obrigatória' });
  try {
    const domain = new URL(url).hostname;
    const session = await getOrCreateSession(domain, url);
    const cookies = await session.page.cookies();
    const cookieData = cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));
    return res.json({ status: 'ok', solution: { url, status: 200, cookies: cookieData, userAgent: session.userAgent } });
  } catch (err) {
    console.error('[CF] ' + err.message);
    return res.json({ status: 'error', message: err.message });
  }
});

app.post('/request', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret && secret !== RELAY_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { url, method, headers, body, baseUrl } = req.body;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  const targetDomain = new URL(baseUrl || url).hostname;
  console.log('[REQ] ' + (method || 'GET') + ' ' + url);

  try {
    const session = await getOrCreateSession(targetDomain, baseUrl || url);
    const result = await session.page.evaluate(async (fetchUrl, fetchMethod, fetchHeaders, fetchBody) => {
      try {
        const opts = { method: fetchMethod || 'GET', headers: fetchHeaders || {}, credentials: 'include' };
        if (fetchBody && ['POST', 'PUT', 'PATCH'].includes((fetchMethod || '').toUpperCase())) opts.body = fetchBody;
        const resp = await fetch(fetchUrl, opts);
        const text = await resp.text();
        const respHeaders = {};
        resp.headers.forEach((v, k) => { respHeaders[k] = v; });
        return { status: resp.status, body: text, headers: respHeaders, error: null };
      } catch (e) { return { status: 0, body: '', headers: {}, error: e.message }; }
    }, url, method || 'GET', headers || {}, body || null);

    if (result.error) {
      console.log('[REQ] Fetch error: ' + result.error);
      return res.json({ status: 500, body: '', headers: {}, error: result.error });
    }
    console.log('[REQ] status=' + result.status + ' size=' + result.body.length);
    return res.json({ status: result.status, body: result.body, headers: result.headers });
  } catch (err) {
    console.error('[REQ] ' + err.message);
    return res.status(500).json({ error: err.message, status: 500 });
  }
});

// ==================== UniTV Browser Agent ====================
/**
 * POST /unitv-login
 * Body: { panelUrl, username, password }
 * 
 * Abre o painel UniTV no Puppeteer, resolve captcha via 2Captcha, faz login.
 * Se precisar de 2FA, retorna { needsVerification: true, sessionId } para que
 * o frontend chame /unitv-action com { sessionId, action: 'submit_code', code: '...' }
 */
app.post('/unitv-login', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret !== RELAY_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { panelUrl, username, password, sessionId: existingSessionId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });

  const baseUrl = (panelUrl || 'https://panel.web.starhome.vip').replace(/\/$/, '');
  const sid = existingSessionId || 'unitv_' + Date.now();

  console.log('[UNITV] 🚀 Iniciando login para ' + username.substring(0, 3) + '*** em ' + baseUrl);

  let browser, page;
  try {
    // Launch browser
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled', '--window-size=1920,1080'];
    let proxyUser = '', proxyPass = '';
    if (PROXY_URL) {
      try {
        const p = new URL(PROXY_URL);
        args.push('--proxy-server=http://' + p.hostname + ':' + p.port);
        proxyUser = decodeURIComponent(p.username);
        proxyPass = decodeURIComponent(p.password);
      } catch {}
    }

    browser = await puppeteer.launch({ headless: 'new', args });
    page = await browser.newPage();
    if (proxyUser) await page.authenticate({ username: proxyUser, password: proxyPass });
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to login page
    console.log('[UNITV] Navegando para ' + baseUrl);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for Cloudflare to resolve
    const cfStart = Date.now();
    while (Date.now() - cfStart < 60000) {
      const title = await page.title();
      if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('checking') && title !== '') break;
      await new Promise(r => setTimeout(r, 3000));
    }

    // Take screenshot to debug
    const screenshotBefore = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
    console.log('[UNITV] 📸 Screenshot antes do login (' + screenshotBefore.length + ' chars)');

    // Wait for login form to appear
    await page.waitForSelector('input', { timeout: 15000 });

    // Find and fill the username/password fields
    const inputsFilled = await page.evaluate((user, pass) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const results = { foundUser: false, foundPass: false, foundCaptcha: false, captchaType: null };
      
      for (const input of inputs) {
        const type = (input.type || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        
        // Username field
        if (!results.foundUser && (
          type === 'text' || 
          name.includes('user') || name.includes('login') || name.includes('account') ||
          placeholder.includes('user') || placeholder.includes('账号') || placeholder.includes('用户')
        )) {
          input.value = user;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          results.foundUser = true;
          continue;
        }
        
        // Password field
        if (!results.foundPass && type === 'password') {
          input.value = pass;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          results.foundPass = true;
          continue;
        }
        
        // Captcha field (usually the 3rd input)
        if (results.foundUser && results.foundPass && !results.foundCaptcha) {
          results.foundCaptcha = true;
          results.captchaType = 'input';
          // Mark this input for later
          input.setAttribute('data-captcha-input', 'true');
        }
      }
      
      return results;
    }, username, password);

    console.log('[UNITV] Inputs: user=' + inputsFilled.foundUser + ' pass=' + inputsFilled.foundPass + ' captcha=' + inputsFilled.foundCaptcha);

    if (!inputsFilled.foundUser || !inputsFilled.foundPass) {
      // Try with React-controlled inputs (set via nativeInputValueSetter)
      const reactFilled = await page.evaluate((user, pass) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        let filledUser = false, filledPass = false;
        
        for (const input of inputs) {
          const type = (input.type || '').toLowerCase();
          if (!filledUser && type !== 'password' && type !== 'hidden') {
            nativeInputValueSetter.call(input, user);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            filledUser = true;
          } else if (!filledPass && type === 'password') {
            nativeInputValueSetter.call(input, pass);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            filledPass = true;
          }
        }
        return { filledUser, filledPass };
      }, username, password);
      console.log('[UNITV] React fill: user=' + reactFilled.filledUser + ' pass=' + reactFilled.filledPass);
    }

    // Find and solve captcha
    let captchaSolved = false;
    
    // Look for captcha image (canvas or img)
    const captchaBase64 = await page.evaluate(() => {
      // Try canvas first (common in ResellerSystem)
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        if (canvas.width > 30 && canvas.width < 300 && canvas.height > 15 && canvas.height < 100) {
          try { return canvas.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, ''); } catch {}
        }
      }
      
      // Try img elements near the captcha input
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || '';
        const cls = (img.className || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        // Captcha images are usually small
        if ((src.includes('captcha') || src.includes('validate') || src.includes('code') || 
             cls.includes('captcha') || cls.includes('code') || alt.includes('captcha') ||
             (img.width > 50 && img.width < 250 && img.height > 20 && img.height < 80)) &&
            src.startsWith('data:image')) {
          return src.replace(/^data:image\/[^;]+;base64,/, '');
        }
      }
      
      // Try taking a screenshot of the captcha area
      const captchaContainers = document.querySelectorAll('[class*="captcha"], [class*="code"], [class*="validate"], [id*="captcha"], [id*="code"]');
      return null;
    });

    if (captchaBase64 && captchaBase64.length > 100) {
      console.log('[UNITV] 🖼️ Captcha encontrado no DOM (' + captchaBase64.length + ' chars)');
      try {
        const solvedCode = await solve2Captcha(captchaBase64);
        captchaSolved = true;
        
        // Fill captcha input
        await page.evaluate((code) => {
          const captchaInput = document.querySelector('[data-captcha-input="true"]');
          if (captchaInput) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(captchaInput, code);
            captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          // Fallback: find any remaining empty input
          const inputs = document.querySelectorAll('input');
          for (const inp of inputs) {
            if (inp.type !== 'password' && inp.type !== 'hidden' && !inp.value) {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeSetter.call(inp, code);
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
          }
          return false;
        }, solvedCode);
        console.log('[UNITV] ✅ Captcha preenchido: ' + solvedCode);
      } catch (e) {
        console.log('[UNITV] ⚠️ 2Captcha falhou: ' + e.message);
      }
    } else {
      // Try to screenshot the captcha element specifically
      console.log('[UNITV] Captcha não encontrado no DOM, tentando screenshot de elementos...');
      
      const captchaElement = await page.$('[class*="captcha"], [class*="code-img"], [class*="validate"], canvas');
      if (captchaElement) {
        const captchaScreenshot = await captchaElement.screenshot({ encoding: 'base64', type: 'png' });
        console.log('[UNITV] 📸 Screenshot do captcha (' + captchaScreenshot.length + ' chars)');
        try {
          const solvedCode = await solve2Captcha(captchaScreenshot);
          captchaSolved = true;
          
          await page.evaluate((code) => {
            const inputs = document.querySelectorAll('input');
            for (const inp of inputs) {
              if (inp.type !== 'password' && inp.type !== 'hidden' && !inp.value) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(inp, code);
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
            }
            return false;
          }, solvedCode);
          console.log('[UNITV] ✅ Captcha preenchido via screenshot: ' + solvedCode);
        } catch (e) {
          console.log('[UNITV] ⚠️ 2Captcha screenshot falhou: ' + e.message);
        }
      }
    }

    // Take screenshot after filling
    const screenshotFilled = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });

    // Click login button
    const loginClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [type="submit"], [class*="login"], [class*="submit"], a[class*="btn"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('login') || text.includes('登录') || text.includes('entrar') || text.includes('sign in') || text.includes('submit')) {
          btn.click();
          return { clicked: true, text: btn.textContent.trim() };
        }
      }
      // Fallback: click first button
      if (buttons.length > 0) {
        buttons[0].click();
        return { clicked: true, text: buttons[0].textContent.trim(), fallback: true };
      }
      return { clicked: false };
    });
    console.log('[UNITV] Login button: ' + JSON.stringify(loginClicked));

    // Wait for response
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot after login attempt
    const screenshotAfter = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
    
    // Check result - look for error messages, 2FA prompts, or success indicators
    const pageState = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const url = window.location.href;
      const title = document.title;
      
      // Check for common error indicators
      const errors = [];
      const errorEls = document.querySelectorAll('[class*="error"], [class*="alert"], [class*="message"], [class*="toast"], [class*="notify"]');
      for (const el of errorEls) {
        if (el.textContent.trim()) errors.push(el.textContent.trim().substring(0, 200));
      }
      
      // Check for 2FA/verification prompts
      const has2FA = body.includes('验证码') || body.includes('verify') || body.includes('verification') || 
                     body.includes('code') || body.includes('verificação') || body.includes('e-mail');
      
      // Check if we're on dashboard (login success)
      const isLoggedIn = url.includes('dashboard') || url.includes('home') || url.includes('dealer') || 
                         url.includes('index') || body.includes('logout') || body.includes('退出');
      
      return { url, title, bodyPreview: body.substring(0, 500), errors, has2FA, isLoggedIn };
    });

    console.log('[UNITV] Page state: ' + JSON.stringify({ url: pageState.url, title: pageState.title, isLoggedIn: pageState.isLoggedIn, has2FA: pageState.has2FA }));

    if (pageState.isLoggedIn) {
      // Success! Store session for later use (renewals)
      unitvSessions.set(sid, { browser, page, ts: Date.now(), state: 'logged_in' });
      console.log('[UNITV] ✅ Login bem-sucedido!');
      
      return res.json({
        success: true,
        sessionId: sid,
        message: 'Login realizado com sucesso via browser agent!',
        needsVerification: false,
        screenshotAfter,
        pageUrl: pageState.url,
      });
    }

    if (pageState.has2FA) {
      // Store session, wait for user to provide 2FA code
      unitvSessions.set(sid, { browser, page, ts: Date.now(), state: 'waiting_2fa' });
      console.log('[UNITV] 🔐 2FA necessário');
      
      return res.json({
        success: true,
        sessionId: sid,
        needsVerification: true,
        message: 'Login aceito, mas precisa do código de verificação.',
        screenshotAfter,
        pageState: pageState.bodyPreview.substring(0, 300),
      });
    }

    // Possible failure - maybe wrong captcha, wrong credentials
    // Don't close browser yet, return screenshot for debugging
    unitvSessions.set(sid, { browser, page, ts: Date.now(), state: 'unknown' });
    
    return res.json({
      success: false,
      sessionId: sid,
      error: pageState.errors.length > 0 ? pageState.errors.join('; ') : 'Login pode ter falhado. Verifique o screenshot.',
      captchaSolved,
      screenshotBefore,
      screenshotFilled,
      screenshotAfter,
      pageState: { url: pageState.url, title: pageState.title, body: pageState.bodyPreview.substring(0, 300) },
    });

  } catch (err) {
    console.error('[UNITV] ❌ ' + err.message);
    if (browser) try { await browser.close(); } catch {}
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /unitv-action
 * Body: { sessionId, action, code?, ... }
 * 
 * Actions:
 * - submit_code: Submete código 2FA na sessão aberta
 * - send_code: Clica em "enviar código" na tela de verificação
 * - screenshot: Retorna screenshot atual da sessão
 * - renew: Faz a renovação de um cliente (requer sessão logada)
 * - close: Fecha a sessão do browser
 */
app.post('/unitv-action', async (req, res) => {
  const secret = req.headers['x-relay-secret'];
  if (secret !== RELAY_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, action, code, clientData } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId obrigatório' });

  const session = unitvSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada ou expirada. Faça login novamente.' });

  // Check session still alive
  try { await session.page.evaluate(() => true); } catch {
    unitvSessions.delete(sessionId);
    try { await session.browser.close(); } catch {}
    return res.status(410).json({ error: 'Sessão do browser fechou. Faça login novamente.' });
  }

  console.log('[UNITV] Action: ' + action + ' session=' + sessionId);

  try {
    // ============ SCREENSHOT ============
    if (action === 'screenshot') {
      const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
      const url = await session.page.url();
      return res.json({ success: true, screenshot, url });
    }

    // ============ SEND_CODE ============
    if (action === 'send_code') {
      // Click "send code" button on the 2FA page
      const sendResult = await session.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, [class*="btn"], [class*="send"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('send') || text.includes('enviar') || text.includes('发送') || text.includes('获取')) {
            btn.click();
            return { clicked: true, text: btn.textContent.trim() };
          }
        }
        return { clicked: false };
      });

      await new Promise(r => setTimeout(r, 3000));
      const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
      
      return res.json({
        success: sendResult.clicked,
        message: sendResult.clicked ? 'Código de verificação enviado!' : 'Botão de enviar não encontrado',
        sendResult,
        screenshot,
      });
    }

    // ============ SUBMIT_CODE ============
    if (action === 'submit_code') {
      if (!code) return res.status(400).json({ error: 'code é obrigatório' });

      // Find verification code input and fill it
      await session.page.evaluate((verifyCode) => {
        const inputs = document.querySelectorAll('input');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        
        for (const inp of inputs) {
          const type = (inp.type || '').toLowerCase();
          const name = (inp.name || '').toLowerCase();
          const placeholder = (inp.placeholder || '').toLowerCase();
          
          if (type !== 'hidden' && (
            name.includes('code') || name.includes('verify') || name.includes('验证') ||
            placeholder.includes('code') || placeholder.includes('验证') || placeholder.includes('código') ||
            (!inp.value && type === 'text') // Empty text input on 2FA page
          )) {
            nativeSetter.call(inp, verifyCode);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }, code);

      await new Promise(r => setTimeout(r, 1000));

      // Click confirm/submit button
      await session.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [type="submit"], [class*="confirm"], [class*="submit"], [class*="verify"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('confirm') || text.includes('verificar') || text.includes('确认') || 
              text.includes('submit') || text.includes('enviar') || text.includes('bind') || text.includes('vincular')) {
            btn.click();
            return;
          }
        }
        // Fallback
        if (buttons.length > 0) buttons[buttons.length - 1].click();
      });

      await new Promise(r => setTimeout(r, 5000));
      const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });

      // Check if we're now logged in
      const pageState = await session.page.evaluate(() => {
        const url = window.location.href;
        const body = document.body?.innerText || '';
        const isLoggedIn = url.includes('dashboard') || url.includes('home') || url.includes('dealer') ||
                           body.includes('logout') || body.includes('退出');
        const errors = [];
        const errorEls = document.querySelectorAll('[class*="error"], [class*="alert"]');
        for (const el of errorEls) {
          if (el.textContent.trim()) errors.push(el.textContent.trim().substring(0, 200));
        }
        return { url, isLoggedIn, errors, bodyPreview: body.substring(0, 300) };
      });

      if (pageState.isLoggedIn) {
        session.state = 'logged_in';
        return res.json({ success: true, message: 'Verificação concluída! Logado com sucesso.', screenshot, pageUrl: pageState.url });
      }

      return res.json({
        success: false,
        error: pageState.errors.length > 0 ? pageState.errors.join('; ') : 'Verificação pode ter falhado.',
        screenshot,
        pageState,
      });
    }

    // ============ RENEW ============
    if (action === 'renew') {
      if (session.state !== 'logged_in') {
        return res.json({ success: false, error: 'Sessão não está logada. Faça login primeiro.' });
      }
      
      if (!clientData) return res.status(400).json({ error: 'clientData obrigatório (mac, username, credits, etc.)' });

      // Navigate to the renewal/credits page and perform renewal
      // This is specific to the UniTV/ResellerSystem interface
      const renewResult = await session.page.evaluate(async (data) => {
        // Try API call from within the browser context (authenticated)
        try {
          const resp = await fetch('/api/dealer/renew', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
          });
          const json = await resp.json();
          return { success: json.returnCode === 0, data: json, apiCall: true };
        } catch (e) {
          return { success: false, error: e.message, apiCall: false };
        }
      }, clientData);

      const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
      
      return res.json({
        success: renewResult.success,
        data: renewResult.data,
        error: renewResult.error,
        screenshot,
        message: renewResult.success ? 'Renovação realizada com sucesso!' : 'Falha na renovação',
      });
    }

    // ============ API_CALL (generic authenticated API call) ============
    if (action === 'api_call') {
      const { apiUrl, apiMethod, apiBody } = req.body;
      if (!apiUrl) return res.status(400).json({ error: 'apiUrl obrigatório' });

      const result = await session.page.evaluate(async (url, method, body) => {
        try {
          const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
          if (body) opts.body = JSON.stringify(body);
          const resp = await fetch(url, opts);
          const text = await resp.text();
          try { return { status: resp.status, data: JSON.parse(text), error: null }; }
          catch { return { status: resp.status, data: text, error: null }; }
        } catch (e) { return { status: 0, data: null, error: e.message }; }
      }, apiUrl, apiMethod || 'GET', apiBody || null);

      return res.json(result);
    }

    // ============ CLOSE ============
    if (action === 'close') {
      try { await session.browser.close(); } catch {}
      unitvSessions.delete(sessionId);
      return res.json({ success: true, message: 'Sessão fechada' });
    }

    return res.status(400).json({ error: 'Action inválida. Use: screenshot, send_code, submit_code, renew, api_call, close' });

  } catch (err) {
    console.error('[UNITV] Action error: ' + err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of unitvSessions) {
    if (now - session.ts > UNITV_SESSION_TTL) {
      console.log('[UNITV] Limpando sessão expirada: ' + sid);
      try { session.browser.close(); } catch {}
      unitvSessions.delete(sid);
    }
  }
}, 60000);

app.listen(PORT, '0.0.0.0', () => {
  console.log('CF Solver porta ' + PORT + ' | Proxy: ' + (PROXY_URL ? 'ON' : 'OFF') + ' | 2Captcha: ' + (TWOCAPTCHA_KEY ? 'ON' : 'OFF'));
  console.log('Endpoints:');
  console.log('  POST /v1            - Resolver Cloudflare');
  console.log('  POST /request       - Fetch via browser');
  console.log('  POST /unitv-login   - Login UniTV com captcha solving');
  console.log('  POST /unitv-action  - Ações na sessão UniTV (2FA, renovar, etc.)');
});
