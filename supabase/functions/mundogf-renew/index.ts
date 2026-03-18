import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

async function resolveVaultCreds(supabase: SupabaseClient, panel: any, userToken?: string) {
  let u = panel.usuario, s = panel.senha;
  if (u === 'vault' || s === 'vault') {
    // Detect if userToken is the service_role key (server-to-server call)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isServiceRole = userToken === serviceRoleKey || !userToken;

    if (isServiceRole) {
      // Use admin function with service_role client (bypasses auth.uid() check)
      console.log('🔐 Vault: usando admin_get_gateway_secret (chamada server-side)');
      const [uR, sR] = await Promise.all([
        supabase.rpc('admin_get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `usuario_${panel.id}` }),
        supabase.rpc('admin_get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `senha_${panel.id}` }),
      ]);
      console.log(`🔐 Vault resolve: usuario=${uR.data ? '✅' : '❌ ' + uR.error?.message}, senha=${sR.data ? '✅' : '❌ ' + sR.error?.message}`);
      if (uR.data) u = uR.data;
      if (sR.data) s = sR.data;
    } else {
      // Use user-scoped client so auth.uid() works in RPC
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const vaultClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
      });
      const [uR, sR] = await Promise.all([
        vaultClient.rpc('get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `usuario_${panel.id}` }),
        vaultClient.rpc('get_gateway_secret', { p_user_id: panel.user_id, p_gateway: 'painel', p_secret_name: `senha_${panel.id}` }),
      ]);
      console.log(`🔐 Vault resolve: usuario=${uR.data ? '✅' : '❌ ' + uR.error?.message}, senha=${sR.data ? '✅' : '❌ ' + sR.error?.message}`);
      if (uR.data) u = uR.data;
      if (sR.data) s = sR.data;
    }
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
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Timeouts para chamadas pós-login do MundoGF
const MUNDOGF_API_TIMEOUT_MS = 45000;
const MUNDOGF_FAST_TIMEOUT_MS = 30000;

// ==================== Browserbase ====================
const BROWSERBASE_API = "https://api.browserbase.com/v1";

async function createBrowserbaseSession(proxySessionId?: string | null): Promise<{ sessionId: string; connectUrl: string }> {
  const apiKey = Deno.env.get("BROWSERBASE_API_KEY")!;
  const projectId = Deno.env.get("BROWSERBASE_PROJECT_ID")!;

  const proxyHost = Deno.env.get("IPROYAL_PROXY_HOST");
  const proxyUser = Deno.env.get("IPROYAL_PROXY_USER");
  const proxyPass = Deno.env.get("IPROYAL_PROXY_PASS");
  const hasExternalProxy = proxyHost && proxyUser && proxyPass && proxySessionId;

  const buildProxyConfig = () => {
    if (!hasExternalProxy) return null;
    const stickyUser = `${proxyUser}-session-${proxySessionId}_country-br`;
    return [{ type: "external", server: `http://${proxyHost}`, username: stickyUser, password: proxyPass }];
  };

  const externalProxies = buildProxyConfig();
  const proxyOptions = externalProxies ? [externalProxies, true, false] : [true, false];

  for (const proxyOpt of proxyOptions) {
    const payload: any = { projectId, browserSettings: { timeout: 120 } };
    if (Array.isArray(proxyOpt)) payload.proxies = proxyOpt;
    else if (proxyOpt === true) payload.proxies = true;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const waitSec = attempt * 3;
        console.log(`⏳ Rate limit, waiting ${waitSec}s (attempt ${attempt + 1})...`);
        await wait(waitSec * 1000);
      }

      let resp: Response;
      try {
        resp = await withTimeout(fetch(`${BROWSERBASE_API}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-BB-API-Key": apiKey },
          body: JSON.stringify(payload),
        }), 15000);
      } catch (e: any) {
        console.log(`⚠️ Falha ao criar sessão (${Array.isArray(proxyOpt) ? 'iproyal-sticky' : proxyOpt ? 'browserbase' : 'none'}): ${e?.message || e}`);
        if (attempt === 2) break;
        continue;
      }

      if (resp.status === 429) { await resp.text(); continue; }
      if (resp.status === 402 && proxyOpt !== false) { await resp.text(); break; }
      if (!resp.ok) {
        const text = await resp.text();
        if (proxyOpt === false) throw new Error(`Browserbase failed (${resp.status}): ${text}`);
        console.log(`⚠️ Proxy option failed (${resp.status}), trying next...`);
        break;
      }
      const session = await resp.json();
      const proxyLabel = Array.isArray(proxyOpt) ? 'iproyal-sticky' : proxyOpt ? 'browserbase' : 'none';
      console.log(`🌐 Session: ${session.id} (proxy: ${proxyLabel})`);
      return { sessionId: session.id, connectUrl: session.connectUrl };
    }
  }
  throw new Error("Browserbase: não foi possível criar sessão");
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
      const timeout = setTimeout(() => reject(new Error("CDP WS timeout")), 30000);
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
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
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

// ==================== CDP Helpers ====================
async function cdpType(cdp: CDPSession, selector: string, text: string): Promise<void> {
  const clickResult = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const el=document.querySelector('${selector}');
      if(!el) return 'notfound';
      const rect = el.getBoundingClientRect();
      return JSON.stringify({x: rect.x + rect.width/2, y: rect.y + rect.height/2});
    })()`,
    returnByValue: true,
  });
  const val = clickResult.result?.value;
  if (val === 'notfound') { console.log(`⚠️ cdpType: not found: ${selector}`); return; }

  try {
    const coords = JSON.parse(val);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
  } catch {
    await cdp.send("Runtime.evaluate", { expression: `document.querySelector('${selector}')?.focus()`, returnByValue: true });
  }
  await wait(200);

  // Select all + delete
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" });
  await wait(100);

  for (const ch of text) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, code: "" });
    await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ch, key: ch, unmodifiedText: ch });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, code: "" });
  }
  await wait(100);

  // Verify & fallback
  const verify = await cdp.send("Runtime.evaluate", { expression: `document.querySelector('${selector}')?.value || ''`, returnByValue: true });
  const actual = verify.result?.value || '';
  if (actual.length === 0) {
    await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const el=document.querySelector('${selector}');
        if(!el) return;
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
        if(nativeSet) nativeSet.call(el, ${JSON.stringify(text)});
        else el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new InputEvent('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
      returnByValue: true,
    });
  }
}

// ==================== reCAPTCHA Solver (in-browser) ====================
async function solveRecaptcha(cdp: CDPSession, siteKey: string, pageUrl: string, proxySessionId?: string | null): Promise<boolean> {
  const apiKey = Deno.env.get("TWOCAPTCHA_API_KEY");
  if (!apiKey) { console.log("⚠️ TWOCAPTCHA_API_KEY não configurada"); return false; }

  const proxyHost = Deno.env.get("IPROYAL_PROXY_HOST") || "";
  const proxyUser = Deno.env.get("IPROYAL_PROXY_USER") || "";
  const proxyPass = Deno.env.get("IPROYAL_PROXY_PASS") || "";
  const useProxy = !!(proxyHost && proxyUser && proxyPass && proxySessionId);

  console.log(`🤖 Resolvendo reCAPTCHA (${siteKey.substring(0, 15)}...)${useProxy ? ' com proxy estável' : ''}...`);
  try {
    const params = new URLSearchParams({
      key: apiKey,
      method: "userrecaptcha",
      googlekey: siteKey,
      pageurl: pageUrl,
      json: "1",
    });

    if (useProxy) {
      const stickyUser = `${proxyUser}-session-${proxySessionId}_country-br`;
      params.set("proxy", `${stickyUser}:${proxyPass}@${proxyHost}`);
      params.set("proxytype", "HTTP");
    }

    const sub = await withTimeout(fetch(`https://2captcha.com/in.php?${params.toString()}`), 15000);
    const subJ = await sub.json();
    if (subJ.status !== 1) {
      console.log(`⚠️ 2Captcha submit falhou: ${subJ.request || 'sem detalhe'}`);
      return false;
    }

    for (let i = 0; i < 12; i++) {
      await wait(5000);
      const res = await withTimeout(fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${subJ.request}&json=1`), 10000);
      const resJ = await res.json();
      if (resJ.status === 1) {
        console.log("✅ reCAPTCHA resolvido!");
        const token = resJ.request;
        // Inject token into the browser DOM
        await cdp.send("Runtime.evaluate", {
          expression: `(function(){
            const ta=document.querySelector('#g-recaptcha-response,textarea[name="g-recaptcha-response"],input[name="g-recaptcha-response"]');
            if(ta){ta.value=${JSON.stringify(token)};ta.style.display='block';}
            const alt=document.querySelector('input[name="recaptcha"],input[name="recaptcha_token"],input[name="captcha"]');
            if(alt){alt.value=${JSON.stringify(token)};}
            try{if(typeof ___grecaptcha_cfg!=='undefined'){const c=___grecaptcha_cfg.clients||{};for(const k of Object.keys(c)){const find=(o,d)=>{if(!o||d>4)return null;if(typeof o==='function')return o;if(typeof o==='object'){for(const x of Object.keys(o)){if(x==='callback'&&typeof o[x]==='function')return o[x];const f=find(o[x],d+1);if(f)return f;}}return null;};const cb=find(c[k],0);if(cb){cb(${JSON.stringify(token)});break;}}}}catch(e){}
          })()`,
          returnByValue: true,
        });
        await wait(1000);
        return true;
      }
      if (resJ.request !== "CAPCHA_NOT_READY") return false;
    }
  } catch (e: any) { console.log(`⚠️ 2Captcha: ${e.message}`); }
  return false;
}

// ==================== Login via Browserbase ====================
async function loginMundoGFBrowser(baseUrl: string, username: string, password: string, proxySessionId?: string | null): Promise<{ success: boolean; cookies: string; csrf: string; error?: string }> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  console.log(`🌐 MundoGF Login (Browserbase): ${cleanBase} (user: ${username})`);

  const { connectUrl } = await createBrowserbaseSession(proxySessionId);
  const cdp = new CDPSession();
  
  try {
    await cdp.connect(connectUrl);
    await cdp.attachToPage();
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");

    // Navigate to login page
    console.log(`📄 Navegando para ${cleanBase}/login...`);
    await cdp.send("Page.navigate", { url: `${cleanBase}/login` });
    await wait(8000);

    // Check for Cloudflare
    const domCheck = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({url: location.href, title: document.title, body: document.body?.innerText?.substring(0,300)||''})`,
      returnByValue: true,
    });
    const pageInfo = JSON.parse(domCheck.result?.value || "{}");
    
    if ((pageInfo.body || "").includes("Just a moment") || (pageInfo.title || "").includes("Cloudflare")) {
      console.log("⏳ Cloudflare detectado, aguardando 25s...");
      await wait(25000);
      // Re-check after waiting
      const recheckDom = await cdp.send("Runtime.evaluate", {
        expression: `JSON.stringify({url: location.href, title: document.title, body: document.body?.innerText?.substring(0,300)||''})`,
        returnByValue: true,
      });
      const recheckInfo = JSON.parse(recheckDom.result?.value || "{}");
      if ((recheckInfo.body || "").includes("Just a moment") || (recheckInfo.title || "").includes("Cloudflare")) {
        console.log("⏳ Cloudflare ainda ativo, aguardando mais 20s...");
        await wait(20000);
      }
    }

    // Extract DOM info
    const domResult = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({
        url: location.href, title: document.title,
        inputs: Array.from(document.querySelectorAll('input')).filter(el=>el.type!=='hidden').map((el,i) => ({
          i, type:el.type, name:el.name, id:el.id, placeholder:el.placeholder,
          sel: el.id ? '#'+el.id : el.name ? 'input[name="'+el.name+'"]' : 'input:nth-child('+(i+1)+')',
        })),
        buttons: Array.from(document.querySelectorAll('button, input[type=submit]')).map((el,i) => ({
          i, text:(el.textContent||'').trim().substring(0,50), type:el.type||'button',
          sel: el.id ? '#'+el.id : 'document.querySelectorAll("button, input[type=submit]")['+i+']',
          useEval: !el.id,
        })),
        body: document.body?.innerText?.substring(0,300)||'',
      })`,
      returnByValue: true,
    });
    const dom = JSON.parse(domResult.result?.value || "{}");
    console.log(`📋 ${dom.inputs?.length || 0} inputs, ${dom.buttons?.length || 0} buttons`);

    // Find login fields
    const inputs = dom.inputs || [];
    const buttons = dom.buttons || [];
    
    const userField = inputs.find((i: any) =>
      i.type === "text" || i.name?.match(/user|login|email/i) || i.id?.match(/user|login|email/i) || i.placeholder?.match(/usu[aá]rio|user|login/i)
    );
    const passField = inputs.find((i: any) =>
      i.type === "password" || i.name?.match(/pass|senha/i) || i.id?.match(/pass|senha/i)
    );
    const submitBtn = buttons.find((b: any) =>
      b.type === "submit" || (b.text || "").match(/login|logar|entrar|acessar|sign.?in|enviar|submit/i)
    ) || buttons[0];

    if (!userField || !passField) {
      return { success: false, cookies: '', csrf: '', error: `Campos de login não encontrados (inputs: ${inputs.length})` };
    }

    // Fill username
    console.log(`👤 Username: ${userField.sel}`);
    await cdpType(cdp, userField.sel, username);
    await wait(300);

    // Fill password
    console.log(`🔑 Password: ${passField.sel}`);
    await cdpType(cdp, passField.sel, password);
    await wait(300);

    // Check for reCAPTCHA
    const capCheck = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({
        rc: !!document.querySelector('.g-recaptcha,[data-sitekey],#g-recaptcha-response'),
        sk: (document.querySelector('[data-sitekey]')||{}).dataset?.sitekey||'',
        skFromRender: (document.querySelector('script[src*="recaptcha"]')?.src?.match(/render=([^&]+)/)||[])[1]||'',
      })`,
      returnByValue: true,
    });
    const cap = JSON.parse(capCheck.result?.value || "{}");
    const siteKey = cap.sk || cap.skFromRender || '';
    
    if (siteKey) {
      console.log(`🤖 reCAPTCHA detectado: ${siteKey.substring(0, 20)}...`);
      const solved = await solveRecaptcha(cdp, siteKey, `${cleanBase}/login`, proxySessionId);
      if (solved) {
        // Extra wait to ensure token is fully propagated in the DOM
        await wait(2000);
        // Verify token was injected
        const tokenCheck = await cdp.send("Runtime.evaluate", {
          expression: `(document.querySelector('#g-recaptcha-response,textarea[name="g-recaptcha-response"]')?.value||'').length`,
          returnByValue: true,
        });
        console.log(`🔑 reCAPTCHA token length: ${tokenCheck.result?.value || 0}`);
      }
    }

    // Submit form - prefer JS form.submit() to ensure all hidden fields are included
    console.log(`🔘 Submitting login form...`);
    await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const form = document.querySelector('form');
        if (form) {
          // Try clicking submit button first (triggers validation)
          const btn = form.querySelector('button[type="submit"], input[type="submit"], button');
          if (btn) btn.click();
          else form.submit();
        }
      })()`,
      returnByValue: true,
    });

    await wait(8000);

    // Check result
    const afterResult = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({url: location.href, title: document.title, body: document.body?.innerText?.substring(0,300)||''})`,
      returnByValue: true,
    });
    const after = JSON.parse(afterResult.result?.value || "{}");
    console.log(`📊 After login: URL=${after.url}`);
    console.log(`📄 After login body: ${(after.body || '').substring(0, 180)}`);

    const afterUrl = after.url || "";
    const stillOnLogin = afterUrl.includes("/login");
    const hasError = (after.body || "").match(/incorrect|inválid|invalid|incorret|falh|does not match|erro/i);
    
    if (stillOnLogin) {
      if (hasError) {
        console.log(`⚠️ Login retornou mensagem de erro, tentando retry robusto...`);
      } else {
        console.log(`⚠️ Ainda na página de login sem erro explícito, tentando retry robusto...`);
      }

      await cdp.send("Runtime.evaluate", {
        expression: `(function(){
          const form = document.querySelector('form');
          if (!form) return;
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
          }
          const btn = form.querySelector('button[type="submit"], input[type="submit"], button');
          if (btn) btn.click();
          else form.submit();
        })()`,
        returnByValue: true,
      });
      await wait(10000);
      
      const retryResult = await cdp.send("Runtime.evaluate", {
        expression: `JSON.stringify({url: location.href, body: document.body?.innerText?.substring(0,240)||''})`,
        returnByValue: true,
      });
      const retry = JSON.parse(retryResult.result?.value || "{}");
      console.log(`📊 After retry: URL=${retry.url}`);
      console.log(`📄 After retry body: ${(retry.body || '').substring(0, 180)}`);
      if ((retry.url || "").includes("/login")) {
        return { success: false, cookies: '', csrf: '', error: `Login falhou no painel (${(retry.body || '').substring(0, 180)})` };
      }
    }

    // Extract cookies from browser
    const cookieResult = await cdp.send("Network.getCookies", { urls: [cleanBase] });
    const browserCookies = (cookieResult.cookies || []).map((c: any) => `${c.name}=${c.value}`).join('; ');
    console.log(`🍪 Cookies extraídos: ${browserCookies.substring(0, 100)}...`);

    // Extract CSRF from dashboard
    const csrfResult = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const meta = document.querySelector('meta[name="csrf-token"]');
        const input = document.querySelector('input[name="_token"]');
        return meta?.content || input?.value || '';
      })()`,
      returnByValue: true,
    });
    const csrf = csrfResult.result?.value || '';
    console.log(`🔑 CSRF: ${csrf ? csrf.substring(0, 20) + '...' : 'não encontrado'}`);

    console.log(`✅ Login MundoGF via Browserbase bem-sucedido!`);
    return { success: true, cookies: browserCookies, csrf };

  } finally {
    cdp.close();
  }
}

// ==================== VPS Relay (for post-login API calls) ====================
async function relayFetch(url: string, options: {
  method?: string; headers?: Record<string, string>; body?: string; redirect?: string;
} = {}): Promise<{ status: number; headers: Record<string, string>; text: () => Promise<string>; _headers: Record<string, string>; _body: string }> {
  const VPS_RELAY_URL = Deno.env.get('VPS_RELAY_URL');
  const VPS_RELAY_SECRET = Deno.env.get('VPS_RELAY_SECRET');
  
  if (!VPS_RELAY_URL || !VPS_RELAY_SECRET) {
    const resp = await fetch(url, {
      method: options.method || 'GET', headers: options.headers, body: options.body,
      redirect: options.redirect as RequestRedirect || undefined,
    });
    const bodyText = await resp.text();
    const hdrs: Record<string, string> = {};
    resp.headers.forEach((v, k) => { hdrs[k] = v; });
    return { status: resp.status, headers: hdrs, _headers: hdrs, _body: bodyText, text: () => Promise.resolve(bodyText) };
  }

  const relayPayload: any = { url, method: options.method || 'GET', headers: { ...options.headers } };
  if (options.body) relayPayload.body = options.body;
  if (options.redirect === 'manual') relayPayload.followRedirects = false;

  const resp = await fetch(`${VPS_RELAY_URL}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': VPS_RELAY_SECRET },
    body: JSON.stringify(relayPayload),
  });
  const relayData = await resp.json();
  const respHeaders: Record<string, string> = relayData.headers || {};
  return {
    status: relayData.status || 500, headers: respHeaders, _headers: respHeaders,
    _body: relayData.body || '', text: () => Promise.resolve(relayData.body || ''),
  };
}

// ==================== Session Cache ====================
async function getCachedSession(supabase: SupabaseClient, panelId: string): Promise<{ cookies: string; csrf: string } | null> {
  const { data } = await supabase
    .from('cached_panel_sessions')
    .select('*')
    .eq('painel_id', panelId)
    .eq('provedor', 'mundogf')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    console.log(`✅ Sessão em cache encontrada (expira: ${data.expires_at})`);
    return { cookies: data.cookies || '', csrf: data.access_token || '' };
  }
  return null;
}

async function cacheSession(supabase: SupabaseClient, panelId: string, userId: string, cookies: string, csrf: string): Promise<void> {
  // Delete old sessions for this panel
  await supabase.from('cached_panel_sessions').delete().eq('painel_id', panelId).eq('provedor', 'mundogf');
  // Cache for 20 minutes
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  await supabase.from('cached_panel_sessions').insert({
    painel_id: panelId, user_id: userId, provedor: 'mundogf',
    access_token: csrf, cookies, token_type: 'session',
    expires_at: expiresAt,
  });
  console.log(`💾 Sessão cacheada (expira: ${expiresAt})`);
}

async function getLoginSession(supabase: SupabaseClient, panel: any, userToken: string): Promise<{ cookies: string; csrf: string }> {
  // Try cache first
  const cached = await getCachedSession(supabase, panel.id);
  if (cached) return cached;

  // Full Browserbase login
  const creds = await resolveVaultCreds(supabase, panel, userToken);
  const proxySessionId = panel.proxy_session_id || panel.id;
  const login = await loginMundoGFBrowser(panel.url, creds.usuario, creds.senha, proxySessionId);
  if (!login.success) throw new Error(login.error || 'Login falhou');

  // Cache the session
  await cacheSession(supabase, panel.id, panel.user_id, login.cookies, login.csrf);
  return { cookies: login.cookies, csrf: login.csrf };
}

// ==================== Main Handler ====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract user token for vault access
  const authHeader = req.headers.get('Authorization') || '';
  const userToken = authHeader.replace('Bearer ', '');

  try {
    const body = await req.json();
    const { action, panelId } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==================== GET CREDITS ====================
    if (action === 'get_credits') {
      const { data: panel, error: panelError } = await supabase
        .from('paineis_integracao').select('*').eq('id', panelId).eq('provedor', 'mundogf').single();
      if (panelError || !panel) {
        return new Response(JSON.stringify({ success: false, error: 'Painel não encontrado' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      let login: { cookies: string; csrf: string };
      try {
        login = await getLoginSession(supabase, panel, userToken);
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      const creditsResp = await withTimeout(relayFetch(`${panel.url.replace(/\/$/, '')}/ajax/getUserCredits`, {
        method: 'GET',
        headers: { 'Cookie': login.cookies, 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0' },
      }), MUNDOGF_API_TIMEOUT_MS);
      const creditsText = await creditsResp.text();
      let creditsJson: any = null;
      try { creditsJson = JSON.parse(creditsText); } catch {}

      return new Response(JSON.stringify({ success: true, credits: creditsJson?.credits ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ==================== LIST CLIENTS ====================
    if (action === 'list_clients') {
      const { data: panel } = await supabase.from('paineis_integracao').select('*').eq('id', panelId).eq('provedor', 'mundogf').single();
      if (!panel) return new Response(JSON.stringify({ success: false, error: 'Painel não encontrado' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

      let login: { cookies: string; csrf: string };
      try {
        login = await getLoginSession(supabase, panel, userToken);
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }

      const cleanBase = panel.url.replace(/\/$/, '');
      const dtBody = new URLSearchParams();
      dtBody.append('draw', '1');
      dtBody.append('start', '0');
      dtBody.append('length', '1000');
      dtBody.append('search[value]', '');

      const clientsResp = await withTimeout(relayFetch(`${cleanBase}/ajax/getClients`, {
        method: 'POST',
        headers: {
          'Cookie': login.cookies, 'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': login.csrf,
          'User-Agent': 'Mozilla/5.0', 'Referer': `${cleanBase}/clients`,
        },
        body: dtBody.toString(),
      }), MUNDOGF_API_TIMEOUT_MS);
      const clientsText = await clientsResp.text();
      let clientsJson: any = null;
      try { clientsJson = JSON.parse(clientsText); } catch {}

      if (!clientsJson?.data) {
        return new Response(JSON.stringify({ success: false, error: 'Não foi possível obter lista de clientes' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      const clients = clientsJson.data.map((c: any) => ({
        user_id: c.user_id,
        username: c.username?.replace(/<[^>]*>/g, '') || '',
        password: c.password,
        status: c.status,
        expire: c.expire?.replace(/<[^>]*>/g, '') || '',
        max_cons: c.max_cons,
        online: c.online,
        notes: c.notes_full || c.notes || '',
        created_at: c.created_at,
      }));

      return new Response(JSON.stringify({ success: true, total: clientsJson.recordsTotal, clients }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ==================== RENEW CLIENT ====================
    if (action === 'renew_client' || action === 'renew_by_username') {
      let { clientUserId, username, duration, durationIn, clienteScreens } = body;
      if ((!clientUserId && !username) || !duration || !durationIn) {
        return new Response(JSON.stringify({ success: false, error: 'clientUserId ou username, duration e durationIn são obrigatórios' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      const { data: panel } = await supabase.from('paineis_integracao').select('*').eq('id', panelId).eq('provedor', 'mundogf').single();
      if (!panel) return new Response(JSON.stringify({ success: false, error: 'Painel não encontrado' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

      console.log(`🔄 Renovando cliente ${clientUserId || username} no painel ${panel.nome} (${duration} ${durationIn}, Telas: ${clienteScreens || '?'})`);

      let login: { cookies: string; csrf: string };
      try {
        login = await getLoginSession(supabase, panel, userToken);
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }

      const cleanBase = panel.url.replace(/\/$/, '');
      const normalizeValue = (value: any) => String(value || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, '')
        .trim()
        .toLowerCase();
      
      // Resolve username to user_id if needed
      let resolvedUserId = clientUserId;
      if (!resolvedUserId && username) {
        const fetchClients = async (searchValue: string) => {
          const dtBody = new URLSearchParams();
          dtBody.append('draw', '1');
          dtBody.append('start', '0');
          dtBody.append('length', '1000');
          dtBody.append('search[value]', searchValue);

          const resp = await withTimeout(relayFetch(`${cleanBase}/ajax/getClients`, {
            method: 'POST',
            headers: {
              'Cookie': login.cookies, 'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': login.csrf,
              'User-Agent': 'Mozilla/5.0', 'Referer': `${cleanBase}/clients`,
            },
            body: dtBody.toString(),
          }), MUNDOGF_API_TIMEOUT_MS);

          const text = await resp.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          return { json, text, status: resp.status };
        };

        const findClientMatch = (rows: any[]) => {
          const target = normalizeValue(username);
          const usernameRaw = String(username).trim();
          return rows.find((c: any) => {
            const cleanUsername = normalizeValue(c.username);
            const rawUserId = String(c.user_id || '').trim();
            return cleanUsername === target || rawUserId === usernameRaw;
          });
        };

        let searchResult = await fetchClients(username);

        // Sessão em cache pode expirar no painel sem expirar localmente
        if (!searchResult.json?.data) {
          console.log('⚠️ getClients sem JSON válido; invalidando cache e refazendo login...');
          await supabase.from('cached_panel_sessions').delete().eq('painel_id', panel.id).eq('provedor', 'mundogf');
          login = await getLoginSession(supabase, panel, userToken);
          searchResult = await fetchClients(username);
        }

        let match = Array.isArray(searchResult.json?.data) ? findClientMatch(searchResult.json.data) : null;

        // Fallback: lista ampla sem filtro quando a busca do painel não retorna o usuário
        if (!match) {
          const fullResult = await fetchClients('');
          if (Array.isArray(fullResult.json?.data)) {
            match = findClientMatch(fullResult.json.data);
          }
        }

        if (match) {
          resolvedUserId = match.user_id;
          console.log(`✅ Usuário resolvido no MundoGF: ${username} -> user_id=${resolvedUserId}`);
        }

        if (!resolvedUserId) {
          return new Response(JSON.stringify({ success: false, error: `Usuário "${username}" não encontrado no painel MundoGF` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
          });
        }
      }

      // Get max_cons from client info
      let maxCons = '1';
      if (username) {
        const dtBody2 = new URLSearchParams();
        dtBody2.append('draw', '1');
        dtBody2.append('start', '0');
        dtBody2.append('length', '50');
        dtBody2.append('search[value]', username);
        try {
          const infoResp = await withTimeout(relayFetch(`${cleanBase}/ajax/getClients`, {
            method: 'POST',
            headers: {
              'Cookie': login.cookies, 'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': login.csrf,
              'User-Agent': 'Mozilla/5.0', 'Referer': `${cleanBase}/clients`,
            },
            body: dtBody2.toString(),
          }), MUNDOGF_FAST_TIMEOUT_MS);
          const infoText = await infoResp.text();
          const infoJson = JSON.parse(infoText);
          const found = infoJson?.data?.find((c: any) => (c.username || '').replace(/<[^>]*>/g, '').trim().toLowerCase() === username.toLowerCase());
          if (found?.max_cons) maxCons = String(found.max_cons);
        } catch {}
      }

      // Fetch extend modal to get valid option values
      let validOption = '';
      try {
        const extendPageResp = await withTimeout(relayFetch(`${cleanBase}/clients/${resolvedUserId}/extend`, {
          method: 'GET',
          headers: {
            'Cookie': login.cookies, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*', 'Referer': `${cleanBase}/clients/${resolvedUserId}`,
          },
        }), MUNDOGF_FAST_TIMEOUT_MS);
        const extendHtml = await extendPageResp.text();
        console.log(`📄 Extend page: ${extendPageResp.status}, length=${extendHtml.length}`);
        
        const optionMatches = extendHtml.match(/<option\s[^>]*value=["']([^"']+)["'][^>]*>\s*([\s\S]*?)\s*<\/option>/gi);
        if (optionMatches) {
          const parsedOptions: { value: string; text: string }[] = [];
          for (const match of optionMatches) {
            const optionMatch = match.match(/<option\s[^>]*value=["']([^"']+)["'][^>]*>\s*([\s\S]*?)\s*<\/option>/i);
            if (optionMatch) {
              const val = optionMatch[1].trim();
              const txt = optionMatch[2].trim();
              if (val && txt && val !== 'custom' && val !== 'add_screens') {
                parsedOptions.push({ value: val, text: txt });
              }
            }
          }
          
          console.log(`📋 Parsed options: ${JSON.stringify(parsedOptions)}`);
          
          let targetMonths = Number(duration);
          if (durationIn === 'days') targetMonths = Math.max(1, Math.ceil(Number(duration) / 30));
          
          const exactMatch = parsedOptions.find(o => {
            const textLower = o.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (targetMonths === 1 && textLower.includes('1 mes')) return true;
            if (targetMonths > 1 && textLower.includes(`${targetMonths} meses`)) return true;
            return false;
          });
          
          if (exactMatch) {
            validOption = exactMatch.value;
            console.log(`✅ Exact match: value="${exactMatch.value}", text="${exactMatch.text}"`);
          } else {
            const partialMatch = parsedOptions.find(o => {
              const nums = o.text.match(/(\d+)/);
              return nums && Number(nums[1]) === targetMonths;
            });
            if (partialMatch) {
              validOption = partialMatch.value;
              console.log(`✅ Partial match: value="${partialMatch.value}"`);
            } else if (parsedOptions.length > 0) {
              validOption = parsedOptions[0].value;
              console.log(`⚠️ No match, using first: value="${parsedOptions[0].value}"`);
            }
          }
        }
      } catch (e: any) {
        console.log(`⚠️ Could not fetch extend page: ${e.message}`);
      }

      if (clienteScreens) {
        const screens = Math.min(Number(clienteScreens) || 1, 3);
        maxCons = String(screens);
        console.log(`📺 Telas: ${clienteScreens} → ${maxCons}`);
      }

      if (!validOption) {
        let months = Number(duration);
        if (durationIn === 'days') months = Math.max(1, Math.ceil(months / 30));
        validOption = String(months);
        console.log(`⚠️ Using fallback option: ${validOption}`);
      }

      console.log(`📤 Extend: user_id=${resolvedUserId}, option=${validOption}, connections=${maxCons}`);

      const extendBody = new URLSearchParams();
      extendBody.append('_token', login.csrf);
      extendBody.append('option', validOption);
      extendBody.append('connections', maxCons);

      const extendResp = await withTimeout(relayFetch(`${cleanBase}/clients/${resolvedUserId}/extend`, {
        method: 'POST',
        headers: {
          'Cookie': login.cookies, 'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': login.csrf,
          'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': `${cleanBase}/clients`,
        },
        body: extendBody.toString(),
      }), MUNDOGF_API_TIMEOUT_MS);

      const extendText = await extendResp.text();
      let extendJson: any = null;
      try { extendJson = JSON.parse(extendText); } catch {}

      console.log(`📊 Extend → status: ${extendResp.status}, response: ${extendText.slice(0, 300)}`);

      if ((extendResp.status >= 200 && extendResp.status < 300) && extendJson?.success) {
        const authHeader = req.headers.get('authorization');
        let userId: string | null = null;
        if (authHeader) {
          const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
          const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
          userId = user?.id || null;
        }

        if (userId) {
          await supabase.from('logs_painel').insert({
            user_id: userId,
            acao: `Renovação MundoGF: cliente ${username || resolvedUserId} → +${duration} ${durationIn} (Painel: ${panel.nome})`,
            tipo: 'renovacao',
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: extendJson.message || 'Cliente renovado com sucesso',
          copyMessage: extendJson.copyMessage || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: extendJson?.message || 'Falha ao renovar cliente',
        details: extendText.slice(0, 500),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Action inválida. Use: get_credits, list_clients, renew_client' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });

  } catch (error) {
    console.error(`❌ Erro: ${(error as Error).message}`);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
