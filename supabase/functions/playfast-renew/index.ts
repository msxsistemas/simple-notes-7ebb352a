// Edge function for Playfast renewal

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLAYFAST_API_BASE = 'https://api.painelcliente.com';

function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
  return Promise.race([
    promise,
    new Promise<Response>((_, reject) => setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)),
  ]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, secret, username, month, action } = await req.json();

    if (!token || !secret) {
      return new Response(JSON.stringify({ success: false, error: 'TOKEN e Secret são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default action: renew
    const currentAction = action || 'renew';

    if (currentAction === 'profile') {
      // Obter perfil do revenda
      const resp = await withTimeout(fetch(`${PLAYFAST_API_BASE}/profile/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ secret }),
      }), 15000);

      const data = await resp.json();

      if (data.result === true && data.data) {
        return new Response(JSON.stringify({
          success: true,
          credits: data.data.credits,
          username: data.data.username,
          email: data.data.email,
          status: data.data.status,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: data.mens || 'Falha ao obter perfil',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (currentAction === 'renew') {
      if (!username || !month) {
        return new Response(JSON.stringify({ success: false, error: 'username e month são obrigatórios para renovação' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resp = await withTimeout(fetch(`${PLAYFAST_API_BASE}/renew_client/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ secret, username, month }),
      }), 15000);

      const data = await resp.json();

      if (data.result === true && data.data) {
        return new Response(JSON.stringify({
          success: true,
          username: data.data.username,
          exp_date: data.data.exp_date,
          credits: data.data.credits,
          message: data.data.mens || 'Renovado com sucesso',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit check
      if (data.statusCode === 429) {
        return new Response(JSON.stringify({
          success: false,
          error: data.mens || 'Aguarde 1 minuto antes de renovar este usuário novamente',
          rateLimited: true,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: data.mens || 'Falha na renovação',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (currentAction === 'get_client') {
      if (!username) {
        return new Response(JSON.stringify({ success: false, error: 'username é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resp = await withTimeout(fetch(`${PLAYFAST_API_BASE}/get_client/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ secret, username }),
      }), 15000);

      const data = await resp.json();

      if (data.result === true && data.data) {
        return new Response(JSON.stringify({
          success: true,
          client: data.data,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: data.mens || 'Cliente não encontrado',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Ação desconhecida: ${currentAction}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Playfast renew error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
