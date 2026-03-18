// Sigma API - chamadas diretas do navegador (bypassa Cloudflare)

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function sigmaLogin(baseUrl: string, username: string, password: string): Promise<string> {
  const url = normalizeUrl(baseUrl);
  const routes = ['/api/auth/login', '/api/login', '/login', '/auth/login'];
  const payload = {
    username,
    password,
    captcha: 'not-a-robot',
    captchaChecked: true,
    twofactor_code: '',
    twofactor_recovery_code: '',
    twofactor_trusted_device_id: '',
  };

  let lastError = 'Sem resposta do servidor';

  for (const route of routes) {
    const response = await fetch(`${url}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    if (!response.ok) {
      lastError = `${route} -> HTTP ${response.status}: ${rawText.substring(0, 120)}`;
      continue;
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      lastError = `${route} -> resposta inválida (não-JSON)`;
      continue;
    }

    if (data?.token) return data.token;
    lastError = `${route} -> token não retornado`;
  }

  throw new Error(`Login falhou em todas as rotas (${lastError}). Verifique URL e credenciais.`);
}

export async function fetchSigmaCustomers(
  baseUrl: string, token: string, page = 1, username = '', perPage = 20, status = ''
) {
  const url = normalizeUrl(baseUrl);
  const params = new URLSearchParams({
    page: String(page),
    username,
    serverId: '',
    packageId: '',
    expiryFrom: '',
    expiryTo: '',
    status,
    isTrial: '',
    connections: '',
    perPage: String(perPage),
  });

  const response = await fetch(`${url}/api/customers?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`Busca falhou (${response.status})`);
  const result = await response.json();
  return { data: result.data || [], total: result.meta?.total ?? 0 };
}

export async function renewSigmaCustomer(
  baseUrl: string, token: string, customerId: number | string, packageId: number | string, connections: number
) {
  const url = normalizeUrl(baseUrl);
  const response = await fetch(`${url}/api/customers/${customerId}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ package_id: packageId, connections }),
  });

  if (!response.ok) throw new Error(`Renovação falhou (${response.status})`);
  const result = await response.json();
  return result.data;
}

export async function checkSigmaCredits(baseUrl: string, token: string) {
  const url = normalizeUrl(baseUrl);
  const response = await fetch(`${url}/api/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`Consulta falhou (${response.status})`);
  return response.json();
}
