import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { sigmaLogin, renewSigmaCustomer, fetchSigmaCustomers } from '@/utils/sigma-api';
import { toast } from 'sonner';

/**
 * Hook that checks for clients with renovacao_pendente=true
 * and automatically processes them via the browser (bypasses Cloudflare).
 * Runs once on mount.
 */
export function usePendingRenewals() {
  const { userId } = useCurrentUser();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!userId || processingRef.current) return;
    processingRef.current = true;

    processAllPending(userId).finally(() => {
      processingRef.current = false;
    });
  }, [userId]);
}

async function processAllPending(userId: string) {
  try {
    // Fetch clients with pending renewals - use type assertion for new columns
    const { data: clientes, error } = await (supabase
      .from('clientes')
      .select('*')
      .eq('user_id', userId) as any)
      .eq('renovacao_pendente', true);

    if (error || !clientes || clientes.length === 0) return;

    console.log(`🔄 ${clientes.length} renovação(ões) pendente(s) encontrada(s)`);

    // Group by panel to reuse login tokens
    const byPanel = new Map<string, typeof clientes>();
    for (const c of clientes) {
      const dados = (c as any).renovacao_pendente_dados as any;
      if (!dados?.painel_id) continue;
      const key = dados.painel_id;
      if (!byPanel.has(key)) byPanel.set(key, []);
      byPanel.get(key)!.push(c);
    }

    for (const [painelId, clientesList] of byPanel) {
      await processPanel(userId, painelId, clientesList);
    }
  } catch (err) {
    console.error('Erro ao processar renovações pendentes:', err);
  }
}

async function processPanel(userId: string, painelId: string, clientes: any[]) {
  try {
    // Get panel credentials
    const { data: painel } = await supabase
      .from('paineis_integracao')
      .select('*')
      .eq('id', painelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!painel) {
      console.warn(`Painel ${painelId} não encontrado`);
      return;
    }

    // Resolve vault credentials if needed
    let usuario = painel.usuario;
    let senha = painel.senha;
    if (usuario === 'vault' || senha === 'vault') {
      const [uR, sR] = await Promise.all([
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `usuario_${painel.id}` }),
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `senha_${painel.id}` }),
      ]);
      if (uR.data) usuario = uR.data;
      if (sR.data) senha = sR.data;
    }

    const baseUrl = painel.url.replace(/\/+$/, '');

    // Login via browser (bypasses Cloudflare)
    console.log(`🔑 Login no painel ${painel.nome}...`);
    const token = await sigmaLogin(baseUrl, usuario, senha);
    console.log(`✅ Login OK no painel ${painel.nome}`);

    // Process each client
    for (const cliente of clientes) {
      const dados = (cliente as any).renovacao_pendente_dados as any;
      const username = dados?.usuario_painel || cliente.usuario;

      try {
        console.log(`🔍 Buscando "${username}" no painel...`);
        const { data: customers } = await fetchSigmaCustomers(baseUrl, token, 1, username, 5);
        const found = customers.find((c: any) => c.username === username);

        if (!found) {
          console.warn(`Cliente "${username}" não encontrado no painel`);
          continue;
        }

        console.log(`🔄 Renovando "${username}"...`);
        await renewSigmaCustomer(baseUrl, token, found.id, found.package_id, found.connections || 1);
        console.log(`✅ "${username}" renovado com sucesso!`);

        // Process additional accesses
        const acessos = dados?.acessos_adicionais || [];
        for (const acesso of acessos) {
          if (!acesso.usuario) continue;
          try {
            const { data: adicCustomers } = await fetchSigmaCustomers(baseUrl, token, 1, acesso.usuario, 5);
            const adicFound = adicCustomers.find((c: any) => c.username === acesso.usuario);
            if (adicFound) {
              await renewSigmaCustomer(baseUrl, token, adicFound.id, adicFound.package_id, adicFound.connections || 1);
              console.log(`✅ Acesso adicional "${acesso.usuario}" renovado`);
            }
          } catch (adicErr: any) {
            console.error(`❌ Acesso adicional "${acesso.usuario}": ${adicErr.message}`);
          }
        }

        // Clear the pending flag
        await supabase.from('clientes').update({
          renovacao_pendente: false as any,
          renovacao_pendente_dados: null as any,
        }).eq('id', cliente.id);

        // Log success
        await supabase.from('logs_painel').insert({
          user_id: userId,
          acao: `Renovação pendente concluída via frontend: ${cliente.nome} (${username})`,
          tipo: 'renovacao',
        });

        toast.success(`Renovação pendente concluída: ${cliente.nome}`);
      } catch (renewErr: any) {
        console.error(`❌ Renovação pendente falhou para "${username}": ${renewErr.message}`);
        toast.error(`Falha na renovação de ${cliente.nome}: ${renewErr.message}`);
      }
    }
  } catch (err: any) {
    console.error(`❌ Erro ao processar painel ${painelId}: ${err.message}`);
  }
}
