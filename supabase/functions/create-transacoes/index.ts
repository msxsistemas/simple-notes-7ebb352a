// Edge function for creating transacoes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Usar variáveis de ambiente do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('Criando tabela transacoes...')

    // SQL para criar a tabela
    const sql = `
      CREATE TABLE IF NOT EXISTS transacoes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        valor DECIMAL(10, 2) NOT NULL,
        tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        descricao TEXT NOT NULL,
        data_transacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

      CREATE POLICY IF NOT EXISTS "Allow all operations" ON transacoes
        FOR ALL USING (true);
    `

    // Fazer requisição SQL direta para o Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Erro na requisição SQL: ${response.status} - ${errorText}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Tabela transacoes criada com sucesso!' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar tabela:', error)
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        details: 'Erro ao criar tabela transacoes'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})