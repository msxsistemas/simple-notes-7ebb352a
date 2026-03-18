import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, Plano, Produto } from '@/types/database';
import { useCurrentUser } from './useCurrentUser';
import { logPainel } from '@/utils/logger';

interface TransacaoFinanceira {
  id: string;
  cliente: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  detalheTitulo: string;
  detalheValor: string;
  isCustom?: boolean;
  descricao?: string;
}

interface NovaTransacao {
  valor: number;
  tipo: 'entrada' | 'saida';
  descricao: string;
}

interface DadosFinanceiros {
  entradas: number;
  saidas: number;
  lucros: number;
  lucrosMes: number;
  lucrosAno: number;
  projecaoMensal: number;
  transacoes: TransacaoFinanceira[];
  loading: boolean;
  error: string | null;
  salvarTransacao: (transacao: NovaTransacao) => Promise<void>;
  editarTransacao: (id: string, transacao: NovaTransacao) => Promise<void>;
  excluirTransacao: (id: string) => Promise<void>;
}

export function useFinanceiro(): DadosFinanceiros {
  const { userId } = useCurrentUser();
  const [dados, setDados] = useState({
    entradas: 0,
    saidas: 0,
    lucros: 0,
    lucrosMes: 0,
    lucrosAno: 0,
    projecaoMensal: 0,
    transacoes: [] as TransacaoFinanceira[],
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    if (userId) {
      carregarDadosFinanceiros();
    }
  }, [userId]);

  const carregarDadosFinanceiros = async () => {
    try {
      if (!userId) return;
      
      setDados(prev => ({ ...prev, loading: true, error: null }));

      const fetchAllPaginated = async <T>(query: any): Promise<T[]> => {
        const PAGE_SIZE = 1000;
        let all: T[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data as T[]);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return all;
      };

      const [clientes, planos, produtos, faturasPagasRaw] = await Promise.all([
        fetchAllPaginated<Cliente>(supabase.from('clientes').select('*')),
        fetchAllPaginated<Plano>(supabase.from('planos').select('*')),
        fetchAllPaginated<Produto>(supabase.from('produtos').select('*')),
        fetchAllPaginated<any>(
          supabase.from('faturas').select('*').eq('status', 'pago').not('paid_at', 'is', null)
        ).catch(() => [] as any[]),
      ]);

      let transacoesCustomizadas: any[] = [];
      try {
        const { data } = await supabase
          .from('transacoes')
          .select('*')
          .order('created_at', { ascending: false });
        transacoesCustomizadas = data || [];
      } catch {
        // Table might not exist
      }

      const planosMap = new Map(planos.map(p => [p.id!, p]));
      const produtosMap = new Map(produtos.map(p => [p.id!, p]));

      let totalEntradas = 0;
      let totalSaidas = 0;
      let entradasMes = 0;
      let saidasMes = 0;
      let entradasAno = 0;
      let saidasAno = 0;
      const transacoes: TransacaoFinanceira[] = [];

      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const inicioAno = new Date(now.getFullYear(), 0, 1);

      const faturasPagas = faturasPagasRaw || [];

      // Track which clients have paid faturas
      const clientesComFatura = new Set<string>();
      faturasPagas.forEach((fatura: any) => {
        if (fatura.cliente_id) clientesComFatura.add(fatura.cliente_id);
      });

      // 1) ENTRADAS: ALL paid faturas (covers initial + renewals)
      faturasPagas.forEach((fatura: any) => {
        const valor = Number(fatura.valor) || 0;
        const dataPagamento = new Date(fatura.paid_at);
        
        totalEntradas += valor;
        if (dataPagamento >= inicioMes) entradasMes += valor;
        if (dataPagamento >= inicioAno) entradasAno += valor;

        transacoes.push({
          id: `fatura-${fatura.id}`,
          cliente: fatura.cliente_nome || 'Cliente',
          tipo: 'entrada',
          valor,
          data: dataPagamento.toLocaleString('pt-BR'),
          detalheTitulo: fatura.plano_nome ? 'Pagamento' : 'Pagamento',
          detalheValor: fatura.plano_nome || (fatura.gateway || 'Pagamento'),
          isCustom: false,
        });
      });

      // 2) ENTRADAS: Clientes SEM faturas (fallback - valor do plano na criação)
      const clientesAtivos = clientes.filter(c => (c as any).ativo !== false);
      clientesAtivos.forEach(cliente => {
        if (cliente.id && clientesComFatura.has(cliente.id)) return; // já contado via faturas
        if (cliente.plano && planosMap.has(cliente.plano)) {
          const plano = planosMap.get(cliente.plano)!;
          const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
          const valorPlano = parseFloat(valorStr);
          
          if (!isNaN(valorPlano)) {
            const dataCliente = new Date(cliente.created_at || '');
            totalEntradas += valorPlano;
            if (dataCliente >= inicioMes) entradasMes += valorPlano;
            if (dataCliente >= inicioAno) entradasAno += valorPlano;
            
            transacoes.push({
              id: `entrada-${cliente.id}`,
              cliente: cliente.nome,
              tipo: 'entrada',
              valor: valorPlano,
              data: new Date(cliente.created_at || new Date()).toLocaleString('pt-BR'),
              detalheTitulo: 'Novo cliente',
              detalheValor: plano.nome,
              isCustom: false,
            });
          }
        }
      });

      // 3) SAÍDAS: Custo servidor baseado nos clientes ativos com produtos
      const clientesAtivosParaCusto = clientes.filter(c => (c as any).ativo !== false);
      clientesAtivosParaCusto.forEach(cliente => {
        if (cliente.produto && produtosMap.has(cliente.produto)) {
          const produto = produtosMap.get(cliente.produto)!;
          const valorStr = produto.valor.replace(/[R$\s]/g, '').replace(',', '.');
          const valorProduto = parseFloat(valorStr);
          
          if (!isNaN(valorProduto) && valorProduto > 0) {
            let multiplicador = 1;
            if (cliente.plano && planosMap.has(cliente.plano)) {
              const planoCliente = planosMap.get(cliente.plano)!;
              const quantidade = parseInt(String(planoCliente.quantidade || '1')) || 1;
              const tipo = planoCliente.tipo || 'meses';
              if (tipo === 'meses') multiplicador = quantidade;
              else if (tipo === 'anos') multiplicador = quantidade * 12;
              else if (tipo === 'dias') multiplicador = Math.ceil(quantidade / 30);
            }
            
            const custoTotal = valorProduto * multiplicador;
            const dataCliente = new Date(cliente.created_at || '');
            totalSaidas += custoTotal;
            if (dataCliente >= inicioMes) saidasMes += custoTotal;
            if (dataCliente >= inicioAno) saidasAno += custoTotal;
            
            transacoes.push({
              id: `saida-${cliente.id}`,
              cliente: cliente.nome,
              tipo: 'saida',
              valor: custoTotal,
              data: new Date(cliente.created_at || new Date()).toLocaleString('pt-BR'),
              detalheTitulo: 'Custo servidor',
              detalheValor: `${produto.nome} (R$ ${valorProduto.toFixed(2)} × ${multiplicador})`,
              isCustom: false,
            });
          }
        }
      });

      // 4) Transações customizadas
      transacoesCustomizadas.forEach((transacao: any) => {
        const valor = parseFloat(transacao.valor);
        if (!isNaN(valor)) {
          const dataTransacao = new Date(transacao.created_at);
          if (transacao.tipo === 'entrada') {
            totalEntradas += valor;
            if (dataTransacao >= inicioMes) entradasMes += valor;
            if (dataTransacao >= inicioAno) entradasAno += valor;
          } else {
            totalSaidas += valor;
            if (dataTransacao >= inicioMes) saidasMes += valor;
            if (dataTransacao >= inicioAno) saidasAno += valor;
          }

          const linhas = transacao.descricao.split('\n');
          const cliente = linhas[0] || 'Transação customizada';
          const detalhe = linhas.slice(1).join(' ') || 'Sem detalhes';

          transacoes.push({
            id: transacao.id,
            cliente,
            tipo: transacao.tipo,
            valor,
            data: new Date(transacao.created_at).toLocaleString('pt-BR'),
            detalheTitulo: 'Customizada',
            detalheValor: detalhe,
            isCustom: true,
            descricao: transacao.descricao,
          });
        }
      });

      const lucros = totalEntradas - totalSaidas;

      // Projeção mensal baseada nos planos dos clientes ativos
      let projecaoMensal = 0;
      clientesAtivos.forEach(cliente => {
        if (cliente.plano && planosMap.has(cliente.plano)) {
          const plano = planosMap.get(cliente.plano)!;
          const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
          const valorPlano = parseFloat(valorStr);
          if (!isNaN(valorPlano)) projecaoMensal += valorPlano;
        }
      });

      setDados({
        entradas: totalEntradas,
        saidas: totalSaidas,
        lucros,
        lucrosMes: entradasMes - saidasMes,
        lucrosAno: entradasAno - saidasAno,
        projecaoMensal,
        transacoes: transacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('❌ Erro ao carregar dados financeiros:', error);
      setDados(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar dados financeiros',
      }));
    }
  };

  const salvarTransacao = async (novaTransacao: NovaTransacao) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      let { error } = await supabase
        .from('transacoes')
        .insert({
          valor: novaTransacao.valor,
          tipo: novaTransacao.tipo,
          descricao: novaTransacao.descricao,
          user_id: userId,
        });

      if (error && error.code === 'PGRST205') {
        try {
          const { data: createResult, error: createError } = await supabase.functions.invoke('create-transacoes');
          if (createError) throw new Error(`Erro ao criar tabela: ${createError.message}`);
          
          const { error: insertError } = await supabase
            .from('transacoes')
            .insert({
              valor: novaTransacao.valor,
              tipo: novaTransacao.tipo,
              descricao: novaTransacao.descricao,
              user_id: userId,
            });
          if (insertError) throw insertError;
        } catch (createErr) {
          console.error('Erro ao criar tabela automaticamente:', createErr);
          throw new Error('A tabela de transações não existe e não foi possível criá-la automaticamente. Contacte o suporte.');
        }
      } else if (error) {
        throw error;
      }

      logPainel(`Transação ${novaTransacao.tipo} registrada: R$ ${novaTransacao.valor}`, "success");
      await carregarDadosFinanceiros();
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      throw error;
    }
  };

  const editarTransacao = async (id: string, transacaoEditada: NovaTransacao) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .update({
          valor: transacaoEditada.valor,
          tipo: transacaoEditada.tipo,
          descricao: transacaoEditada.descricao,
        })
        .eq('id', id);
      if (error) throw error;
      await carregarDadosFinanceiros();
    } catch (error) {
      console.error('Erro ao editar transação:', error);
      throw error;
    }
  };

  const excluirTransacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await carregarDadosFinanceiros();
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      throw error;
    }
  };

  return {
    ...dados,
    salvarTransacao,
    editarTransacao,
    excluirTransacao,
  };
}
