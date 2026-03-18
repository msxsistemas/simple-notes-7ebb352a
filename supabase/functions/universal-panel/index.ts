import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BROWSERBASE_API = "https://api.browserbase.com/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label} (${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

// ==================== Browserbase ====================
async function createBrowserbaseSession(proxySessionId?: string | null, keepAlive = false): Promise<{ sessionId: string; connectUrl: string }> {
  const apiKey = Deno.env.get("BROWSERBASE_API_KEY")!;
  const projectId = Deno.env.get("BROWSERBASE_PROJECT_ID")!;

  // Check for IPRoyal proxy credentials for sticky IP
  const proxyHost = Deno.env.get("IPROYAL_PROXY_HOST");
  const proxyUser = Deno.env.get("IPROYAL_PROXY_USER");
  const proxyPass = Deno.env.get("IPROYAL_PROXY_PASS");
  const hasExternalProxy = proxyHost && proxyUser && proxyPass && proxySessionId;

  // Build proxy config for sticky session via IPRoyal
  const buildProxyConfig = () => {
    if (!hasExternalProxy) return null;
    // IPRoyal sticky session format: user-session-{id}_country-br
    const stickyUser = `${proxyUser}-session-${proxySessionId}_country-br`;
    return [{
      type: "external",
      server: `http://${proxyHost}`,
      username: stickyUser,
      password: proxyPass,
    }];
  };

  const externalProxies = buildProxyConfig();
  const proxyOptions = externalProxies ? [externalProxies, true, false] : [true, false];

  for (const proxyOpt of proxyOptions) {
    const payload: any = { projectId, browserSettings: { timeout: keepAlive ? 600 : 120 } };
    if (keepAlive) payload.keepAlive = true;
    if (Array.isArray(proxyOpt)) {
      payload.proxies = proxyOpt;
    } else if (proxyOpt === true) {
      payload.proxies = true;
    }

    // Retry up to 3 times with backoff for 429 rate limits
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const waitSec = attempt * 3;
        console.log(`⏳ Rate limit hit, waiting ${waitSec}s before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      }

      const resp = await withTimeout(
        fetch(`${BROWSERBASE_API}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-BB-API-Key": apiKey },
          body: JSON.stringify(payload),
        }),
        25000,
        "Browserbase session creation",
      );

      if (resp.status === 429) {
        lastError = await resp.text();
        console.error(`❌ Browserbase 429 (attempt ${attempt + 1}): ${lastError}`);
        continue;
      }
      if (resp.status === 402 && proxyOpt !== false) { await resp.text(); break; }
      if (!resp.ok) {
        const text = await resp.text();
        if (proxyOpt === false) throw new Error(`Browserbase failed (${resp.status}): ${text}`);
        console.log(`⚠️ Proxy option failed (${resp.status}), trying next...`);
        break;
      }

      const session = await resp.json();
      const proxyLabel = Array.isArray(proxyOpt) ? 'iproyal-sticky' : proxyOpt ? 'browserbase' : 'none';
      console.log(`🌐 Session: ${session.id} (proxy: ${proxyLabel}${proxySessionId ? ', sid: ' + proxySessionId : ''})`);
      return { sessionId: session.id, connectUrl: session.connectUrl };
    }
  }
  throw new Error("Browserbase: não foi possível criar sessão (rate limit ou sem sessão disponível)");
}

// Reconnect to an existing Browserbase session (for 2FA flow)
async function reconnectBrowserbaseSession(sessionId: string): Promise<string> {
  const apiKey = Deno.env.get("BROWSERBASE_API_KEY")!;
  // First check if session is still alive
  const statusResp = await withTimeout(
    fetch(`${BROWSERBASE_API}/sessions/${sessionId}`, {
      headers: { "X-BB-API-Key": apiKey },
    }),
    10000,
    "Browserbase session status",
  );
  if (!statusResp.ok) {
    throw new Error(`Session ${sessionId} not found (${statusResp.status})`);
  }
  const statusData = await statusResp.json();
  if (statusData.status !== 'RUNNING') {
    throw new Error(`Session ${sessionId} is ${statusData.status}, not RUNNING`);
  }
  // Use the original connectUrl format to reconnect
  const connectUrl = statusData.connectUrl;
  if (!connectUrl) {
    throw new Error(`Session ${sessionId} has no connectUrl`);
  }
  console.log(`🔄 Reconnecting to session: ${sessionId} (status: ${statusData.status})`);
  return connectUrl;
}

// ==================== CDP ====================
class CDPSession {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private sid: string | null = null;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      const timeout = setTimeout(() => reject(new Error("CDP WS timeout (30s)")), 30000);
      this.ws.onopen = () => { clearTimeout(timeout); console.log("✅ CDP conectado"); resolve(); };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error("CDP WS error")); };
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data));
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
          }
        } catch {}
      };
    });
  }

  async send(method: string, params: any = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout (30s): ${method}`)); }, 30000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      const msg: any = { id, method, params };
      if (this.sid) msg.sessionId = this.sid;
      this.ws.send(JSON.stringify(msg));
    });
  }

  async attachToPage(): Promise<void> {
    const { targetInfos } = await this.send("Target.getTargets");
    let page = (targetInfos || []).find((t: any) => t.type === "page");
    if (!page) {
      const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
      page = { targetId };
    }
    const result = await this.send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
    this.sid = result.sessionId;
  }

  close() { try { this.ws.close(); } catch {} }
}

// ==================== Helpers ====================
async function cdpType(cdp: CDPSession, selector: string, text: string): Promise<void> {
  // 1. Click the field to focus (physical click)
  const coordRes = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const el=document.querySelector(${JSON.stringify(selector)});
      if(!el) return 'notfound';
      const rect=el.getBoundingClientRect();
      return JSON.stringify({x:rect.x+rect.width/2, y:rect.y+rect.height/2});
    })()`,
    returnByValue: true,
  });
  if (coordRes.result?.value === 'notfound') {
    console.log(`⚠️ cdpType: not found: ${selector}`);
    return;
  }
  const coords = JSON.parse(coordRes.result?.value);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 3 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 3 });
  await new Promise(r => setTimeout(r, 200));

  // 2. Delete selected text
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" });
  await new Promise(r => setTimeout(r, 100));

  // 3. Type char by char (most reliable for reactive frameworks)
  for (const ch of text) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, code: `Key${ch.toUpperCase()}` });
    await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ch, key: ch, unmodifiedText: ch });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, code: `Key${ch.toUpperCase()}` });
    await new Promise(r => setTimeout(r, 30));
  }
  await new Promise(r => setTimeout(r, 200));

  // 4. Verify (with fallback for reactive inputs)
  const verify = await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})?.value || ''`,
    returnByValue: true,
  });
  let actual = verify.result?.value || '';

  if (!actual && text) {
    const forceSet = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return '';
        el.focus();
        const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nSet) nSet.call(el, ${JSON.stringify(text)});
        else (el as HTMLInputElement).value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return (el as HTMLInputElement).value || '';
      })()`,
      returnByValue: true,
    });
    actual = forceSet.result?.value || '';
  }

  console.log(`✅ cdpType(${selector}): "${actual.substring(0,15)}…" (${actual.length}/${text.length})`);
}

async function screenshot(cdp: CDPSession): Promise<string> {
  const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 50 });
  return r.data;
}

async function extractDOM(cdp: CDPSession): Promise<any> {
  const r = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      url: location.href, title: document.title,
      inputs: Array.from(document.querySelectorAll('input')).filter(el=>el.type!=='hidden').map((el,i) => ({
        i, type:el.type, name:el.name, id:el.id, placeholder:el.placeholder,
        autocomplete:el.autocomplete||'',
        sel: el.id ? '#'+el.id : el.name ? 'input[name="'+el.name+'"]' : el.placeholder ? 'input[placeholder="'+el.placeholder+'"]' : 'input:nth-child('+(i+1)+')',
      })),
      buttons: (function(){
        const allBtns = document.querySelectorAll('button, input[type=submit], a.btn');
        return Array.from(allBtns).map((el,i) => ({
          i, text:(el.textContent||'').trim().substring(0,50), type:el.type||'button',
          sel: el.id ? '#'+el.id : 'document.querySelectorAll("button, input[type=submit], a.btn")['+i+']',
          useEval: !el.id,
        }));
      })(),
      body: document.body?.innerText?.substring(0,500)||'',
    })`,
    returnByValue: true,
  });
  try { return JSON.parse(r.result?.value || "{}"); } catch { return {}; }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ==================== AI Vision ====================
async function askAI(prompt: string, img?: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");

  const content: any[] = [{ type: "text", text: prompt }];
  if (img) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } });

  const resp = await withTimeout(
    fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        temperature: 0,
      }),
    }),
    30000,
    "AI Gateway",
  );

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI error (${resp.status}): ${t.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseJSON(text: string): any | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

// ==================== reCAPTCHA Solver ====================
async function solveRecaptcha(cdp: CDPSession, siteKey: string, pageUrl: string): Promise<boolean> {
  const apiKey = Deno.env.get("TWOCAPTCHA_API_KEY");
  if (!apiKey) { console.log("⚠️ TWOCAPTCHA_API_KEY não configurada"); return false; }

  console.log(`🤖 Resolvendo reCAPTCHA (${siteKey.substring(0, 10)}...)...`);
  try {
    const sub = await withTimeout(fetch(`https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`), 15000, "2Captcha submit");
    const subJ = await sub.json();
    if (subJ.status !== 1) return false;

    for (let i = 0; i < 6; i++) {
      await wait(5000);
      const res = await withTimeout(fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${subJ.request}&json=1`), 10000, "2Captcha result");
      const resJ = await res.json();
      if (resJ.status === 1) {
        console.log("✅ reCAPTCHA resolvido!");
        const token = resJ.request;
        await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            const ta=document.querySelector('#g-recaptcha-response,textarea[name="g-recaptcha-response"]');
            if(ta){ta.value=${JSON.stringify(token)};ta.style.display='block';}
            try{if(typeof ___grecaptcha_cfg!=='undefined'){const c=___grecaptcha_cfg.clients||{};for(const k of Object.keys(c)){const find=(o,d)=>{if(!o||d>4)return null;if(typeof o==='function')return o;if(typeof o==='object'){for(const x of Object.keys(o)){if(x==='callback'&&typeof o[x]==='function')return o[x];const f=find(o[x],d+1);if(f)return f;}}return null;};const cb=find(c[k],0);if(cb){cb(${JSON.stringify(token)});break;}}}}catch(e){}
          })()`,
          returnByValue: true,
        });
        await wait(1000);
        return true;
      }
      if (resJ.request !== "CAPCHA_NOT_READY") return false;
    }
  } catch (e) { console.log(`⚠️ 2Captcha: ${(e as Error).message}`); }
  return false;
}

// ==================== Login Flow ====================
function findLoginFields(dom: any) {
  const inputs = dom.inputs || [];
  const buttons = dom.buttons || [];

  const user = inputs.find((i: any) =>
    i.type === "text" || i.type === "email" ||
    (i.name || "").match(/user|login|email|nome|account/i) ||
    (i.id || "").match(/user|login|email|account/i) ||
    (i.placeholder || "").match(/usu[aá]rio|user|login|email|account|conta/i) ||
    (i.autocomplete || "").match(/username/i),
  );
  const pass = inputs.find((i: any) =>
    i.type === "password" ||
    (i.name || "").match(/pass|senha|pwd/i) ||
    (i.id || "").match(/pass|senha|pwd/i) ||
    (i.placeholder || "").match(/pass|senha|pwd|密码/i) ||
    (i.autocomplete || "").match(/password/i),
  );
  const btn = buttons.find((b: any) =>
    b.type === "submit" || (b.text || "").match(/login|logar|entrar|acessar|sign.?in|enviar|submit/i),
  ) || buttons[0];

  return { user, pass, btn };
}

async function clickRecaptchaCheckbox(cdp: CDPSession): Promise<boolean> {
  // Find the reCAPTCHA anchor iframe and click the checkbox
  const rcResult = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const iframe = document.querySelector('iframe[src*="recaptcha"][src*="anchor"]')
                  || document.querySelector('iframe[src*="recaptcha"]');
      if(!iframe) return JSON.stringify({found:false});
      const rect = iframe.getBoundingClientRect();
      // Checkbox is at ~28,28 inside the iframe
      return JSON.stringify({found:true, x:rect.x+28, y:rect.y+28});
    })()`,
    returnByValue: true,
  });
  const info = JSON.parse(rcResult.result?.value || "{}");
  if (!info.found) return false;

  console.log(`🖱️ Clicando checkbox reCAPTCHA (${info.x}, ${info.y})`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: info.x, y: info.y, button: "left", clickCount: 1 });
  await new Promise(r => setTimeout(r, 50));
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: info.x, y: info.y, button: "left", clickCount: 1 });
  return true;
}

async function waitRecaptchaSolved(cdp: CDPSession, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const check = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        // Check if g-recaptcha-response has a value (token filled = solved)
        const ta = document.querySelector('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
        if(ta && ta.value && ta.value.length > 20) return 'solved';
        // Also check aria-checked on the checkbox inside iframe (not accessible cross-origin)
        // But we can check if the recaptcha widget has the "success" class
        const widget = document.querySelector('.g-recaptcha');
        if(widget) {
          const resp = widget.querySelector('.g-recaptcha-response');
          if(resp && resp.value && resp.value.length > 20) return 'solved';
        }
        return 'pending';
      })()`,
      returnByValue: true,
    });
    if (check.result?.value === 'solved') {
      console.log("✅ reCAPTCHA resolvido (checkbox verde)!");
      return true;
    }
    await wait(1500);
  }
  console.log("⏰ reCAPTCHA timeout — não ficou verde");
  return false;
}

async function doLogin(
  cdp: CDPSession,
  url: string,
  username: string,
  password: string,
  options?: { fastMode?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const fastMode = options?.fastMode === true;
  const initialWaitMs = fastMode ? 4000 : 8000;

  // 1. Navigate
  console.log(`🌐 Navegando: ${url} ${fastMode ? '(modo rápido)' : ''}`);
  await cdp.send("Page.navigate", { url });
  await wait(initialWaitMs);

  let dom = await extractDOM(cdp);
  console.log(`📋 ${dom.inputs?.length || 0} inputs, ${dom.buttons?.length || 0} buttons`);
  console.log(`📋 Inputs: ${JSON.stringify(dom.inputs || [])}`);

  // Cloudflare / loading detection — includes explicit CF markers AND empty/black pages
  const isCF = (d: any) => {
    const body = (d.body || '');
    const title = (d.title || '');
    return body.includes('Just a moment') || title.includes('Cloudflare') ||
      (title.includes('404') && body.length < 100) ||
      body.includes('challenge-platform') || body.includes('__CF');
  };

  const isEmptyPage = (d: any) => {
    return (d.inputs?.length || 0) === 0 && (d.buttons?.length || 0) === 0 && (d.body || '').trim().length < 20;
  };

    // Wait for CF challenge — even fast mode gets decent time now
    if (isCF(dom) || isEmptyPage(dom)) {
      const reason = isCF(dom) ? 'Cloudflare challenge' : 'página vazia/carregando';
      console.log(`⏳ ${reason} detectado, aguardando resolução...`);

      // Check page source for CF markers
      const pageSource = await cdp.send("Runtime.evaluate", {
        expression: `document.documentElement.outerHTML.substring(0, 3000)`,
        returnByValue: true,
      });
      const src = pageSource.result?.value || '';
      const hasCFMarkers = src.includes('challenge-platform') || src.includes('__CF') || src.includes('cf-') || src.includes('cloudflare');
      console.log(`📋 CF markers: ${hasCFMarkers}, src len: ${src.length}`);

      // Try clicking Turnstile/CF checkbox if present
      const tryClickCF = async () => {
        const cfClick = await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            // Turnstile iframe
            const ts = document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
            if(ts) {
              const r = ts.getBoundingClientRect();
              if(r.width > 0) return JSON.stringify({found:true, x:r.x+28, y:r.y+28, type:'turnstile'});
            }
            // CF challenge checkbox
            const cb = document.querySelector('#challenge-form input[type="checkbox"], .challenge-form input[type="checkbox"]');
            if(cb) {
              const r = cb.getBoundingClientRect();
              if(r.width > 0) return JSON.stringify({found:true, x:r.x+10, y:r.y+10, type:'checkbox'});
            }
            return JSON.stringify({found:false});
          })()`,
          returnByValue: true,
        });
        const info = JSON.parse(cfClick.result?.value || '{}');
        if (info.found) {
          console.log(`🖱️ Clicando CF ${info.type} (${info.x}, ${info.y})`);
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: info.x, y: info.y, button: "left", clickCount: 1 });
          await new Promise(r => setTimeout(r, 50));
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: info.x, y: info.y, button: "left", clickCount: 1 });
          return true;
        }
        return false;
      };

      // Poll — fast mode still gets 12 checks × 3s = 36s, full mode 20 × 5s = 100s
      const maxChecks = fastMode ? 12 : 20;
      const cfPollMs = fastMode ? 3000 : 5000;
      let clickedCF = false;

      for (let cfWait = 0; cfWait < maxChecks; cfWait++) {
        // Try clicking CF challenge every few iterations
        if (!clickedCF && (cfWait === 1 || cfWait === 4 || cfWait === 8)) {
          clickedCF = await tryClickCF();
        }
        await wait(cfPollMs);
        dom = await extractDOM(cdp);
        const hasFields = (dom.inputs?.length || 0) > 0;
        const loaded = !isCF(dom) && !isEmptyPage(dom);
        console.log(`🔄 CF Wait ${cfWait + 1}/${maxChecks}: inputs=${dom.inputs?.length || 0}, buttons=${dom.buttons?.length || 0}, title="${(dom.title || '').substring(0, 40)}", loaded=${loaded}`);
        if (hasFields || loaded) break;
      }
    }

  let { user, pass, btn } = findLoginFields(dom);

  if (!user && !pass) {
    // Se ainda sem campos após espera, tentar rotas comuns de login
    const loginPaths = fastMode
      ? ['/#/sign-in', '/login', '/#/login']
      : ['/#/sign-in', '/login', '/#/login', '/auth/login', '/#/auth/login', '/#/signin', '/sign-in', '/signin'];
    const cleanUrl = url.replace(/\/$/, '');
    const routeWaitMs = fastMode ? 4000 : 8000;
    const routeExtraChecks = fastMode ? 1 : 4;
    const routeExtraWaitMs = fastMode ? 3000 : 5000;

    for (const path of loginPaths) {
      console.log(`🔄 Tentando rota de login: ${cleanUrl}${path}`);
      await cdp.send("Page.navigate", { url: `${cleanUrl}${path}` });
      await wait(routeWaitMs);
      dom = await extractDOM(cdp);
      ({ user, pass, btn } = findLoginFields(dom));
      console.log(`📋 ${path}: ${dom.inputs?.length || 0} inputs, ${dom.buttons?.length || 0} buttons`);
      if (user || pass) break;
      // If still empty, wait more for this route too
      if (isEmptyPage(dom)) {
        for (let rw = 0; rw < routeExtraChecks; rw++) {
          await wait(routeExtraWaitMs);
          dom = await extractDOM(cdp);
          ({ user, pass, btn } = findLoginFields(dom));
          if (user || pass) break;
        }
        if (user || pass) break;
      }
    }
  }

  if (!user && !pass) {
    if (fastMode) {
      return { success: false, error: "Campos de login não encontrados (modo rápido)." };
    }

    const img = await screenshot(cdp);
    const ai = await askAI(`Is this a login page? DOM: ${JSON.stringify(dom).substring(0, 800)}. Describe briefly.`, img);
    console.log(`🤖 AI: ${ai.substring(0, 200)}`);
    return { success: false, error: `Campos de login não encontrados. AI: ${ai.substring(0, 300)}` };
  }

  // 2. Type username
  if (user) {
    console.log(`👤 Username: ${user.sel}`);
    await cdpType(cdp, user.sel, username);
  }

  // 3. Type password
  if (pass) {
    await wait(300);
    console.log(`🔑 Password: ${pass.sel}`);
    await cdpType(cdp, pass.sel, password);
  }

  // 4. Visual captcha (validateCode etc.)
  const validateInput = (dom.inputs || []).find((i: any) =>
    (i.id || "").match(/validate|captcha|code|verify/i) ||
    (i.name || "").match(/validate|captcha|code|verify/i) ||
    (i.placeholder || "").match(/validate|captcha|code|verif/i),
  );
  if (validateInput) {
    console.log(`🔢 Captcha visual: ${validateInput.sel}`);
    const img = await screenshot(cdp);
    const aiCaptcha = await askAI(
      `Read EVERY character/digit from the visual CAPTCHA image on this login page. Respond with ONLY the exact characters, nothing else.`, img,
    );
    const captchaText = aiCaptcha.trim().replace(/[^a-zA-Z0-9]/g, '');
    console.log(`🤖 Captcha: "${captchaText}"`);
    if (captchaText) await cdpType(cdp, validateInput.sel, captchaText);
  }

  // 5a. Cloudflare Turnstile / custom captcha checkbox
  const hasTurnstile = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      // Turnstile iframe
      const ts = document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
      if(ts) return JSON.stringify({type:'turnstile', found:true});
      // Custom checkbox captcha (Sigma uses a checkbox with "Verified" text)
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      for(const cb of checkboxes) {
        const parent = cb.closest('div, label, span');
        const text = parent?.textContent || '';
        if(text.match(/not.?a.?robot|verify|verified|captcha|bot/i)) {
          if(!cb.checked) {
            return JSON.stringify({type:'checkbox', found:true, sel: cb.id ? '#'+cb.id : 'input[type="checkbox"]'});
          } else {
            return JSON.stringify({type:'checkbox', found:true, checked:true});
          }
        }
      }
      return JSON.stringify({found:false});
    })()`,
    returnByValue: true,
  });
  const tsInfo = JSON.parse(hasTurnstile.result?.value || "{}");
  if (tsInfo.found) {
    console.log(`🔲 Captcha detectado: ${tsInfo.type} (checked: ${tsInfo.checked || false})`);
    if (tsInfo.type === 'turnstile') {
      // Click the Turnstile iframe checkbox
      const tsClick = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
          if(!iframe) return JSON.stringify({ok:false});
          const rect = iframe.getBoundingClientRect();
          return JSON.stringify({ok:true, x:rect.x+28, y:rect.y+28});
        })()`,
        returnByValue: true,
      });
      const tsCoords = JSON.parse(tsClick.result?.value || "{}");
      if (tsCoords.ok) {
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: tsCoords.x, y: tsCoords.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: tsCoords.x, y: tsCoords.y, button: "left", clickCount: 1 });
        console.log("🖱️ Clicked Turnstile checkbox");
        await wait(5000); // Wait for Turnstile to verify
      }
    } else if (tsInfo.type === 'checkbox' && !tsInfo.checked) {
      // Click unchecked captcha checkbox
      await cdp.send("Runtime.evaluate", {
        expression: `document.querySelector('${tsInfo.sel}')?.click()`,
        returnByValue: true,
      });
      console.log("🖱️ Clicked captcha checkbox");
      await wait(2000);
    }
  }

  // 5b. Solve Turnstile via 2Captcha if available
  if (tsInfo.found && tsInfo.type === 'turnstile') {
    const apiKey2c = Deno.env.get("TWOCAPTCHA_API_KEY");
    if (apiKey2c) {
      const tsSiteKey = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const w = document.querySelector('[data-sitekey]');
          if(w) return w.getAttribute('data-sitekey');
          const iframe = document.querySelector('iframe[src*="turnstile"]');
          if(iframe){ const m=iframe.src.match(/[?&]k=([^&]+)/); if(m) return m[1]; }
          return '';
        })()`,
        returnByValue: true,
      });
      const sk = tsSiteKey.result?.value || '';
      if (sk) {
        console.log(`🤖 Resolvendo Turnstile via 2Captcha (${sk.substring(0,10)}...)...`);
        try {
          const sub = await withTimeout(fetch(`https://2captcha.com/in.php?key=${apiKey2c}&method=turnstile&sitekey=${sk}&pageurl=${encodeURIComponent(url)}&json=1`), 15000, "2Captcha Turnstile submit");
          const subJ = await sub.json();
          if (subJ.status === 1) {
            for (let i = 0; i < 8; i++) {
              await wait(5000);
              const res = await withTimeout(fetch(`https://2captcha.com/res.php?key=${apiKey2c}&action=get&id=${subJ.request}&json=1`), 10000, "2Captcha result");
              const resJ = await res.json();
              if (resJ.status === 1) {
                console.log("✅ Turnstile resolvido!");
                await cdp.send("Runtime.evaluate", {
                  expression: `(function(){
                    // Inject the token into the page
                    const ta = document.querySelector('[name="cf-turnstile-response"], [name="cf_turnstile_response"]');
                    if(ta) ta.value = ${JSON.stringify(resJ.request)};
                    // Also try setting it via turnstile API
                    try { if(window.turnstile) { document.querySelectorAll('.cf-turnstile').forEach(w => { try { turnstile.reset(w); } catch(e){} }); } } catch(e){}
                    // Dispatch callback if exists
                    try {
                      const widgets = document.querySelectorAll('.cf-turnstile[data-callback]');
                      for(const w of widgets) {
                        const cb = w.getAttribute('data-callback');
                        if(cb && window[cb]) window[cb](${JSON.stringify(resJ.request)});
                      }
                    } catch(e){}
                  })()`,
                  returnByValue: true,
                });
                await wait(1000);
                break;
              }
              if (resJ.request !== "CAPCHA_NOT_READY") break;
            }
          }
        } catch (e) { console.log(`⚠️ 2Captcha Turnstile: ${(e as Error).message}`); }
      }
    }
  }

  // 5c. reCAPTCHA: click checkbox and wait for green
  const hasRecaptcha = await cdp.send("Runtime.evaluate", {
    expression: `!!document.querySelector('iframe[src*="recaptcha"]')`,
    returnByValue: true,
  });
  if (hasRecaptcha.result?.value) {
    console.log("🔲 reCAPTCHA detectado, clicando checkbox...");
    const clicked = await clickRecaptchaCheckbox(cdp);
    if (clicked) {
      await wait(4000);

      try {
        const rcImg = await screenshot(cdp);
        const rcAI = await askAI(
          `I just clicked the reCAPTCHA checkbox on a login page. What do I see now?
Is the checkbox green/checked (solved)? Or is there an image challenge popup asking to select images?
Respond ONLY JSON: {"solved": true/false, "imageChallenge": true/false, "description": "brief"}`, rcImg,
        );
        console.log(`📸 reCAPTCHA post-click: ${rcAI.substring(0, 300)}`);
        const rcParsed = parseJSON(rcAI);
        
        if (rcParsed?.solved) {
          console.log("✅ reCAPTCHA resolvido pelo checkbox!");
        } else {
          const solved = await waitRecaptchaSolved(cdp, 10000);
          if (!solved) {
            console.log("⚠️ Checkbox não resolveu, tentando 2Captcha...");
            const skRes = await cdp.send("Runtime.evaluate", {
              expression: `(function(){
                const ds = document.querySelector('[data-sitekey]');
                if(ds) return ds.getAttribute('data-sitekey');
                const iframe = document.querySelector('iframe[src*="recaptcha"]');
                if(iframe){ const m = iframe.src.match(/[?&]k=([^&]+)/); if(m) return m[1]; }
                return '';
              })()`,
              returnByValue: true,
            });
            const siteKey = skRes.result?.value || '';
            if (siteKey) {
              await solveRecaptcha(cdp, siteKey, url);
            }
          }
        }
      } catch (e) {
        console.log(`📸 reCAPTCHA screenshot error: ${(e as Error).message}`);
      }
    }
  }

  // 6. Click login button
  if (btn) {
    await wait(500);
    console.log(`🔘 Submit: "${btn.text}" (${btn.sel})`);
    const btnCoordExpr = btn.useEval
      ? `(function(){ const el=${btn.sel}; if(!el) return 'null'; const r=el.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2}); })()`
      : `(function(){ const el=document.querySelector('${btn.sel}'); if(!el) return 'null'; const r=el.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2}); })()`;
    const btnCoordResult = await cdp.send("Runtime.evaluate", { expression: btnCoordExpr, returnByValue: true });
    const btnCoords = btnCoordResult.result?.value;
    if (btnCoords && btnCoords !== 'null') {
      const coords = JSON.parse(btnCoords);
      console.log(`🖱️ Click submit (${coords.x}, ${coords.y})`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
      await new Promise(r => setTimeout(r, 50));
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
    } else {
      const clickExpr = btn.useEval ? `${btn.sel}?.click()` : `document.querySelector('${btn.sel}')?.click()`;
      await cdp.send("Runtime.evaluate", { expression: clickExpr, returnByValue: true });
    }
  }

  await wait(5000);

  // 7. Check 2FA
  const twoFACheck = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const body = document.body?.innerText || '';
      const has2FA = body.match(/identity.?authentication|unfamiliar.?device|dispositivo.?desconhecido|two.?factor|verification.?code|verificação.?de.?identidade|verify.?your.?identity/i);
      return JSON.stringify({has2FA: !!has2FA});
    })()`,
    returnByValue: true,
  });
  const tfa = JSON.parse(twoFACheck.result?.value || "{}");
  if (tfa.has2FA) {
    console.log("🔐 2FA detectado!");
    // Try to click Send button
    await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const btns = document.querySelectorAll('button, a');
        for(const b of btns){
          const t = (b.textContent||'').trim().toLowerCase();
          if(t.match(/^send$|enviar|send code|enviar código|get code/i)){ b.click(); return 'clicked'; }
        }
        return 'none';
      })()`,
      returnByValue: true,
    });
    return { success: true, error: "Login OK, mas verificação de identidade (2FA) pendente." };
  }

  // 8. Verify result
  await wait(3000);
  const afterDom = await extractDOM(cdp);
  console.log(`📊 After: URL=${afterDom.url}, title=${afterDom.title}`);
  console.log(`📊 Body: ${(afterDom.body || "").substring(0, 200)}`);

  const afterUrl = afterDom.url || "";
  const hasUserField = (afterDom.inputs || []).some((i: any) =>
    (i.type === 'text' || i.type === 'email') &&
    ((i.name || '').match(/user|login|email|conta/i) || (i.id || '').match(/user|login|email|conta/i) || (i.placeholder || '').match(/usu[aá]rio|user|login|email|conta/i))
  );
  const hasPasswordField = (afterDom.inputs || []).some((i: any) => i.type === 'password' || (i.name || '').match(/pass|senha|pwd/i) || (i.id || '').match(/pass|senha|pwd/i));
  const hasLoginKeywords = (afterDom.body || "").match(/senha de acesso|continuar conectado|\blogar\b|sign.?in|\bentrar\b|acessar/i);
  const hasLoginForm = hasPasswordField || (hasUserField && !!hasLoginKeywords);
  const stillOnLogin = afterUrl.includes("login") || afterUrl.includes("signin") || afterUrl.includes("sign-in") || hasLoginForm;
  const hasError = (afterDom.body || "").match(/incorrect|inválid|invalid|incorret|falh|preencha|does not match|are incorrect/i);
  const hasDash = (afterDom.body || "").match(/dashboard|painel|cliente|credit|saldo|home|account/i);
  const urlChanged = afterUrl !== url;

  // IMPORTANT: Check errors/login-form FIRST before assuming URL change = success
  if (hasError) {
    console.log(`❌ Login falhou: ${(afterDom.body || "").substring(0, 200)}`);
    return { success: false, error: `Credenciais incorretas ou erro no login: ${(afterDom.body || "").substring(0, 200)}` };
  }
  if (hasLoginForm) {
    console.log(`❌ Login falhou: formulário de login ainda presente`);
    return { success: false, error: "Login não concluído: formulário de login ainda presente após submit." };
  }
  if (urlChanged && !stillOnLogin) { console.log("✅ Login OK (URL changed)"); return { success: true }; }
  if (!stillOnLogin && hasDash) { console.log("✅ Login OK (dashboard)"); return { success: true }; }

  // AI verify as last resort
  const img = await screenshot(cdp);
  const aiV = await askAI(
    `Did login succeed? URL: ${afterDom.url}, Title: ${afterDom.title}, Text: ${(afterDom.body || "").substring(0, 300)}.
Respond ONLY JSON: {"success": true/false, "twoFA": true/false, "reason": "brief"}`, img,
  );
  console.log(`🤖 Verify: ${aiV.substring(0, 200)}`);
  const parsed = parseJSON(aiV);
  if (parsed?.twoFA) return { success: true, error: "Credenciais corretas! 2FA pendente." };
  if (parsed) return { success: parsed.success === true, error: parsed.success ? undefined : parsed.reason };
  return { success: false, error: "Não foi possível verificar o resultado do login." };
}

// ==================== Renewal Helpers ====================
async function confirmDialogIfPresent(cdp: CDPSession): Promise<void> {
  const confirmResult = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const modals = document.querySelectorAll('.swal2-confirm, .modal .btn-primary, .modal .btn-success, button.confirm, .sweet-alert button.confirm, .swal2-actions button');
      for (const m of modals) {
        const t = (m.textContent || '').trim().toLowerCase();
        if (t.includes('ok') || t.includes('sim') || t.includes('yes') || t.includes('confirm') || t.includes('renovar')) {
          const rect = m.getBoundingClientRect();
          return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: m.textContent.trim()});
        }
      }
      const allBtns = document.querySelectorAll('button');
      for (const b of allBtns) {
        const t = (b.textContent || '').trim().toLowerCase();
        const isVisible = b.offsetParent !== null || b.offsetWidth > 0;
        if (isVisible && (t === 'ok' || t === 'sim' || t === 'yes')) {
          const rect = b.getBoundingClientRect();
          return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: b.textContent.trim()});
        }
      }
      return JSON.stringify({found: false});
    })()`,
    returnByValue: true,
  });
  const confirmRes = JSON.parse(confirmResult.result?.value || "{}");
  if (confirmRes.found) {
    console.log(`✅ Confirmando: "${confirmRes.text}" at (${confirmRes.x}, ${confirmRes.y})`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: confirmRes.x, y: confirmRes.y, button: "left", clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: confirmRes.x, y: confirmRes.y, button: "left", clickCount: 1 });
    await wait(2000);
  }
}

async function verifyRenewalResult(cdp: CDPSession, clientUsername: string, section: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const verifyResult = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const body = document.body?.innerText || '';
      const success = body.match(/sucesso|renovado|success|renewed|atualizado|updated|realizado/i);
      const error = body.match(/erro|error|falha|fail|insufficient|insuficiente|crédito/i);
      return JSON.stringify({success: !!success, error: !!error, body: body.substring(0, 300)});
    })()`,
    returnByValue: true,
  });
  const verifyRes = JSON.parse(verifyResult.result?.value || "{}");
  console.log(`📊 Verify: success=${verifyRes.success}, error=${verifyRes.error}`);

  if (verifyRes.error && !verifyRes.success) {
    return { success: false, error: `Erro na renovação: ${verifyRes.body.substring(0, 200)}` };
  }

  const finalImg = await screenshot(cdp);
  const aiConfirm = await askAI(
    `Did the renewal succeed for user "${clientUsername}"?
Page text: ${verifyRes.body}
Look for success/error messages, alerts, or any indication.
Respond ONLY JSON: {"success": true/false, "message": "brief description of what happened"}`, finalImg,
  );
  console.log(`🤖 AI confirm: ${aiConfirm.substring(0, 200)}`);
  const confirmParsed = parseJSON(aiConfirm);

  if (confirmParsed) {
    return { success: confirmParsed.success === true, message: confirmParsed.message, error: confirmParsed.success ? undefined : confirmParsed.message };
  }
  return { success: true, message: `Renovação aplicada para ${clientUsername} em ${section}` };
}

// ==================== Renew Flow ====================
async function doRenew(
  cdp: CDPSession, baseUrl: string, clientUsername: string, duration: number, durationIn: string,
  options?: { tipoPainel?: string; provedor?: string },
): Promise<{ success: boolean; message?: string; error?: string }> {
  console.log(`🔄 Renovando: ${clientUsername} (${duration} ${durationIn}) [provedor: ${options?.provedor || 'unknown'}]`);

  const isStarHome = baseUrl.match(/starhome|unitv/i);
  const isSigma = options?.provedor === 'sigma' || baseUrl.match(/sigma|slim/i);

  if (isStarHome || isSigma) {
    // Navigate to customer list — different panels use different routes
    const cleanBase = baseUrl.replace(/\/$/, '');

    if (isSigma) {
      // Sigma/Slim panels: click the "Clientes" menu item directly (more reliable than URL navigation)
      console.log(`📋 Sigma: clicando no menu "Clientes"...`);
      const menuResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          // First check current URL
          const url = location.href;
          // Click "Clientes" in the sidebar/menu — match the menu link specifically
          const menuLinks = document.querySelectorAll('a[href*="customer"], a[href*="client"], nav a, .sidebar a, .el-menu a, .el-menu-item, .menu-item a');
          for (const link of menuLinks) {
            const t = (link.textContent || '').trim();
            if (/^Clientes$/i.test(t) || /^Customers$/i.test(t) || /^Clientes\\s*$/i.test(t)) {
              link.click();
              return JSON.stringify({ok: true, method: 'menu-link', text: t, url: url});
            }
          }
          // Broader search: any clickable element with exactly "Clientes"
          const allEls = document.querySelectorAll('a, span, div, li');
          for (const el of allEls) {
            const t = (el.textContent || '').trim();
            // Match ONLY "Clientes" not "Clientes X" (avoid sub-items)
            if (t === 'Clientes' || t === 'Customers') {
              el.click();
              return JSON.stringify({ok: true, method: 'text-match', text: t, url: url});
            }
          }
          return JSON.stringify({ok: false, url: url});
        })()`,
        returnByValue: true,
      });
      console.log(`📋 Sigma menu click: ${menuResult.result?.value}`);
      await wait(5000);

      // Verify we're on the customers page (should have USUÁRIO column header)
      const pageCheck = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const url = location.href;
          const body = document.body?.innerText || '';
          const hasUserColumn = /USUÁRIO|USERNAME|USUARIO/i.test(body);
          const hasSearchField = !!document.querySelector('input[placeholder*="Pesquisar"], input[placeholder*="Buscar"], input[placeholder*="Search"]');
          return JSON.stringify({url, hasUserColumn, hasSearchField, bodySnippet: body.substring(0,200)});
        })()`,
        returnByValue: true,
      });
      const pageInfo = JSON.parse(pageCheck.result?.value || "{}");
      console.log(`📋 Sigma page check: URL=${pageInfo.url}, hasUserColumn=${pageInfo.hasUserColumn}, hasSearch=${pageInfo.hasSearchField}`);

      // If not on customers page, try direct URL navigation as fallback
      if (!pageInfo.hasUserColumn && !pageInfo.hasSearchField) {
        console.log(`⚠️ Não está na página de clientes, tentando URLs diretas...`);
        const routes = ['/#/customers', '/#/clients', '/#/users-iptv', '/#/users'];
        for (const route of routes) {
          await cdp.send("Page.navigate", { url: `${cleanBase}${route}` });
          await wait(4000);
          const check2 = await cdp.send("Runtime.evaluate", {
            expression: `(/USUÁRIO|USERNAME/i.test(document.body?.innerText || '')) || !!document.querySelector('input[placeholder*="Pesquisar"]')`,
            returnByValue: true,
          });
          if (check2.result?.value) {
            console.log(`✅ Encontrado clientes em ${route}`);
            break;
          }
        }
      }
    } else {
      // StarHome
      const accountListUrl = `${cleanBase}/#/account/list`;
      console.log(`📋 Navegando para: ${accountListUrl}`);
      await cdp.send("Page.navigate", { url: accountListUrl });
      await wait(5000);
    }

    // Search for the username using cdpType (char-by-char) for Vue/Element UI compatibility
    console.log(`🔍 Buscando "${clientUsername}"...`);

    if (isSigma) {
      // For Sigma/Slim: fill the MAIN table search input (not sidebar/menu search)
      const sigmaSearch = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const inputs = Array.from(document.querySelectorAll('input'));
          const candidates = inputs.filter((inp) => {
            const ph = (inp.placeholder || '').toLowerCase();
            if (!(ph.includes('pesquisar') || ph.includes('buscar') || ph.includes('search'))) return false;
            if (ph.includes('menu') || ph.includes('navegação')) return false;
            if (inp.closest('nav, aside, .sidebar, .el-aside, [class*="sidebar"], [class*="menu"]')) return false;
            const r = inp.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });

          const target = candidates[0] || null;
          if (!target) return JSON.stringify({ ok: false, reason: 'search-input-not-found' });

          target.focus();
          const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (nSet) nSet.call(target, ${JSON.stringify(clientUsername)});
          else target.value = ${JSON.stringify(clientUsername)};
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

          // Try clicking explicit search/consultar button if present
          const btns = Array.from(document.querySelectorAll('button, .el-button, a'));
          for (const b of btns) {
            const t = (b.textContent || '').trim().toLowerCase();
            const r = b.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (t.includes('buscar') || t.includes('pesquisar') || t.includes('consultar') || t === 'search') {
              b.click();
              break;
            }
          }

          return JSON.stringify({ ok: true, placeholder: target.placeholder || '', value: target.value || '' });
        })()`,
        returnByValue: true,
      });
      console.log(`🔍 Sigma search result: ${sigmaSearch.result?.value}`);
      await wait(3200);
    } else {
      // StarHome: use label-based search
      await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const labels = document.querySelectorAll('label, span, td, th, div');
          for (const lbl of labels) {
            const t = (lbl.textContent || '').trim();
            if (t === 'Conta' || t === 'Account' || t === 'Usuário' || t === 'Username') {
              const row = lbl.closest('tr, div, .el-form-item');
              if (row) {
                const inp = row.querySelector('input[type="text"], input:not([type])');
                if (inp) {
                  inp.focus();
                  const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
                  if(nSet) nSet.call(inp, ${JSON.stringify(clientUsername)});
                  else inp.value = ${JSON.stringify(clientUsername)};
                  inp.dispatchEvent(new Event('input',{bubbles:true}));
                  inp.dispatchEvent(new Event('change',{bubbles:true}));
                  return JSON.stringify({ok: true});
                }
              }
            }
          }
          return JSON.stringify({ok: false});
        })()`,
        returnByValue: true,
      });
      await wait(1000);
      // Click search button or press Enter
      await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const btns = document.querySelectorAll('button, .el-button, [type="submit"]');
          for (const b of btns) {
            const t = (b.textContent || '').trim().toLowerCase();
            if (t.includes('consultar') || t.includes('search') || t.includes('buscar') || t === 'query') {
              b.click(); return 'clicked: ' + t;
            }
          }
          return 'none';
        })()`,
        returnByValue: true,
      });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await wait(4000);
    }

    // Take screenshot and use AI to find the "Renovar" or "Edit" button for this user
    const img = await screenshot(cdp);
    const dom = await extractDOM(cdp);
    console.log(`📊 Resultados: ${(dom.body || "").substring(0, 300)}`);

    // Check if user was found - use full page text, not just truncated body
    const fullPageCheck = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const text = (document.body?.innerText || '').toLowerCase();
        const username = ${JSON.stringify(clientUsername)}.toLowerCase();
        const hasResults = !text.match(/Total:\\s*0|no data|nenhum resultado/i);
        const usernameVisible = text.includes(username);
        // Also check table cells specifically
        const cells = document.querySelectorAll('td, th');
        let inTable = false;
        for (const cell of cells) {
          if ((cell.textContent || '').trim().toLowerCase() === username) { inTable = true; break; }
        }
        return JSON.stringify({ hasResults, usernameVisible: usernameVisible || inTable });
      })()`,
      returnByValue: true,
    });
    const pageState = JSON.parse(fullPageCheck.result?.value || '{}');
    const hasResults = pageState.hasResults !== false;
    const usernameVisible = pageState.usernameVisible === true;
    console.log(`📊 Busca: hasResults=${hasResults}, usernameVisible=${usernameVisible}`);
    
    if (!hasResults) {
      return { success: false, error: `Usuário "${clientUsername}" não encontrado no painel.` };
    }

    // If search didn't filter (username not visible), the search may have failed
    if (!usernameVisible && isSigma) {
      console.log(`⚠️ Username "${clientUsername}" não visível nos resultados, tentando busca novamente...`);
      // Try using cdpType on the search input again
      const retrySearch = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const inputs = document.querySelectorAll('input');
          for (const inp of inputs) {
            const ph = (inp.placeholder || '').toLowerCase();
            if (ph.includes('menu') || ph.includes('navegação')) continue;
            if (ph.includes('pesquisar') || ph.includes('buscar') || ph.includes('search')) {
              const parent = inp.closest('nav, .sidebar, .el-aside, aside, [class*="sidebar"]');
              if (parent) continue;
              return inp.placeholder ? 'input[placeholder="' + inp.placeholder + '"]' : null;
            }
          }
          return null;
        })()`,
        returnByValue: true,
      });
      const retrySel = retrySearch.result?.value;
      if (retrySel) {
        // Clear and retype
        await cdp.send("Runtime.evaluate", {
          expression: `(function(){ const el=document.querySelector('${retrySel}'); if(el){el.value='';el.focus();} })()`,
          returnByValue: true,
        });
        await wait(300);
        await cdpType(cdp, retrySel, clientUsername);
        await wait(1000);
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await wait(4000);
      }
    }

    // Re-take screenshot after potential retry
    const img2 = usernameVisible ? img : await screenshot(cdp);
    const dom2 = usernameVisible ? dom : await extractDOM(cdp);
    if (!usernameVisible) {
      console.log(`📊 Resultados (retry): ${(dom2.body || "").substring(0, 300)}`);
    }

    // Sigma/Slim deterministic flow: Ações → Renovar → manter plano → clicar "Renovar >"
    if (isSigma) {
      console.log(`🧭 Sigma fluxo simples: Ações → Renovar → confirmar para "${clientUsername}"`);

      // STEP 1: Find and click the "Ações" button in the user's row
      const acoesResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const uname = ${JSON.stringify(clientUsername)}.toLowerCase();
          const rows = Array.from(document.querySelectorAll('table tbody tr'));
          const target = rows.find(r => (r.textContent || '').toLowerCase().includes(uname));
          if (!target) return JSON.stringify({ok: false, reason: 'row-not-found'});
          
          const btns = Array.from(target.querySelectorAll('a, button, [role="button"], span'));
          // Look for "Ações" text button
          for (const b of btns) {
            const t = (b.textContent||'').trim();
            if (/^a[çc][õo]es$/i.test(t) || /^actions$/i.test(t)) {
              const r = b.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                return JSON.stringify({ok: true, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), text: t});
              }
            }
          }
          // Fallback: dropdown toggle
          for (const b of btns) {
            const cls = String(b.className || '').toLowerCase();
            if (cls.includes('dropdown') || b.getAttribute('data-bs-toggle') === 'dropdown' || b.getAttribute('data-toggle') === 'dropdown') {
              const r = b.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                return JSON.stringify({ok: true, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), text: 'dropdown-toggle'});
              }
            }
          }
          // Last fallback: rightmost visible button in the row
          const visible = btns.filter(b => { const r = b.getBoundingClientRect(); return r.width > 30 && r.height > 20; })
            .sort((a, b) => b.getBoundingClientRect().x - a.getBoundingClientRect().x);
          if (visible.length > 0) {
            const b = visible[0]; const r = b.getBoundingClientRect();
            return JSON.stringify({ok: true, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), text: (b.textContent||'').trim().substring(0,20)});
          }
          return JSON.stringify({ok: false, reason: 'acoes-not-found', btns: btns.map(b => (b.textContent||'').trim().substring(0,20)).filter(Boolean)});
        })()`,
        returnByValue: true,
      });
      const acoesInfo = JSON.parse(acoesResult.result?.value || '{}');
      console.log(`📋 Sigma Ações: ${acoesResult.result?.value}`);

      if (!acoesInfo.ok) {
        // AI Vision fallback to find "Ações" button
        const rowImg = await screenshot(cdp);
        const aiAcoes = await askAI(
          `IPTV panel (SlimTV/Sigma) customer list. Find the blue "Ações" button in the row for user "${clientUsername}".
Respond ONLY JSON: {"found": true/false, "x": number, "y": number}`, rowImg);
        const aiBtn = parseJSON(aiAcoes);
        if (!aiBtn?.found) {
          return { success: false, error: `Sigma: botão Ações não encontrado para "${clientUsername}".` };
        }
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: aiBtn.x, y: aiBtn.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: aiBtn.x, y: aiBtn.y, button: "left", clickCount: 1 });
      } else {
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: acoesInfo.x, y: acoesInfo.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: acoesInfo.x, y: acoesInfo.y, button: "left", clickCount: 1 });
      }
      console.log(`🖱️ Clicou Ações`);
      await wait(1500);

      // STEP 2: Click "Renovar" in the dropdown menu
      const renovarResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          // Search all visible dropdown/menu items
          const selectors = '.dropdown-menu a, .dropdown-menu li, .dropdown-menu button, [role="menu"] a, [role="menu"] [role="menuitem"], [role="listbox"] [role="option"], .show a, .show li a, .menu-sub a, .menu-sub-dropdown a, [class*="menu-sub"] a, [class*="popover"] a';
          const items = document.querySelectorAll(selectors);
          
          // Also check any floating/high-z-index elements
          const allClickable = document.querySelectorAll('a, button, span, li, div');
          const sidebarEls = new Set();
          document.querySelectorAll('nav, aside, [class*="sidebar"], [class*="aside"]').forEach(el => {
            el.querySelectorAll('*').forEach(child => sidebarEls.add(child));
            sidebarEls.add(el);
          });
          
          const candidates = new Set();
          items.forEach(el => { if (!sidebarEls.has(el)) candidates.add(el); });
          
          // Also add high-z elements with "Renovar" text
          allClickable.forEach(el => {
            if (sidebarEls.has(el)) return;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0 || r.width > 300) return;
            const t = (el.textContent||'').trim().toLowerCase();
            if (t === 'renovar' || t === 'renew') {
              const cs = getComputedStyle(el);
              const z = parseInt(cs.zIndex) || 0;
              if (z > 0 || el.closest('[class*="dropdown"], [class*="menu"], [role="menu"], .show')) {
                candidates.add(el);
              }
            }
          });

          for (const el of candidates) {
            const t = (el.textContent||'').trim().toLowerCase();
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (t === 'renovar' || t === 'renew') {
              el.click();
              return JSON.stringify({ok: true, text: t, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)});
            }
          }
          
          // Collect visible items for debugging
          const visible = [];
          candidates.forEach(el => {
            const t = (el.textContent||'').trim();
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && t.length > 0 && t.length < 40) visible.push(t);
          });
          return JSON.stringify({ok: false, visible: visible.slice(0, 20)});
        })()`,
        returnByValue: true,
      });
      const renovarInfo = JSON.parse(renovarResult.result?.value || '{}');
      console.log(`📋 Sigma Renovar click: ${renovarResult.result?.value}`);

      if (!renovarInfo.ok) {
        // AI Vision fallback
        const dropImg = await screenshot(cdp);
        const aiRenovar = await askAI(
          `I clicked "Ações" dropdown on an IPTV panel. I need to click "Renovar" in the dropdown menu. Find it.
Respond ONLY JSON: {"found": true/false, "x": number, "y": number}`, dropImg);
        const aiR = parseJSON(aiRenovar);
        if (aiR?.found) {
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: aiR.x, y: aiR.y, button: "left", clickCount: 1 });
          await new Promise(r => setTimeout(r, 50));
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: aiR.x, y: aiR.y, button: "left", clickCount: 1 });
        } else {
          return { success: false, error: `Sigma: "Renovar" não encontrado no dropdown. Items visíveis: ${JSON.stringify(renovarInfo.visible || [])}` };
        }
      }
      console.log(`🖱️ Clicou Renovar no dropdown`);
      await wait(3000);

      // STEP 3: Modal "Renovar" abriu — NÃO muda plano, apenas clica "Renovar >" no rodapé
      // Wait a bit more for modal to fully render
      await wait(1500);

      // Take screenshot for debugging
      const modalImg = await screenshot(cdp);
      console.log(`📸 Screenshot do modal de renovação capturado`);

      // Click the green "Renovar >" submit button at the bottom of the modal
      const submitResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          // Look for the submit "Renovar" button in the modal (NOT the dropdown one we already clicked)
          // The button is typically green, at the bottom, next to "Cancelar"
          // Support Element UI (.el-button, .el-dialog), Bootstrap, and custom frameworks
          const allBtns = document.querySelectorAll('button, a.btn, [role="button"], .el-button, .btn, span.el-button');
          
          // Exclude sidebar
          const sidebarEls = new Set();
          document.querySelectorAll('nav, aside, [class*="sidebar"], [class*="aside"]').forEach(el => {
            el.querySelectorAll('*').forEach(child => sidebarEls.add(child));
            sidebarEls.add(el);
          });

          // Check if we're inside a modal/dialog context (Element UI uses .el-dialog, .el-overlay, .el-dialog__wrapper)
          const modalContainers = document.querySelectorAll('[role="dialog"], .modal, .modal-dialog, .el-dialog, .el-dialog__wrapper, .el-overlay, .v-dialog, [class*="dialog"], [class*="modal"], .swal2-popup');
          const isInModal = modalContainers.length > 0;

          const scored = [];
          for (const b of allBtns) {
            if (sidebarEls.has(b)) continue;
            const r = b.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            
            const t = (b.textContent||'').trim();
            const tLower = t.toLowerCase().replace(/[\\s>→►▶]+/g, ' ').trim();
            const cls = String(b.className || '').toLowerCase();
            const style = b.getAttribute('style') || '';
            
            let score = 0;
            // Must contain "renovar" text
            if (/renovar|renew/i.test(tLower)) score += 10;
            // Green/primary/success button (submit style) — includes Element UI classes
            if (/success|primary|btn-success|btn-primary|bg-success|bg-primary|el-button--success|el-button--primary/i.test(cls)) score += 5;
            // Green background via inline style
            if (/green|#28a745|#67c23a|#409eff|success/i.test(style)) score += 3;
            // Inside a modal/dialog (broadened for Element UI)
            if (b.closest('[role="dialog"], .modal, .el-dialog, .el-dialog__wrapper, .el-overlay, .v-dialog, [class*="dialog"], [class*="modal"], .swal2-popup')) score += 5;
            // If modal is open and this button is NOT in sidebar, give bonus
            if (isInModal && !b.closest('.dropdown-menu, [role="menu"]')) score += 3;
            // Has arrow icon (">", "→") — the submit button has this
            if (t.includes('>') || t.includes('→') || t.includes('►') || b.querySelector('i, svg, .fa, .el-icon')) score += 3;
            // Near bottom of viewport (submit buttons are at bottom)
            if (r.y > 400) score += 2;
            // Submit type
            if (b.type === 'submit') score += 5;
            
            // Penalize if it's a small/icon button (not the main submit)
            if (r.width < 60) score -= 10;
            // Penalize cancel/close buttons
            if (/cancelar|cancel|fechar|close|voltar/i.test(tLower)) score -= 20;
            // Penalize dropdown items (already used)
            if (b.closest('.dropdown-menu, [role="menu"]')) score -= 20;
            
            if (score > 5) {
              scored.push({b, score, text: tLower, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), w: Math.round(r.width)});
            }
          }
          
          scored.sort((a, b) => b.score - a.score);
          if (scored.length > 0) {
            scored[0].b.click();
            return JSON.stringify({ok: true, text: scored[0].text, score: scored[0].score, x: scored[0].x, y: scored[0].y});
          }
          
          // Debug: list all visible buttons (including Element UI)
          const debug = [];
          for (const b of allBtns) {
            if (sidebarEls.has(b)) continue;
            const r = b.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              debug.push({text: (b.textContent||'').trim().substring(0,30), cls: String(b.className||'').substring(0,80), y: Math.round(r.y), w: Math.round(r.width), inModal: !!b.closest('.el-dialog, .modal, [role="dialog"], .el-overlay')});
            }
          }
          return JSON.stringify({ok: false, buttons: debug.slice(0, 30)});
        })()`,
        returnByValue: true,
      });
      const submitInfo = JSON.parse(submitResult.result?.value || '{}');
      console.log(`📋 Sigma submit Renovar: ${submitResult.result?.value}`);

      if (!submitInfo.ok) {
        // AI Vision fallback for the submit button
        const aiSubmit = await askAI(
          `I'm on an IPTV panel (SlimTV/Sigma) renewal modal. I need to click the green "Renovar >" button at the bottom to confirm the renewal. Find it.
There should be a "Cancelar" button next to it. Do NOT click Cancelar.
Respond ONLY JSON: {"found": true/false, "x": number, "y": number}`, modalImg);
        const aiS = parseJSON(aiSubmit);
        if (aiS?.found) {
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: aiS.x, y: aiS.y, button: "left", clickCount: 1 });
          await new Promise(r => setTimeout(r, 50));
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: aiS.x, y: aiS.y, button: "left", clickCount: 1 });
        } else {
          return { success: false, error: `Sigma: botão "Renovar >" não encontrado no modal. Botões: ${JSON.stringify(submitInfo.buttons || [])}` };
        }
      }
      console.log(`🖱️ Clicou "Renovar >" no modal`);
      await wait(3000);

      // STEP 4: Handle any confirmation dialog
      await confirmDialogIfPresent(cdp);
      await wait(2000);

      // STEP 5: Verify result
      const quickCheck = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const body = document.body?.innerText || '';
          const success = body.match(/sucesso|renovado|success|renewed|atualizado|updated|realizado/i);
          const error = body.match(/erro|error|falha|fail|insufficient|insuficiente|crédito/i);
          return JSON.stringify({success: !!success, error: !!error, body: body.substring(0, 300)});
        })()`,
        returnByValue: true,
      });
      const qr = JSON.parse(quickCheck.result?.value || "{}");
      console.log(`📊 Sigma verify: success=${qr.success}, error=${qr.error}, body=${(qr.body||'').substring(0,150)}`);
      
      if (qr.success && !qr.error) return { success: true, message: `Renovação concluída para ${clientUsername}` };
      if (qr.error && !qr.success) return { success: false, error: `Erro na renovação: ${(qr.body||'').substring(0, 200)}` };
      
      // Take final screenshot for AI verification
      const finalImg = await screenshot(cdp);
      const aiVerify = await askAI(
        `Did the renewal succeed for user "${clientUsername}" on this IPTV panel? Look for success/error messages.
Respond JSON: {"success": true/false, "message": "what you see"}`, finalImg);
      const aiV = parseJSON(aiVerify);
      if (aiV?.success) return { success: true, message: aiV.message || `Renovação concluída para ${clientUsername}` };
      return { success: false, error: aiV?.message || `Sigma: sem confirmação explícita para ${clientUsername}.` };
    }

    // Use AI to find and click the renew/edit action for this user
    const panelTypeHint = isSigma ? 
      `This is a Sigma/SlimTV panel. Look for the row containing "${clientUsername}" and find the action button (usually a dropdown or icon in the AÇÕES column). Click ONLY the action for the row matching "${clientUsername}", NOT any other user. In Sigma panels, look for "Renovar", dropdown menu, or gear/edit icon in the AÇÕES column of the matching row.` :
      `In StarHome panels, there's usually an "操作" (Actions) column with buttons.`;

    const aiRenew = await askAI(
      `You are looking at an IPTV panel account list after searching for "${clientUsername}".
URL: ${dom2.url}
Body: ${(dom2.body || "").substring(0, 800)}
Buttons: ${JSON.stringify(dom2.buttons || []).substring(0, 500)}

I need to RENEW this user's subscription for ${duration} ${durationIn}.
${panelTypeHint}

IMPORTANT: Make sure you target the CORRECT user row (containing "${clientUsername}"). Do NOT click actions for other users.

Respond ONLY JSON: {"action": "click", "sel": "CSS selector or JS expression to click", "useEval": true/false, "reason": "brief"}`, img2,
    );
    console.log(`🤖 AI renew action: ${aiRenew.substring(0, 300)}`);
    const renewAction = parseJSON(aiRenew);

    if (renewAction?.sel) {
      try {
        const clickExpr = renewAction.useEval ? `${renewAction.sel}?.click()` : `document.querySelector('${renewAction.sel}')?.click()`;
        await cdp.send("Runtime.evaluate", { expression: clickExpr, returnByValue: true });
        await wait(3000);
      } catch (e) { console.log(`⚠️ Click error: ${(e as Error).message}`); }
    }

    // Now use AI-driven loop to complete the renewal (fill duration, confirm, etc.)
    const maxSteps = isSigma ? 3 : 5;
    for (let step = 0; step < maxSteps; step++) {
      const stepImg = await screenshot(cdp);
      const stepDom = await extractDOM(cdp);

      const sigmaHint = isSigma ? `
IMPORTANT for Sigma/SlimTV panels:
- If you see a dropdown menu with options like "Renovar", "Editar", "Excluir" — click "Renovar".
- If a dialog opens that is NOT about renewal (like "Nova Mensagem"), close it by clicking the X button or pressing Escape.
- The renewal option is usually in a dropdown triggered by a button in the AÇÕES column.
- Look for "Renovar" specifically, do NOT click "Excluir" (delete) or "Nova Mensagem".
- If you see a renewal form with months/days selector, set it to ${duration} ${durationIn} and confirm.` : '';

      const aiStep = await askAI(
        `You are inside an IPTV panel, renewing user "${clientUsername}" for ${duration} ${durationIn}.
URL: ${stepDom.url} | Title: ${stepDom.title}
Text: ${(stepDom.body || "").substring(0, 500)}
Inputs: ${JSON.stringify(stepDom.inputs || []).substring(0, 400)}
Buttons: ${JSON.stringify(stepDom.buttons || []).substring(0, 400)}

Step ${step + 1}/${maxSteps}. What should I do next?
- If I see a form to set renewal duration/months/days, fill it with ${duration} and submit.
- If I see a confirmation dialog (success/ok), confirm it.
- If the renewal is complete (success message), report done.
- If on the account list, find the action button for "${clientUsername}" specifically.
${sigmaHint}

Respond ONLY JSON: {"done":false,"action":{"type":"click|type|navigate","sel":"CSS selector","text":"text if typing","url":"if navigate","useEval":false},"reason":"brief"}
OR: {"done":true,"success":true/false,"message":"result"}`, stepImg,
      );

      console.log(`🤖 Renew step ${step + 1}: ${aiStep.substring(0, 200)}`);
      const stepParsed = parseJSON(aiStep);
      if (!stepParsed) { await wait(2000); continue; }

      if (stepParsed.done) {
        return { success: stepParsed.success === true, message: stepParsed.message, error: stepParsed.success ? undefined : stepParsed.message };
      }

      const act = stepParsed.action;
      if (!act) { await wait(2000); continue; }

      try {
        if (act.type === "click" && act.sel) {
          if (act.useEval) {
            await cdp.send("Runtime.evaluate", { expression: `${act.sel}?.click()`, returnByValue: true });
          } else {
            // Use physical click for better reliability
            const coordExpr = `(function(){ const el=document.querySelector('${act.sel}'); if(!el) return 'null'; const r=el.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2}); })()`;
            const coordResult = await cdp.send("Runtime.evaluate", { expression: coordExpr, returnByValue: true });
            const coordVal = coordResult.result?.value;
            if (coordVal && coordVal !== 'null') {
              const coords = JSON.parse(coordVal);
              await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
              await new Promise(r => setTimeout(r, 50));
              await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
            } else {
              await cdp.send("Runtime.evaluate", { expression: `document.querySelector('${act.sel}')?.click()`, returnByValue: true });
            }
          }
        } else if (act.type === "type" && act.sel && act.text) {
          await cdpType(cdp, act.sel, act.text);
        } else if (act.type === "navigate" && act.url) {
          await cdp.send("Page.navigate", { url: act.url });
        }
      } catch (e) { console.log(`⚠️ Action error: ${(e as Error).message}`); }

      await wait(3000);
    }

    return { success: false, error: "Não foi possível completar a renovação no limite de passos." };
  }

  // Uniplay / gestordefender: deterministic flow
  // Step 1: Use tipoPainel if provided, otherwise choose routes by provider
  const tipoPainel = (options as any)?.tipoPainel;
  const provedor = String((options as any)?.provedor || '').toLowerCase();
  const sections = tipoPainel === 'p2p'
    ? ['users-p2p']
    : tipoPainel === 'iptv'
      ? ['users-iptv']
      : (provedor === 'koffice-v2' || provedor === 'koffice-api')
        ? ['customers', 'clients', 'users-iptv', 'users-p2p']
        : ['users-iptv', 'users-p2p'];
  const cleanBase = baseUrl.replace(/\/$/, '');

  for (const section of sections) {
    const listUrl = `${cleanBase}/#/${section}`;
    console.log(`📋 Navegando para: ${listUrl}`);
    await cdp.send("Page.navigate", { url: listUrl });
    await wait(5000);

    // Step 2: Type username in "Pesquisar usuário" search field
    console.log(`🔍 Pesquisando "${clientUsername}" em ${section}...`);
    const searchResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        // Find the search input (placeholder "Pesquisar usuário" or similar)
        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type="hidden"]):not([type="password"]):not([type="checkbox"]):not([type="radio"])');
        for (const inp of inputs) {
          const ph = (inp.placeholder || '').toLowerCase();
          if (ph.includes('pesquisar') || ph.includes('buscar') || ph.includes('search') || ph.includes('usuário') || ph.includes('usuario')) {
            inp.focus();
            inp.value = '';
            const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
            if(nSet) nSet.call(inp, ${JSON.stringify(clientUsername)});
            else inp.value = ${JSON.stringify(clientUsername)};
            inp.dispatchEvent(new Event('input',{bubbles:true}));
            inp.dispatchEvent(new Event('change',{bubbles:true}));
            inp.dispatchEvent(new Event('keyup',{bubbles:true}));
            return JSON.stringify({ok: true, method: 'placeholder', ph: inp.placeholder});
          }
        }
        // Fallback: last input on page (usually the search field at the bottom/right)
        if (inputs.length > 0) {
          const inp = inputs[inputs.length - 1];
          inp.focus();
          inp.value = '';
          const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
          if(nSet) nSet.call(inp, ${JSON.stringify(clientUsername)});
          else inp.value = ${JSON.stringify(clientUsername)};
          inp.dispatchEvent(new Event('input',{bubbles:true}));
          inp.dispatchEvent(new Event('change',{bubbles:true}));
          inp.dispatchEvent(new Event('keyup',{bubbles:true}));
          return JSON.stringify({ok: true, method: 'last-input', count: inputs.length});
        }
        return JSON.stringify({ok: false});
      })()`,
      returnByValue: true,
    });
    const searchRes = JSON.parse(searchResult.result?.value || "{}");
    console.log(`📝 Search input: ${JSON.stringify(searchRes)}`);

    // Also try pressing Enter to trigger search
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await wait(4000);

    // Step 3: Check if user appears in the table
    const tableCheck = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const body = document.body?.innerText || '';
        // Check if the username appears in the page content (table)
        const found = body.includes(${JSON.stringify(clientUsername)});
        // Check for "no data" indicators
        const empty = body.match(/nenhum registro|no data|sem resultados|no matching|0 registros/i);
        // Look for the +30 button
        const btns = document.querySelectorAll('button, a, span');
        let plus30Btn = null;
        let plus30Index = -1;
        for (let i = 0; i < btns.length; i++) {
          const t = (btns[i].textContent || '').trim();
          if (t === '+30') {
            plus30Btn = btns[i];
            plus30Index = i;
            break;
          }
        }
        return JSON.stringify({
          found: found,
          empty: !!empty,
          hasPlus30: !!plus30Btn,
          plus30Index: plus30Index,
          bodySnippet: body.substring(0, 300)
        });
      })()`,
      returnByValue: true,
    });
    const tableRes = JSON.parse(tableCheck.result?.value || "{}");
    console.log(`📊 ${section}: found=${tableRes.found}, empty=${tableRes.empty}, +30=${tableRes.hasPlus30}`);

    if (!tableRes.found || tableRes.empty) {
      console.log(`⚠️ Usuário não encontrado em ${section}, tentando próxima seção...`);
      continue;
    }

    // Step 4: Determine renewal method based on duration
    const isOneMonth = (duration === 1 && durationIn === 'months') || (duration === 30 && durationIn === 'days');

    if (isOneMonth && tableRes.hasPlus30) {
      // ===== FAST PATH: +30 button for 1 month =====
      console.log(`🖱️ Clicando +30 (1 mês)...`);
      const clickResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const btns = document.querySelectorAll('button, a, span');
          for (const b of btns) {
            if ((b.textContent || '').trim() === '+30') {
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return JSON.stringify({x: rect.x + rect.width/2, y: rect.y + rect.height/2});
              }
            }
          }
          return 'null';
        })()`,
        returnByValue: true,
      });
      const clickCoords = clickResult.result?.value;
      if (clickCoords && clickCoords !== 'null') {
        const coords = JSON.parse(clickCoords);
        console.log(`🖱️ Click +30 at (${coords.x}, ${coords.y})`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
        await wait(3000);
        await confirmDialogIfPresent(cdp);
        await wait(2000);
        return await verifyRenewalResult(cdp, clientUsername, section);
      }
    }

    // ===== ESTENDER FLOW: click ⋮ → Estender → select month → confirm =====
    const durationMonths = durationIn === 'days' ? Math.ceil(duration / 30) : duration;
    console.log(`📋 Usando fluxo "Estender" para ${durationMonths} mês(es)...`);

    // Step 4a: Find and click the ⋮ (3 dots) button in the user's row
    const dotsResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          if (!row.textContent.includes(${JSON.stringify(clientUsername)})) continue;
          // Look for ⋮ icon or small button after +30
          const els = row.querySelectorAll('button, a, span, i');
          let foundPlus30 = false;
          for (const el of els) {
            const t = (el.textContent || '').trim();
            if (t === '+30') { foundPlus30 = true; continue; }
            if (foundPlus30) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2});
              }
            }
          }
          // Fallback: look for ⋮ character or kebab icon
          for (const el of els) {
            const t = (el.textContent || '').trim();
            const cls = (el.className || '').toLowerCase();
            if (t === '⋮' || t === '︙' || t === '...' || cls.includes('dots') || cls.includes('more') || cls.includes('kebab') || cls.includes('ellipsis')) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2});
              }
            }
          }
        }
        return JSON.stringify({found: false});
      })()`,
      returnByValue: true,
    });
    const dotsRes = JSON.parse(dotsResult.result?.value || "{}");

    if (!dotsRes.found) {
      console.log(`⚠️ Botão ⋮ não encontrado em ${section}`);
      continue;
    }

    console.log(`🖱️ Click ⋮ at (${dotsRes.x}, ${dotsRes.y})`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: dotsRes.x, y: dotsRes.y, button: "left", clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dotsRes.x, y: dotsRes.y, button: "left", clickCount: 1 });
    await wait(2000);

    // Step 4b: Click "Estender" in the dropdown menu
    console.log(`🖱️ Clicando "Estender"...`);
    const estenderResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const items = document.querySelectorAll('button, a, li, div, span');
        for (const el of items) {
          const t = (el.textContent || '').trim();
          if (t === 'Estender' || t === 'Extend') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.y > 0) {
              return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2});
            }
          }
        }
        return JSON.stringify({found: false});
      })()`,
      returnByValue: true,
    });
    const estenderRes = JSON.parse(estenderResult.result?.value || "{}");

    if (!estenderRes.found) {
      console.log(`⚠️ "Estender" não encontrado no menu`);
      continue;
    }

    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: estenderRes.x, y: estenderRes.y, button: "left", clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: estenderRes.x, y: estenderRes.y, button: "left", clickCount: 1 });
    await wait(3000);

    // Step 4c: Select the correct month in the dropdown
    const monthLabels: Record<number, string> = {
      1: '1 mês', 2: '2 meses', 3: '3 meses', 4: '4 meses', 6: '6 meses', 12: '12 meses',
    };
    const targetLabel = (duration === 15 && durationIn === 'days') ? '15 dias' : (monthLabels[durationMonths] || `${durationMonths} mês`);
    console.log(`📋 Selecionando "${targetLabel}" no dropdown...`);

    // Click the select/dropdown to open it
    const selectClickResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const modal = document.querySelector('.modal, [class*="modal"], [role="dialog"], .swal2-container, .popup, [class*="dialog"]');
        const ctx = modal || document;
        const selects = ctx.querySelectorAll('select');
        if (selects.length > 0) {
          const sel = selects[0];
          const rect = sel.getBoundingClientRect();
          return JSON.stringify({type: 'native', x: rect.x + rect.width/2, y: rect.y + rect.height/2});
        }
        // Custom dropdown trigger
        const divs = ctx.querySelectorAll('div, button, span');
        for (const d of divs) {
          const t = (d.textContent || '').trim();
          if (t.match(/\\d+\\s*(mês|meses|dias|crédito)/i) && !t.includes('Estender Usuário')) {
            const rect = d.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 0 && rect.height < 60) {
              return JSON.stringify({type: 'custom', x: rect.x + rect.width/2, y: rect.y + rect.height/2});
            }
          }
        }
        return JSON.stringify({type: 'none'});
      })()`,
      returnByValue: true,
    });
    const selectRes = JSON.parse(selectClickResult.result?.value || "{}");
    console.log(`📋 Dropdown type: ${selectRes.type}`);

    if (selectRes.type === 'native') {
      // Set value on native <select>
      const setResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const modal = document.querySelector('.modal, [class*="modal"], [role="dialog"], .swal2-container, .popup, [class*="dialog"]');
          const ctx = modal || document;
          const sel = ctx.querySelector('select');
          if (!sel) return 'no-select';
          const options = sel.querySelectorAll('option');
          for (const opt of options) {
            const t = (opt.textContent || '').trim().toLowerCase();
            if (t.includes(${JSON.stringify(targetLabel.toLowerCase())})) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change', {bubbles: true}));
              sel.dispatchEvent(new Event('input', {bubbles: true}));
              return 'selected: ' + opt.textContent.trim();
            }
          }
          for (const opt of options) {
            const t = (opt.textContent || '').trim();
            if (t.startsWith('${durationMonths}')) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change', {bubbles: true}));
              return 'fallback: ' + opt.textContent.trim();
            }
          }
          return 'not-found';
        })()`,
        returnByValue: true,
      });
      console.log(`📋 Select result: ${setResult.result?.value}`);
    } else if (selectRes.type === 'custom') {
      // Click to open, then select option
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: selectRes.x, y: selectRes.y, button: "left", clickCount: 1 });
      await new Promise(r => setTimeout(r, 50));
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: selectRes.x, y: selectRes.y, button: "left", clickCount: 1 });
      await wait(1500);

      const optionResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const items = document.querySelectorAll('li, div, option, span, a');
          for (const el of items) {
            const t = (el.textContent || '').trim().toLowerCase();
            if (t.includes(${JSON.stringify(targetLabel.toLowerCase())}) && el.offsetParent !== null) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.height < 60) {
                return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: el.textContent.trim()});
              }
            }
          }
          return JSON.stringify({found: false});
        })()`,
        returnByValue: true,
      });
      const optRes = JSON.parse(optionResult.result?.value || "{}");
      if (optRes.found) {
        console.log(`🖱️ Selecionando "${optRes.text}"`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: optRes.x, y: optRes.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: optRes.x, y: optRes.y, button: "left", clickCount: 1 });
      } else {
        console.log(`⚠️ Opção "${targetLabel}" não encontrada`);
      }
    }
    await wait(2000);

    // Step 4d: Click "Estender" confirm button in the modal
    console.log(`🖱️ Clicando botão "Estender" para confirmar...`);
    const confirmBtnResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const modal = document.querySelector('.modal, [class*="modal"], [role="dialog"], .swal2-container, .popup, [class*="dialog"]');
        const ctx = modal || document;
        const btns = ctx.querySelectorAll('button, a, input[type="submit"]');
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          if (t === 'Estender' || t === 'Extend' || t === 'Confirmar' || t === 'Confirm') {
            const rect = b.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: t});
            }
          }
        }
        return JSON.stringify({found: false});
      })()`,
      returnByValue: true,
    });
    const confirmBtnRes = JSON.parse(confirmBtnResult.result?.value || "{}");

    if (confirmBtnRes.found) {
      console.log(`🖱️ Click "${confirmBtnRes.text}" at (${confirmBtnRes.x}, ${confirmBtnRes.y})`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: confirmBtnRes.x, y: confirmBtnRes.y, button: "left", clickCount: 1 });
      await new Promise(r => setTimeout(r, 50));
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: confirmBtnRes.x, y: confirmBtnRes.y, button: "left", clickCount: 1 });
      await wait(3000);
    }

    await confirmDialogIfPresent(cdp);
    await wait(2000);
    return await verifyRenewalResult(cdp, clientUsername, section);
  }

  return { success: false, error: `Usuário "${clientUsername}" não encontrado em IPTV nem P2P.` };
}

// ==================== Handler ====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let cdp: CDPSession | null = null;

  try {
    const body = await req.json();
    const { action } = body;
    let url = body.url;
    let username = body.username;
    let password = body.password;

    // ==================== Check Cached Session (fast path ~2s) ====================
    if (action === "check_cached_session" && body.panelId) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: cached } = await sb.from("cached_panel_sessions")
        .select("*")
        .eq("painel_id", body.panelId)
        .gt("expires_at", new Date().toISOString())
        .single();
      
      if (!cached) {
        return new Response(JSON.stringify({ success: false, reason: "no_cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate cached session by making a quick API call
      const { data: panel } = await sb.from("paineis_integracao").select("url, provedor, user_id").eq("id", body.panelId).single();
      if (!panel) {
        return new Response(JSON.stringify({ success: false, reason: "panel_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const providerId = panel.provedor || cached.provedor || 'unknown';

      // JWT cache validation
      if (cached.token_type === 'jwt' && cached.access_token && cached.access_token !== 'browser_session') {
        // Uniplay: validar token com endpoint real
        if (providerId === 'uniplay') {
          try {
            const UNIPLAY_API = 'https://gesapioffice.com';
            const dashResp = await withTimeout(fetch(`${UNIPLAY_API}/api/dash-reseller`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${cached.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
              },
            }), 8000, "cached token validation");
            
            if (dashResp.ok) {
              const dashText = await dashResp.text();
              let dashJson: any = null;
              try { dashJson = JSON.parse(dashText); } catch {}
              console.log(`✅ Cached session valid! Credits: ${dashJson?.credits ?? 'unknown'}`);
              return new Response(JSON.stringify({
                success: true,
                cached: true,
                method: "Cached Session (instant)",
                account: { status: 'Active', credits: dashJson?.credits ?? dashJson?.data?.credits ?? null },
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            console.log(`⚠️ Cached token expired (status: ${dashResp.status})`);
            await dashResp.text(); // consume body
          } catch (e) {
            console.log(`⚠️ Cached token check failed: ${(e as Error).message}`);
          }
        } else {
          // Sigma/Outros provedores: considerar JWT válido enquanto não expirar
          const cacheAge = Date.now() - new Date(cached.created_at).getTime();
          console.log(`✅ JWT cache trusted for provider ${providerId} (${Math.round(cacheAge / 60000)}min old, expires: ${cached.expires_at})`);
          return new Response(JSON.stringify({
            success: true,
            cached: true,
            method: "Cached Session (JWT)",
            account: { status: 'Active' },
            extra_data: cached.extra_data,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // For cookies-based: trust the expires_at (already filtered by query above)
      if (cached.token_type === 'cookies' || cached.access_token === 'browser_session') {
        const cacheAge = Date.now() - new Date(cached.created_at).getTime();
        console.log(`✅ Cookie/browser cache valid (${Math.round(cacheAge / 60000)}min old, expires: ${cached.expires_at})`);
        return new Response(JSON.stringify({
          success: true,
          cached: true,
          method: "Cached Session (cookies)",
          account: { status: 'Active' },
          extra_data: cached.extra_data,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Cache expired/invalid, delete it
      await sb.from("cached_panel_sessions").delete().eq("id", cached.id);
      return new Response(JSON.stringify({ success: false, reason: "cache_expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve panel credentials
    let proxySessionId: string | null = null;
    let supabase: any = null;
    let panelProvedor: string | undefined;
    if (body.panelId) {
      supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: panel } = await supabase.from("paineis_integracao").select("*").eq("id", body.panelId).single();
      if (!panel) throw new Error("Painel não encontrado");
      url = url || panel.url;
      panelProvedor = panel.provedor;

      // Get or generate proxy_session_id for sticky IP
      if (panel.proxy_session_id) {
        proxySessionId = panel.proxy_session_id;
      } else {
        // Generate a deterministic session ID based on panel ID (stays consistent)
        proxySessionId = `panel_${body.panelId.replace(/-/g, '').substring(0, 16)}`;
        // Persist it
        await supabase.from("paineis_integracao").update({ proxy_session_id: proxySessionId }).eq("id", body.panelId);
        console.log(`🔑 Proxy session ID gerado: ${proxySessionId}`);
      }

      if (panel.usuario === "vault" || panel.senha === "vault") {
        const authHeader = req.headers.get('Authorization') || '';
        const userToken = authHeader.replace('Bearer ', '');
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || '';
        let vaultClient = supabase;
        let rpcName = 'admin_get_gateway_secret';
        // If the caller is using a user token (not service role), use user-scoped RPC
        if (userToken && userToken !== serviceRoleKey && userToken.startsWith('eyJ')) {
          const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          vaultClient = createClient(Deno.env.get("SUPABASE_URL")!, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${userToken}` } },
          });
          rpcName = 'get_gateway_secret';
        }
        // Otherwise keep service role client with admin_get_gateway_secret
        const [uR, sR] = await Promise.all([
          vaultClient.rpc(rpcName, { p_user_id: panel.user_id, p_gateway: "painel", p_secret_name: `usuario_${body.panelId}` }),
          vaultClient.rpc(rpcName, { p_user_id: panel.user_id, p_gateway: "painel", p_secret_name: `senha_${body.panelId}` }),
        ]);
        username = uR.data || panel.usuario;
        password = sR.data || panel.senha;
      } else {
        username = username || panel.usuario;
        password = password || panel.senha;
      }
    }

    if (!url || !username || !password) {
      return new Response(JSON.stringify({ success: false, error: "URL, username e password obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🚀 ${action} | ${url}`);
    
    // For submit_2fa_code: try to reconnect to the original session first
    let bbId: string;
    let reconnected = false;
    if (action === "submit_2fa_code" && body.browserbaseSessionId) {
      try {
        console.log(`🔄 Tentando reconectar à sessão original: ${body.browserbaseSessionId}`);
        const reconnectUrl = await reconnectBrowserbaseSession(body.browserbaseSessionId);
        cdp = new CDPSession();
        await cdp.connect(reconnectUrl);
        // Must re-attach to the page target after reconnecting via new WebSocket
        await cdp.attachToPage();
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        bbId = body.browserbaseSessionId;
        reconnected = true;
        console.log(`✅ Reconectado à sessão original!`);
      } catch (reconnErr) {
        console.log(`⚠️ Reconexão falhou: ${(reconnErr as Error).message}. Criando nova sessão com keepAlive...`);
        const newSession = await createBrowserbaseSession(proxySessionId, true);
        bbId = newSession.sessionId;
        cdp = new CDPSession();
        await cdp.connect(newSession.connectUrl);
        await cdp.attachToPage();
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
      }
    } else {
      const session = await createBrowserbaseSession(proxySessionId, action === 'test_connection');
      bbId = session.sessionId;
      cdp = new CDPSession();
      await cdp.connect(session.connectUrl);
      await cdp.attachToPage();
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Network.enable");
    }

    if (action === "test_connection") {
      const result = await doLogin(cdp, url, username, password);

      // Cache session after successful login (extract cookies from browser)
      if (result.success && !result.error && body.panelId && supabase) {
        try {
          // Prefer CDP Network cookies (inclui HttpOnly, ex: cf_clearance)
          let browserCookies = '';
          try {
            const allCookies = await cdp.send("Network.getAllCookies");
            const cookieArr = Array.isArray(allCookies?.cookies) ? allCookies.cookies : [];
            browserCookies = cookieArr
              .filter((c: any) => c?.name && typeof c.value !== 'undefined')
              .map((c: any) => `${c.name}=${c.value}`)
              .join('; ');
          } catch (cookieErr) {
            console.log(`⚠️ Network.getAllCookies falhou: ${(cookieErr as Error).message}`);
          }

          // Fallback para cookies JS (não inclui HttpOnly)
          if (!browserCookies) {
            const cookieResult = await cdp.send("Runtime.evaluate", {
              expression: `document.cookie`,
              returnByValue: true,
            });
            browserCookies = cookieResult.result?.value || '';
          }
          
          // Also try to extract JWT token from localStorage/sessionStorage
          const tokenResult = await cdp.send("Runtime.evaluate", {
            expression: `(function(){
              try {
                const ls = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token') || '';
                const ss = sessionStorage.getItem('token') || sessionStorage.getItem('access_token') || sessionStorage.getItem('auth_token') || '';
                return JSON.stringify({localStorage: ls, sessionStorage: ss});
              } catch(e) { return '{}'; }
            })()`,
            returnByValue: true,
          });
          const tokens = JSON.parse(tokenResult.result?.value || '{}');
          const accessToken = tokens.localStorage || tokens.sessionStorage || browserCookies || 'browser_session';
          
          // Get current URL (dashboard URL after login)
          const afterUrl = await cdp.send("Runtime.evaluate", {
            expression: `window.location.href`,
            returnByValue: true,
          });
          const dashboardUrl = afterUrl.result?.value || '';
          
          console.log(`💾 Caching session for panel ${body.panelId} (cookies: ${browserCookies.length}b, token: ${accessToken.length > 50 ? accessToken.substring(0, 50) + '...' : accessToken})`);
          
          await supabase.from('cached_panel_sessions').upsert({
            user_id: body.userId || (await supabase.from('paineis_integracao').select('user_id').eq('id', body.panelId).single()).data?.user_id,
            painel_id: body.panelId,
            provedor: (await supabase.from('paineis_integracao').select('provedor').eq('id', body.panelId).single()).data?.provedor || 'universal',
            access_token: accessToken,
            token_type: tokens.localStorage || tokens.sessionStorage ? 'jwt' : 'cookies',
            cookies: browserCookies || null,
            extra_data: { dashboard_url: dashboardUrl, cached_at: new Date().toISOString() },
            expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'user_id,painel_id' });
          
          console.log(`✅ Session cached successfully`);
        } catch (cacheErr) {
          console.log(`⚠️ Cache save failed: ${(cacheErr as Error).message}`);
        }
      }

      // If 2FA detected, don't close the session — keep it alive for submit_2fa_code to reconnect
      if (result.success && result.error) {
        console.log(`🔐 2FA detected — keeping Browserbase session ${bbId} alive for code submission`);
        // Don't close CDP — session stays alive (120s timeout)
      } else {
        cdp.close();
      }
      return new Response(JSON.stringify({
        ...result,
        browserbaseSessionId: bbId,
        proxySessionId: proxySessionId,
        cached: result.success && !result.error,
        method: "AI Browser Agent",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== List Clients (Sigma) ====================
    if (action === "list_clients") {
      let loginOk = false;

      // Step 0: Try cached session first (cookies/JWT injection into browser)
      if (body.panelId && supabase) {
        try {
          const { data: cached } = await supabase.from("cached_panel_sessions")
            .select("*")
            .eq("painel_id", body.panelId)
            .gt("expires_at", new Date().toISOString())
            .single();

          if (cached && (cached.cookies || cached.access_token)) {
            console.log(`⚡ list_clients: tentando sessão cacheada...`);
            const cleanBase = url.replace(/\/$/, '');

            // Inject cookies into the browser via CDP
            if (cached.cookies) {
              const cookiePairs = cached.cookies.split('; ').filter(Boolean);
              const domain = new URL(cleanBase).hostname;
              for (const pair of cookiePairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx < 1) continue;
                const name = pair.substring(0, eqIdx);
                const value = pair.substring(eqIdx + 1);
                try {
                  await cdp.send("Network.setCookie", { name, value, domain, path: '/', secure: true, httpOnly: false });
                } catch {}
              }
              console.log(`🍪 list_clients: ${cookiePairs.length} cookies injetados`);
            }

            // Inject JWT into localStorage if available
            if (cached.access_token && cached.access_token !== 'browser_session' && cached.token_type === 'jwt') {
              await cdp.send("Page.navigate", { url: `${cleanBase}/` });
              await wait(3000);
              await cdp.send("Runtime.evaluate", {
                expression: `localStorage.setItem('token', ${JSON.stringify(cached.access_token)}); localStorage.setItem('access_token', ${JSON.stringify(cached.access_token)});`,
                returnByValue: true,
              });
              console.log(`🔑 list_clients: JWT injetado no localStorage`);
            }

            // Navigate directly to /#/customers
            await cdp.send("Page.navigate", { url: `${cleanBase}/#/customers` });
            await wait(6000);

            // Check if we're on the customers page (not redirected to login)
            const cacheCheck = await cdp.send("Runtime.evaluate", {
              expression: `JSON.stringify({ url: location.href, hasTable: document.querySelectorAll('table tbody tr, .v-data-table tbody tr').length, body: (document.body?.innerText || '').substring(0, 300) })`,
              returnByValue: true,
            });
            const cacheResult = JSON.parse(cacheCheck.result?.value || '{}');
            const onLogin = (cacheResult.url || '').match(/login|sign-in|signin/i);
            console.log(`📊 list_clients cache: url=${cacheResult.url}, rows=${cacheResult.hasTable}, onLogin=${!!onLogin}`);

            if (!onLogin && cacheResult.hasTable > 0) {
              console.log(`✅ list_clients: sessão cacheada válida! Continuando extração...`);
              loginOk = true;
            } else {
              console.log(`⚠️ list_clients: cache inválido ou expirado, tentando login...`);
            }
          }
        } catch (cacheErr) {
          console.log(`⚠️ list_clients cache error: ${(cacheErr as Error).message}`);
        }
      }

      // Step 1: Fresh login if cache failed
      if (!loginOk) {
        const loginResult = await doLogin(cdp, url, username, password);
        if (!loginResult.success || loginResult.error) {
          cdp.close();
          return new Response(JSON.stringify({ success: false, error: loginResult.error || 'Login falhou', clients: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        loginOk = true;
      }

      console.log("📋 list_clients: login OK, navegando para /#/customers...");

      // Navigate to the customers page (only if not already there from cache)
      const currentUrlCheck = await cdp.send("Runtime.evaluate", { expression: `location.href`, returnByValue: true });
      const currentHref = currentUrlCheck.result?.value || '';
      if (!currentHref.includes('/customers')) {
        const cleanUrl = url.replace(/\/$/, '');
        await cdp.send("Page.navigate", { url: `${cleanUrl}/#/customers` });
        await wait(5000);
      } else {
        console.log(`📋 list_clients: já em /#/customers via cache`);
      }

      // Wait for table to render (up to 15s)
      for (let tw = 0; tw < 5; tw++) {
        const checkTable = await cdp.send("Runtime.evaluate", {
          expression: `document.querySelectorAll('table tbody tr, .v-data-table tbody tr, [class*="customer"] tr, [class*="client"] tr').length`,
          returnByValue: true,
        });
        const rowCount = checkTable.result?.value || 0;
        console.log(`🔍 list_clients: table check ${tw+1}/5 → ${rowCount} rows`);
        if (rowCount > 0) break;
        await wait(3000);
      }

      // Try API fetch first (inside browser with session cookies)
      const fetchClientsScript = `
(async function() {
  const endpoints = ['/api/lines', '/api/line', '/lines', '/line', '/api/customers', '/customers', '/api/clients', '/clients', '/list'];
  
  for (const ep of endpoints) {
    try {
      let allClients = [];
      let page = 1;
      let maxPage = 20;
      
      while (page <= maxPage) {
        const url = ep + '?page=' + page;
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (!resp.ok) break;
        
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { break; }
        
        const items = json?.data?.data || json?.data?.items || json?.data?.results || json?.data || json?.lines || json?.line || json?.customers || json?.clients || json?.results || (Array.isArray(json) ? json : []);
        const arr = Array.isArray(items) ? items : (items && typeof items === 'object' ? Object.values(items) : []);
        
        if (!Array.isArray(arr) || arr.length === 0) {
          if (page === 1) break;
          break;
        }
        
        for (const c of arr) {
          if (!c || typeof c !== 'object') continue;
          if (c.is_reseller === true || c.is_reseller === 1 || c.is_restreamer === true || c.is_restreamer === 1) continue;
          if (c.type === 'reseller' || c.role === 'reseller' || c.member_group_id === 2) continue;
          
          allClients.push({
            name: c.name || c.full_name || c.display_name || c.nome || c.client_name || c.user_name || '',
            username: c.username || c.user || c.login || c.client_login || '',
            password: c.password || c.pass || c.client_password || '',
            mac: c.mac_address || c.mac || c.device_mac || '',
            exp_date: c.expires_at_tz || c.expires_at || c.expiration || c.exp_date || c.due_date || '',
            max_connections: Number(c.connections || c.max_connections || c.max_connection || c.max_conn || 1) || 1,
            status: c.status || c.state || (c.is_active ? 'active' : 'inactive'),
          });
        }
        
        if (json?.last_page && page >= json.last_page) break;
        if (json?.meta?.last_page && page >= json.meta.last_page) break;
        page++;
      }
      
      if (allClients.length > 0) {
        return JSON.stringify({ success: true, endpoint: ep, clients: allClients, source: 'api' });
      }
    } catch (e) {
      // continue to next endpoint
    }
  }
  
  return JSON.stringify({ success: false, clients: [], source: 'api' });
})()
`;

      const fetchResult = await cdp.send("Runtime.evaluate", {
        expression: fetchClientsScript,
        returnByValue: true,
        awaitPromise: true,
      });

      const apiResultText = fetchResult.result?.value || '{}';
      let apiParsed;
      try { apiParsed = JSON.parse(apiResultText); } catch { apiParsed = { success: false, clients: [] }; }

      if (apiParsed.success && apiParsed.clients?.length > 0) {
        console.log(`✅ list_clients: ${apiParsed.clients.length} clientes via API (${apiParsed.endpoint})`);
        cdp.close();
        return new Response(JSON.stringify({
          success: true, clients: apiParsed.clients, total: apiParsed.clients.length,
          endpoint: apiParsed.endpoint, method: "AI Browser Agent",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("📋 list_clients: API endpoints falharam, extraindo da tabela DOM...");

      // Fallback: scrape the rendered DOM table with pagination
      const scrapeTableScript = `
(async function() {
  const allClients = [];
  const seenUsernames = new Set();
  let pageNum = 0;
  const maxPages = 20;

  function extractFromTable() {
    const rows = document.querySelectorAll('table tbody tr, .v-data-table tbody tr');
    const clients = [];
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      
      // Try to extract data from cells - adapt to Sigma's table structure
      const fullText = row.innerText || '';
      if (!fullText.trim() || fullText.includes('Nenhum') || fullText.includes('No data')) continue;
      
      // Sigma table columns: USUÁRIO, DATAS, SITUAÇÃO, DETALHES, AÇÕES
      const cellTexts = Array.from(cells).map(c => (c.innerText || '').trim());
      
      // Username is typically in the first cell
      let username = '';
      let name = '';
      let expDate = '';
      let status = '';
      let plan = '';
      let connections = 1;
      
      // First cell: username + service type
      if (cellTexts[0]) {
        const lines = cellTexts[0].split('\\n').map(l => l.trim()).filter(Boolean);
        username = lines[0] || '';
        // Filter out non-username text
        if (/^\\d+$/.test(username)) username = username; // numeric username OK
      }
      
      // Second cell: dates (expiry date)
      if (cellTexts[1]) {
        const dateMatch = cellTexts[1].match(/(\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2})/);
        if (dateMatch) expDate = dateMatch[1];
      }
      
      // Third cell: situação (status)  
      if (cellTexts[2]) {
        const sText = cellTexts[2].toLowerCase();
        if (sText.includes('ativo') || sText.includes('active')) status = 'active';
        else if (sText.includes('vencido') || sText.includes('expired')) status = 'expired';
        else if (sText.includes('desativado') || sText.includes('disabled')) status = 'disabled';
        else status = cellTexts[2];
      }
      
      // Fourth cell: details (name, plan, connections)
      if (cellTexts[3]) {
        const detailLines = cellTexts[3].split('\\n').map(l => l.trim()).filter(Boolean);
        for (const line of detailLines) {
          if (line.toLowerCase().startsWith('plano:') || line.toLowerCase().startsWith('plan:')) {
            plan = line.replace(/^(plano|plan):\\s*/i, '');
          } else if (line.toLowerCase().startsWith('conexões:') || line.toLowerCase().startsWith('connections:')) {
            connections = parseInt(line.replace(/\\D/g, '')) || 1;
          } else if (!name && !line.startsWith('R$') && !/^\\d+$/.test(line)) {
            name = line;
          }
        }
      }
      
      if (username && !seenUsernames.has(username)) {
        seenUsernames.add(username);
        clients.push({ name, username, password: '', mac: '', exp_date: expDate, max_connections: connections, status, plan });
      }
    }
    return clients;
  }

  // Extract current page
  let pageClients = extractFromTable();
  for (const c of pageClients) allClients.push(c);
  pageNum++;

  // Handle pagination - click "next" button
  while (pageNum < maxPages) {
    const nextBtn = document.querySelector('[aria-label="Next page"], [aria-label="Próxima página"], button.v-pagination__next, .pagination .next a, nav[aria-label*="pagination"] button:last-child, .v-data-footer__icons-after button:not([disabled])');
    if (!nextBtn || nextBtn.disabled || nextBtn.getAttribute('disabled') !== null) break;
    
    const prevCount = allClients.length;
    nextBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    pageClients = extractFromTable();
    if (pageClients.length === 0) break;
    
    let newAdded = 0;
    for (const c of pageClients) {
      if (!seenUsernames.has(c.username)) {
        seenUsernames.add(c.username);
        allClients.push(c);
        newAdded++;
      }
    }
    if (newAdded === 0) break;
    pageNum++;
  }

  return JSON.stringify({ success: allClients.length > 0, clients: allClients, pages: pageNum, source: 'dom' });
})()
`;

      const scrapeResult = await cdp.send("Runtime.evaluate", {
        expression: scrapeTableScript,
        returnByValue: true,
        awaitPromise: true,
      });

      cdp.close();

      const scrapeText = scrapeResult.result?.value || '{}';
      let scrapeParsed;
      try { scrapeParsed = JSON.parse(scrapeText); } catch { scrapeParsed = { success: false, clients: [] }; }

      console.log(`📊 list_clients: DOM scrape → ${scrapeParsed.clients?.length || 0} clientes (${scrapeParsed.pages || 0} páginas, source: ${scrapeParsed.source})`);

      return new Response(JSON.stringify({
        success: scrapeParsed.success || false,
        clients: scrapeParsed.clients || [],
        total: scrapeParsed.clients?.length || 0,
        method: "AI Browser Agent",
        source: scrapeParsed.source || 'dom',
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== Resend 2FA Code ====================
    if (action === "resend_2fa_code") {
      const loginResult = await doLogin(cdp, url, username, password);
      cdp.close();
      if (loginResult.error && loginResult.error.match(/2FA|verificação|identity/i)) {
        return new Response(JSON.stringify({
          success: true,
          message: "Código reenviado! Verifique seu e-mail.",
          browserbaseSessionId: bbId,
          method: "AI Browser Agent",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (loginResult.success && !loginResult.error) {
        return new Response(JSON.stringify({
          success: true,
          message: "Login realizado sem 2FA. O dispositivo já está autorizado.",
          alreadyAuthorized: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        success: false,
        error: loginResult.error || "Falha ao reenviar código",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== Submit 2FA Verification Code ====================
    if (action === "submit_2fa_code") {
      const verificationCode = body.code;
      if (!verificationCode) {
        cdp.close();
        return new Response(JSON.stringify({ success: false, error: "Código de verificação é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If we reconnected to the original session, the 2FA page should still be visible
      if (!reconnected) {
        // New session — need to do login first (will trigger new 2FA code)
        const loginResult = await doLogin(cdp, url, username, password);
        
        if (loginResult.success && !loginResult.error) {
          cdp.close();
          return new Response(JSON.stringify({
            success: true,
            message: "Dispositivo já está autorizado!",
            alreadyAuthorized: true,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // New session triggered new 2FA → tell user a new code was sent
        if (loginResult.error && loginResult.error.match(/2FA|verificação|identity/i)) {
          cdp.close();
          return new Response(JSON.stringify({
            success: false,
            newCodeSent: true,
            browserbaseSessionId: bbId,
            error: "Sessão expirada. Um NOVO código foi enviado para seu e-mail. Digite o novo código.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      await wait(reconnected ? 1000 : 3000);

      // Screenshot to see current page state
      const pre2faImg = await screenshot(cdp);
      const pre2faDom = await extractDOM(cdp);
      console.log(`📋 2FA page: URL=${pre2faDom.url}, inputs=${pre2faDom.inputs?.length}, buttons=${pre2faDom.buttons?.length}`);
      console.log(`📋 2FA inputs: ${JSON.stringify(pre2faDom.inputs || [])}`);

      // Use AI to find the verification code input and confirm button
      const aiFind2fa = await askAI(
        `This is an Identity Authentication / 2FA verification page. I need to:
1. Find the INPUT field where I should type the verification code (NOT the account, password, or captcha fields)
2. Find the CONFIRM/Submit button to submit the code

Page DOM:
URL: ${pre2faDom.url}
Inputs: ${JSON.stringify(pre2faDom.inputs || [])}
Buttons: ${JSON.stringify(pre2faDom.buttons || [])}
Body text: ${(pre2faDom.body || "").substring(0, 500)}

Respond ONLY JSON: {"codeInputSelector": "CSS selector for code input", "confirmButtonIndex": 0}
The confirmButtonIndex is the index in the buttons array.`, pre2faImg,
      );
      console.log(`🤖 AI 2FA find: ${aiFind2fa.substring(0, 300)}`);
      const ai2fa = parseJSON(aiFind2fa);

      // Type the verification code using cdpType (char by char, reliable for React/Ant Design)
      let codeSelector = ai2fa?.codeInputSelector;
      if (!codeSelector) {
        // Fallback: find input that's not account/password/captcha
        const verifyInput = (pre2faDom.inputs || []).find((i: any) =>
          !(i.id || "").match(/account|password|validateCode/i) &&
          !(i.placeholder || "").match(/account|password/i) &&
          i.type !== 'checkbox',
        );
        codeSelector = verifyInput?.sel;
      }

      if (codeSelector) {
        console.log(`🔢 Digitando código 2FA via cdpType: ${verificationCode} → ${codeSelector}`);
        await cdpType(cdp, codeSelector, verificationCode);
      } else {
        console.log(`⚠️ Input de código não encontrado, tentando fallback...`);
        // Last resort: type into focused element
        for (const ch of verificationCode) {
          await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, code: `Key${ch.toUpperCase()}` });
          await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ch, key: ch, unmodifiedText: ch });
          await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, code: `Key${ch.toUpperCase()}` });
          await new Promise(r => setTimeout(r, 50));
        }
      }

      await wait(1000);

      // Find and click the Confirm button on the 2FA modal using DOM (more reliable than AI coordinates)
      console.log("🔘 Procurando botão Confirm no modal 2FA...");
      const confirmResult = await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          // Find all buttons/links on the page
          const allBtns = document.querySelectorAll('button, a, span[role="button"]');
          let confirmBtn = null;
          for (const b of allBtns) {
            const t = (b.textContent || '').trim();
            // Match "Confirm" but not "Return" or "Login"
            if (t.match(/^Confirm$/i) || t.match(/^确认$/)) {
              // Make sure it's visible
              if (b.offsetParent !== null || b.offsetWidth > 0) {
                confirmBtn = b;
                break;
              }
            }
          }
          if (!confirmBtn) {
            // Fallback: look for button containing "Confirm" text
            for (const b of allBtns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t.includes('confirm') && !t.includes('return') && !t.includes('login')) {
                if (b.offsetParent !== null || b.offsetWidth > 0) {
                  confirmBtn = b;
                  break;
                }
              }
            }
          }
          if (!confirmBtn) return JSON.stringify({found: false});
          const rect = confirmBtn.getBoundingClientRect();
          return JSON.stringify({found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: confirmBtn.textContent?.trim()});
        })()`,
        returnByValue: true,
      });
      const confirmInfo = JSON.parse(confirmResult.result?.value || '{"found":false}');
      
      if (confirmInfo.found) {
        console.log(`🖱️ Click confirm (${confirmInfo.x}, ${confirmInfo.y}): "${confirmInfo.text}"`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: confirmInfo.x, y: confirmInfo.y, button: "left", clickCount: 1 });
        await new Promise(r => setTimeout(r, 50));
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: confirmInfo.x, y: confirmInfo.y, button: "left", clickCount: 1 });
      } else {
        console.log("⚠️ Botão Confirm não encontrado, tentando click genérico...");
        await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t.match(/confirm|submit|verify|ok/i)) { b.click(); return t; }
            }
            return 'none';
          })()`,
          returnByValue: true,
        });
      }

      await wait(10000);

      // Verify result with screenshot + AI
      const afterImg = await screenshot(cdp);
      const afterDom = await extractDOM(cdp);
      const afterUrl = afterDom.url || "";
      const bodyText = afterDom.body || "";
      console.log("📊 After 2FA: URL=" + afterUrl);
      console.log("📊 Body: " + bodyText.substring(0, 300));

      const aiVerify = await askAI(
        `I just submitted a 2FA verification code on an IPTV panel login page.
URL: ${afterUrl}
Page text: ${bodyText.substring(0, 500)}

Did the verification SUCCEED? Look for:
- Dashboard/home page content (success)
- "Device bound successfully" or similar messages (success)
- Error messages like "incorrect code", "expired", "invalid" (failure)
- Still on login page with no progress (failure)

Respond ONLY JSON: {"success": true/false, "reason": "brief explanation"}`, afterImg,
      );
      console.log(`🤖 2FA verify: ${aiVerify.substring(0, 200)}`);
      const verifyResult = parseJSON(aiVerify);

      const isLoggedIn = verifyResult?.success === true || (
        !afterUrl.includes("login") && (
          bodyText.match(/dashboard|painel|welcome|credit|saldo|home|account|cliente/i) ||
          afterUrl.includes("dashboard") || afterUrl.includes("home") || afterUrl.includes("info")
        )
      );
      const hasError = bodyText.match(/incorrect|invalid|expired|expirado|inválido|erro|error|wrong/i);

      cdp.close();

      if (isLoggedIn) {
        if (body.panelId && supabase) {
          await supabase.from("paineis_integracao")
            .update({ verificacao_status: "vinculado" })
            .eq("id", body.panelId);
        }
        return new Response(JSON.stringify({
          success: true,
          message: "Dispositivo vinculado com sucesso!",
          deviceId: bbId,
          deviceName: "Browserbase Agent",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false,
        error: hasError ? "Código inválido ou expirado. Tente novamente." : (verifyResult?.reason || "Não foi possível confirmar o código. Tente reenviar."),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_credits") {
      const loginResult = await doLogin(cdp, url, username, password);
      if (!loginResult.success) {
        cdp.close();
        return new Response(JSON.stringify({ success: false, error: `Login falhou: ${loginResult.error}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // After login, use AI to find credits on the dashboard
      await wait(5000);
      const img = await screenshot(cdp);
      const dom = await extractDOM(cdp);

      const bodyText = (dom.body || "").substring(0, 1500);
      console.log(`📋 Dashboard body: ${bodyText.substring(0, 400)}`);

      const aiCredits = await askAI(
        `You are looking at an IPTV reseller panel dashboard after login.
URL: ${dom.url} | Title: ${dom.title}
Body text: ${bodyText}

This panel shows "Seus Créditos:" section with lines like:
- "Créditos Mensal (Plano Basico): X (1 Crédito = 1 mês)"
- "Créditos Anual (Plano Basico): X (1 Crédito = 12 meses)"

The credits number is shown to the RIGHT of the plan name (e.g. "Plano Basico:  1").

Extract ALL credit lines you find. Also extract stats like total accounts, valid accounts, expired accounts if visible.

Respond ONLY JSON (no markdown):
{
  "found": true/false,
  "creditLines": [{"label": "Créditos Mensal (Plano Basico)", "value": "1"}, ...],
  "totalCredits": "summary string like '1 mensal, 0 anual'",
  "stats": {"totalContas": "0", "contasValidas": "0", "contasExpiradas": "0"},
  "username": "detected username or null"
}`, img,
      );
      console.log(`🤖 Credits AI: ${aiCredits.substring(0, 400)}`);
      const creditsData = parseJSON(aiCredits);

      // Build display string
      let creditsDisplay = '';
      if (creditsData?.creditLines?.length) {
        creditsDisplay = creditsData.creditLines.map((l: any) => `${l.label}: ${l.value}`).join('\n');
      } else if (creditsData?.totalCredits) {
        creditsDisplay = creditsData.totalCredits;
      }

      let extraInfo = '';
      if (creditsData?.username) extraInfo += `👤 Usuário: ${creditsData.username}\n`;
      if (creditsData?.stats) {
        const s = creditsData.stats;
        if (s.totalContas !== undefined) extraInfo += `📊 Total contas: ${s.totalContas}\n`;
        if (s.contasValidas !== undefined) extraInfo += `✅ Contas válidas: ${s.contasValidas}\n`;
        if (s.contasExpiradas !== undefined) extraInfo += `❌ Contas expiradas: ${s.contasExpiradas}\n`;
      }

      cdp.close();
      return new Response(JSON.stringify({
        success: true,
        credits: creditsDisplay || null,
        creditsLabel: 'Seus Créditos',
        creditsFound: creditsData?.found === true,
        extraInfo: extraInfo || null,
        browserbaseSessionId: bbId,
        method: "AI Browser Agent",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "search_user") {
      const searchUsername = body.searchUsername;
      if (!searchUsername) {
        cdp?.close();
        return new Response(JSON.stringify({ success: false, error: "searchUsername é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const loginResult = await doLogin(cdp, url, username, password);
      if (!loginResult.success) {
        cdp.close();
        return new Response(JSON.stringify({ success: false, error: `Login falhou: ${loginResult.error}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // If login succeeded but 2FA is pending, we can't navigate further
      if (loginResult.error && loginResult.error.match(/2FA|verificação|identity|autenticação/i)) {
        cdp.close();
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Verificação de identidade (2FA) pendente no painel. Primeiro faça o "Teste de Conexão" e insira o código de verificação enviado ao email para liberar o dispositivo.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await wait(4000);

      const baseUrl = url.replace(/\/$/, '');
      
      // Determine the panel type from URL or provider
      const isStarHome = url.match(/starhome|unitv/i) || (body.providerHint === 'unitv');
      
      if (isStarHome) {
        // StarHome/UniTV: Navigate directly to known account list page
        const accountListUrl = `${baseUrl}/#/account/list`;
        console.log(`📋 Navegando para lista de contas (StarHome): ${accountListUrl}`);
        await cdp.send("Page.navigate", { url: accountListUrl });
        await wait(5000);
      } else {
        // Uniplay / other panels: Use AI to navigate to account search
        console.log(`📋 Usando IA para navegar até busca de contas...`);
        
        // Take screenshot of current dashboard and ask AI how to navigate
        for (let navStep = 0; navStep < 4; navStep++) {
          const navImg = await screenshot(cdp);
          const navDom = await extractDOM(cdp);
          
          const aiNav = await askAI(
            `You are inside an IPTV reseller panel dashboard.
URL: ${navDom.url} | Title: ${navDom.title}
Body text: ${(navDom.body || "").substring(0, 600)}
Buttons: ${JSON.stringify(navDom.buttons || []).substring(0, 500)}
Inputs: ${JSON.stringify(navDom.inputs || []).substring(0, 300)}

Goal: Find the page where I can SEARCH for a specific user/account by username. I need to find an input where I can type a username and search for it.

Am I already on a page with a search/filter input for accounts? Or do I need to navigate somewhere?

Respond ONLY JSON (no markdown):
{
  "onSearchPage": true/false,
  "searchInputSel": "CSS selector of the search input if found, or null",
  "action": {"type": "click|navigate", "sel": "selector to click", "url": "URL to navigate to if type=navigate"},
  "reason": "brief explanation"
}`, navImg,
          );
          console.log(`🤖 Nav step ${navStep + 1}: ${aiNav.substring(0, 300)}`);
          const navParsed = parseJSON(aiNav);
          
          if (!navParsed) { await wait(2000); continue; }
          
          if (navParsed.onSearchPage && navParsed.searchInputSel) {
            // We found the search page, type the username
            console.log(`🔍 Campo de busca encontrado: ${navParsed.searchInputSel}`);
            await cdpType(cdp, navParsed.searchInputSel, searchUsername);
            await wait(1000);
            
            // Click search button
            await cdp.send("Runtime.evaluate", {
              expression: `(function(){
                const btns = document.querySelectorAll('button, input[type="submit"], a.btn, .el-button');
                for (const b of btns) {
                  const t = (b.textContent || '').trim().toLowerCase();
                  if (t.includes('consultar') || t.includes('search') || t.includes('buscar') || t.includes('pesquisar') || t === 'query' || t.includes('filtrar') || t.includes('procurar')) {
                    b.click();
                    return JSON.stringify({clicked: true, text: t});
                  }
                }
                for (const b of btns) {
                  const cls = (b.className || '').toLowerCase();
                  if (cls.includes('primary') || cls.includes('btn-primary') || cls.includes('btn-search')) {
                    b.click();
                    return JSON.stringify({clicked: true, text: (b.textContent||'').trim(), method: 'class'});
                  }
                }
                return JSON.stringify({clicked: false});
              })()`,
              returnByValue: true,
            });
            await wait(4000);
            break;
          }
          
          // Navigate to the search page
          if (navParsed.action) {
            try {
              if (navParsed.action.type === "navigate" && navParsed.action.url) {
                await cdp.send("Page.navigate", { url: navParsed.action.url });
              } else if (navParsed.action.type === "click" && navParsed.action.sel) {
                const clickExpr = navParsed.action.sel.startsWith('document.')
                  ? `${navParsed.action.sel}?.click()`
                  : `document.querySelector('${navParsed.action.sel}')?.click()`;
                await cdp.send("Runtime.evaluate", { expression: clickExpr, returnByValue: true });
              }
            } catch (e) { console.log(`⚠️ Nav action error: ${(e as Error).message}`); }
            await wait(4000);
          } else {
            await wait(2000);
          }
        }
      }

      // If StarHome, use the original typed approach
      if (isStarHome) {
        console.log(`🔍 Digitando "${searchUsername}" no campo Conta...`);
        const typeResult = await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            const labels = document.querySelectorAll('label, span, td, th, div');
            for (const lbl of labels) {
              const t = (lbl.textContent || '').trim();
              if (t === 'Conta' || t === 'Account') {
                const row = lbl.closest('tr, div, .el-form-item');
                if (row) {
                  const inp = row.querySelector('input[type="text"], input:not([type])');
                  if (inp) {
                    inp.focus();
                    const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
                    if(nSet) nSet.call(inp, ${JSON.stringify(searchUsername)});
                    else inp.value = ${JSON.stringify(searchUsername)};
                    inp.dispatchEvent(new Event('input',{bubbles:true}));
                    inp.dispatchEvent(new Event('change',{bubbles:true}));
                    return JSON.stringify({ok: true, method: 'label-sibling'});
                  }
                }
              }
            }
            const allInputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="password"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"])');
            for (const inp of allInputs) {
              const ph = (inp.placeholder || '').toLowerCase();
              const nm = (inp.name || '').toLowerCase();
              if (ph.includes('conta') || ph.includes('account') || nm.includes('account') || nm.includes('conta') || nm.includes('username')) {
                inp.focus();
                const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
                if(nSet) nSet.call(inp, ${JSON.stringify(searchUsername)});
                else inp.value = ${JSON.stringify(searchUsername)};
                inp.dispatchEvent(new Event('input',{bubbles:true}));
                inp.dispatchEvent(new Event('change',{bubbles:true}));
                return JSON.stringify({ok: true, method: 'placeholder'});
              }
            }
            if (allInputs.length > 0) {
              const inp = allInputs[0];
              inp.focus();
              const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
              if(nSet) nSet.call(inp, ${JSON.stringify(searchUsername)});
              else inp.value = ${JSON.stringify(searchUsername)};
              inp.dispatchEvent(new Event('input',{bubbles:true}));
              inp.dispatchEvent(new Event('change',{bubbles:true}));
              return JSON.stringify({ok: true, method: 'first-input', count: allInputs.length});
            }
            return JSON.stringify({ok: false, inputs: allInputs.length});
          })()`,
          returnByValue: true,
        });
        const typeRes = JSON.parse(typeResult.result?.value || "{}");
        console.log(`📝 Type result: ${JSON.stringify(typeRes)}`);

        await wait(1000);

        console.log(`🔘 Clicando em Consultar...`);
        await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            const btns = document.querySelectorAll('button, input[type="submit"], a.btn, .el-button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t.includes('consultar') || t.includes('search') || t.includes('buscar') || t.includes('pesquisar') || t === 'query') {
                b.click();
                return JSON.stringify({clicked: true, text: t});
              }
            }
            for (const b of btns) {
              const cls = (b.className || '').toLowerCase();
              if (cls.includes('primary') || cls.includes('btn-primary')) {
                b.click();
                return JSON.stringify({clicked: true, text: (b.textContent||'').trim(), method: 'primary-class'});
              }
            }
            return JSON.stringify({clicked: false, totalBtns: btns.length});
          })()`,
          returnByValue: true,
        });

        await wait(4000);
      }

      // Now extract results using AI vision
      const img = await screenshot(cdp);
      const dom = await extractDOM(cdp);
      console.log(`📊 After search - URL: ${dom.url}, Body: ${(dom.body || "").substring(0, 500)}`);

      const aiExtract = await askAI(
        `You are looking at an IPTV reseller panel account page after searching for user "${searchUsername}".
Look at the page carefully. There may be a TABLE showing search results, or account details displayed in another format.

Look for information about the user such as:
- Account/Username
- Status (active/expired/etc)
- Days remaining / Expiry date
- Plan name
- Creation date
- Password (if visible)
- MAC address
- Any other relevant info

If you see data about the user "${searchUsername}", extract ALL visible information.
If the page shows "Total: 0", "Nenhum resultado", empty table, or no matching data, the user was not found.

Respond ONLY JSON (no markdown):
{
  "found": true/false,
  "user": {
    "username": "${searchUsername}",
    "status": "active or expired or unknown",
    "daysRemaining": "number or null",
    "expiryDate": "date or null",
    "plan": "plan name or null",
    "buyerName": "buyer name or null",
    "createdAt": "creation date or null",
    "firstAccess": "first access date or null",
    "password": "if visible or null",
    "mac": "MAC address or null",
    "extra": "any other visible info"
  },
  "totalResults": "total shown if any"
}`, img,
      );

      console.log(`🤖 Extract result: ${aiExtract.substring(0, 400)}`);
      const extractData = parseJSON(aiExtract);

      let searchResult: any;
      if (extractData?.found) {
        searchResult = {
          success: true,
          user: extractData.user,
          totalResults: extractData.totalResults,
        };
      } else {
        const bodyText = (dom.body || "").substring(0, 1000);
        const hasTotal0 = bodyText.match(/Total:\s*0/i);
        searchResult = {
          success: false,
          error: hasTotal0 ? `Usuário "${searchUsername}" não encontrado no painel.` : (extractData?.reason || "Não foi possível extrair os dados do usuário."),
        };
      }

      cdp.close();
      return new Response(JSON.stringify({
        ...searchResult,
        browserbaseSessionId: bbId,
        method: "AI Browser Agent",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "renew" || action === "renew_by_username") {
      const clientUsername = body.clientUsername || body.username;
      const duration = body.duration || 1;
      const durationIn = body.durationIn || "months";
      const tipoPainel = body.tipoPainel;
      const userId = body.userId;
      const runAsync = body.runAsync !== false;

      const executeRenew = async () => {
        try {
          let loginResult = await doLogin(cdp, url, username, password, { fastMode: true });
          if (!loginResult.success) {
            console.warn(`⚠️ Fast login falhou, tentando modo completo: ${loginResult.error}`);
            loginResult = await doLogin(cdp, url, username, password, { fastMode: false });
          }

          if (!loginResult.success) {
            console.error(`❌ Renew login failed: ${loginResult.error}`);
            if (supabase && userId) {
              await supabase.from('logs_painel').insert({
                user_id: userId,
                acao: `❌ Renovação falhou (login): ${clientUsername} — ${loginResult.error}`,
                tipo: 'renovacao',
              });
            }
            return { success: false, error: loginResult.error || 'Falha no login do painel' };
          }

          const renewResult = await doRenew(cdp, url, clientUsername, duration, durationIn, { tipoPainel, provedor: panelProvedor });
          console.log(`✅ Renew result: ${JSON.stringify(renewResult)}`);

          if (supabase && userId) {
            await supabase.from('logs_painel').insert({
              user_id: userId,
              acao: renewResult.success
                ? `✅ Renovação no painel concluída: ${clientUsername} (+${duration} ${durationIn})`
                : `❌ Renovação no painel falhou: ${clientUsername} — ${renewResult.error || 'Erro desconhecido'}`,
              tipo: 'renovacao',
            });
          }

          return renewResult;
        } catch (renewErr: any) {
          console.error(`❌ Renew error: ${renewErr.message}`);
          if (supabase && userId) {
            try {
              await supabase.from('logs_painel').insert({
                user_id: userId,
                acao: `❌ Renovação no painel falhou: ${clientUsername} — ${renewErr.message}`,
                tipo: 'renovacao',
              });
            } catch {}
          }
          return { success: false, error: renewErr.message };
        } finally {
          cdp?.close();
        }
      };

      if (runAsync) {
        const backgroundWork = executeRenew();
        try {
          (globalThis as any).EdgeRuntime.waitUntil(backgroundWork);
        } catch {
          console.log("⚠️ EdgeRuntime.waitUntil not available, running inline");
        }

        return new Response(JSON.stringify({
          success: true,
          async: true,
          message: `Renovação de ${clientUsername} iniciada em segundo plano`,
          browserbaseSessionId: bbId,
          method: "AI Browser Agent (async)",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const renewResult = await executeRenew();
      return new Response(JSON.stringify({
        ...renewResult,
        async: false,
        browserbaseSessionId: bbId,
        method: "AI Browser Agent",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    cdp?.close();
    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    cdp?.close();
    console.error(`❌ ${(e as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
