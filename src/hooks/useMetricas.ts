import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, Plano, Produto } from '@/types/database';
import { useCurrentUser } from './useCurrentUser';

// Utility to fetch all rows bypassing Supabase 1000-row limit
async function fetchAllRows<T>(
  table: 'clientes' | 'planos' | 'produtos',
  userId: string,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data as T[]);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allRows;
}

interface MetricasClientes {
  totalClientes: number;
  clientesAtivos: number;
  clientesVencidos: number;
  clientesNovosHoje: number;
  clientesNovosData: Array<{ day: string; total: number; }>;
  loading: boolean;
  error: string | null;
}

interface MetricasPagamentos {
  totalPagamentos: number;
  valorTotalMes: number;
  mediaPorDia: number;
  pagamentosData: Array<{ day: string; valor: number; custos: number; }>;
  loading: boolean;
  error: string | null;
}

interface MetricasRenovacoes {
  totalRenovacoes: number;
  renovacoesHoje: number;
  mediaPorDia: number;
  renovacoesData: Array<{ day: string; total: number; }>;
  loading: boolean;
  error: string | null;
}

export function useMetricasClientes(): MetricasClientes {
  const { userId } = useCurrentUser();
  const [metricas, setMetricas] = useState<MetricasClientes>({
    totalClientes: 0,
    clientesAtivos: 0,
    clientesVencidos: 0,
    clientesNovosHoje: 0,
    clientesNovosData: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (userId) {
      carregarMetricasClientes();
    }
  }, [userId]);

  const carregarMetricasClientes = async () => {
    try {
      if (!userId) return;
      
      setMetricas(prev => ({ ...prev, loading: true, error: null }));

      const clientes = await fetchAllRows<Cliente>('clientes', userId);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const inicioMesAtual = new Date();
      inicioMesAtual.setDate(1);
      inicioMesAtual.setHours(0, 0, 0, 0);

      const clientesDoMesAtual = clientes.filter(cliente => {
        const dataCliente = new Date(cliente.created_at || '');
        return dataCliente >= inicioMesAtual;
      });

      const clientesNovosHoje = clientes.filter(cliente => {
        const dataCliente = new Date(cliente.created_at || '');
        dataCliente.setHours(0, 0, 0, 0);
        return dataCliente.getTime() === hoje.getTime();
      }).length;

      const clientesNovosData = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        data.setHours(0, 0, 0, 0);
        
        const clientesDoDia = clientes.filter(cliente => {
          const dataCliente = new Date(cliente.created_at || '');
          dataCliente.setHours(0, 0, 0, 0);
          return dataCliente.getTime() === data.getTime();
        }).length;

        clientesNovosData.push({
          day: `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`,
          total: clientesDoDia
        });
      }

      const agora = new Date();
      let clientesAtivos = 0;
      let clientesVencidos = 0;

      clientes.forEach(cliente => {
        if (!cliente.data_vencimento) {
          clientesAtivos++;
        } else {
          const dataVencimento = new Date(cliente.data_vencimento);
          if (dataVencimento >= agora) {
            clientesAtivos++;
          } else {
            clientesVencidos++;
          }
        }
      });

      setMetricas({
        totalClientes: clientesDoMesAtual.length,
        clientesAtivos,
        clientesVencidos,
        clientesNovosHoje,
        clientesNovosData,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Erro ao carregar métricas de clientes:', error);
      setMetricas(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar métricas de clientes',
      }));
    }
  };

  return metricas;
}

export function useMetricasPagamentos(): MetricasPagamentos {
  const { userId } = useCurrentUser();
  const [metricas, setMetricas] = useState<MetricasPagamentos>({
    totalPagamentos: 0,
    valorTotalMes: 0,
    mediaPorDia: 0,
    pagamentosData: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (userId) {
      carregarMetricasPagamentos();
    }
  }, [userId]);

  const carregarMetricasPagamentos = async () => {
    try {
      if (!userId) return;
      
      setMetricas(prev => ({ ...prev, loading: true, error: null }));

      // Fetch clients, plans, products, and paid invoices in parallel
      const [clientes, planos, produtos] = await Promise.all([
        fetchAllRows<Cliente>('clientes', userId),
        fetchAllRows<Plano>('planos', userId),
        fetchAllRows<Produto>('produtos', userId),
      ]);

      // Fetch paid faturas for this user
      let faturasPagas: Array<{ valor: number; paid_at: string; cliente_id: string | null; id: string }> = [];
      try {
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('faturas')
            .select('id, valor, paid_at, cliente_id')
            .eq('user_id', userId)
            .eq('status', 'pago')
            .not('paid_at', 'is', null)
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          faturasPagas = faturasPagas.concat(data as any[]);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      } catch {
        // faturas table might not exist yet
      }

      // Also fetch custom transactions (entradas)
      let transacoesEntrada: Array<{ valor: number; created_at: string }> = [];
      try {
        const { data } = await supabase
          .from('transacoes')
          .select('valor, created_at')
          .eq('user_id', userId)
          .eq('tipo', 'entrada');
        transacoesEntrada = (data || []) as any[];
      } catch {
        // table might not exist
      }

      // Also fetch successful renewal logs (manual/auto renewals not linked to paid faturas)
      let logsRenovacao: Array<{ id: string; acao: string; created_at: string }> = [];
      try {
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('logs_painel')
            .select('id, acao, created_at')
            .eq('user_id', userId)
            .eq('tipo', 'renovacao')
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          logsRenovacao = logsRenovacao.concat(data as any[]);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      } catch {
        // logs table might not be available
      }

      const planosMap = new Map(planos.map(p => [p.id!, p]));
      const produtosMap = new Map(produtos.map(p => [p.id!, p]));
      const clientesMap = new Map(clientes.map(c => [c.id!, c]));

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const parseCurrency = (raw?: string | null): number => {
        if (!raw) return 0;
        const cleaned = raw.replace(/[R$\s]/g, '');
        const normalized = cleaned.includes(',')
          ? cleaned.replace(/\./g, '').replace(',', '.')
          : cleaned;
        const value = parseFloat(normalized);
        return Number.isFinite(value) ? value : 0;
      };

      const getPlanoValor = (cliente: Cliente): number => {
        if (!cliente.plano || !planosMap.has(cliente.plano)) return 0;
        return parseCurrency(planosMap.get(cliente.plano)!.valor);
      };

      // Helper: get product cost for a client
      const getCustoServidor = (cliente: Cliente): number => {
        if (!cliente.produto || !produtosMap.has(cliente.produto)) return 0;
        const produto = produtosMap.get(cliente.produto)!;
        const valorProduto = parseCurrency(produto.valor);
        if (isNaN(valorProduto) || valorProduto <= 0) return 0;
        let multiplicador = 1;
        if (cliente.plano && planosMap.has(cliente.plano)) {
          const planoCliente = planosMap.get(cliente.plano)!;
          const quantidade = parseInt(String(planoCliente.quantidade || '1')) || 1;
          const tipo = planoCliente.tipo || 'meses';
          if (tipo === 'meses') multiplicador = quantidade;
          else if (tipo === 'anos') multiplicador = quantidade * 12;
          else if (tipo === 'dias') multiplicador = Math.ceil(quantidade / 30);
        }
        return valorProduto * multiplicador;
      };

      const makeDayKey = (d: Date) => {
        const dd = new Date(d);
        dd.setHours(0, 0, 0, 0);
        return `${dd.getDate().toString().padStart(2, '0')}/${(dd.getMonth() + 1).toString().padStart(2, '0')}/${dd.getFullYear()}`;
      };

      // Maps for chart: vendas and custos per day
      const vendasMap = new Map<string, number>();
      const custosMap = new Map<string, number>();

      const addToMap = (map: Map<string, number>, key: string, valor: number) => {
        map.set(key, (map.get(key) || 0) + valor);
      };

      const normalizarDigitos = (text?: string | null) => (text || '').replace(/\D/g, '');
      const normalizarTexto = (text?: string | null) => (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

      // Track paid faturas by cliente/day for dedupe with renewal logs
      // Use client ID, usuario, AND whatsapp to catch duplicates even when multiple clients share identifiers
      const faturasPagasPorClienteDia = new Set<string>();
      const faturasPagasPorUsuarioDia = new Set<string>();
      const faturasPagasPorWhatsappDia = new Set<string>();
      faturasPagas.forEach(f => {
        if (f.cliente_id && f.paid_at) {
          const dayKey = makeDayKey(new Date(f.paid_at));
          faturasPagasPorClienteDia.add(`${f.cliente_id}|${dayKey}`);
          const cliente = clientesMap.get(f.cliente_id);
          if (cliente) {
            const usuario = normalizarTexto(cliente.usuario);
            if (usuario) faturasPagasPorUsuarioDia.add(`${usuario}|${dayKey}`);
            const whatsapp = normalizarDigitos(cliente.whatsapp);
            if (whatsapp) faturasPagasPorWhatsappDia.add(`${whatsapp}|${dayKey}`);
          }
        }
      });

      // 1) ALL paid faturas → venda (valor fatura) + custo servidor (valor produto do cliente)
      // This covers renewals AND initial payments
      faturasPagas.forEach(f => {
        if (!f.paid_at) return;
        const dayKey = makeDayKey(new Date(f.paid_at));
        addToMap(vendasMap, dayKey, f.valor);
        if (f.cliente_id && clientesMap.has(f.cliente_id)) {
          const cliente = clientesMap.get(f.cliente_id)!;
          const custo = getCustoServidor(cliente);
          if (custo > 0) addToMap(custosMap, dayKey, custo);
        }
      });

      // Build lookup maps from ALL clients (not just active) so we can match renewal logs for any client
      const clientesByWhatsapp = new Map<string, Cliente[]>();
      const clientesByUsuario = new Map<string, Cliente[]>();
      const clientesByNome = new Map<string, Cliente[]>();

      clientes.forEach(cliente => {
        const whatsapp = normalizarDigitos(cliente.whatsapp);
        if (whatsapp) {
          const list = clientesByWhatsapp.get(whatsapp) || [];
          list.push(cliente);
          clientesByWhatsapp.set(whatsapp, list);
        }
        const usuario = normalizarTexto(cliente.usuario);
        if (usuario) {
          const list = clientesByUsuario.get(usuario) || [];
          list.push(cliente);
          clientesByUsuario.set(usuario, list);
        }
        const nome = normalizarTexto(cliente.nome);
        if (nome) {
          const list = clientesByNome.get(nome) || [];
          list.push(cliente);
          clientesByNome.set(nome, list);
        }
      });

      const pickBestCliente = (list?: Cliente[]) => {
        if (!list || list.length === 0) return null;
        if (list.length === 1) return list[0];
        const sorted = [...list].sort((a, b) => {
          const ativoA = (a as any).ativo === false ? 0 : 1;
          const ativoB = (b as any).ativo === false ? 0 : 1;
          if (ativoA !== ativoB) return ativoB - ativoA;
          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return createdB - createdA;
        });
        return sorted[0] ?? null;
      };

      const isLogRenovacaoValido = (acao: string) => {
        const l = normalizarTexto(acao);
        // Accept all logs with tipo='renovacao' that are successful
        if (l.includes('falhou') || l.includes('erro') || l.includes('❌')) return false;
        return true;
      };

      const extrairClienteDoLog = (acao: string): Cliente | null => {
        console.log(`📊 [Parse] Parsing log: "${acao.substring(0, 120)}"`);
        
        const phoneMatch = acao.match(/\((\+?[\d\s\-().]{8,})\)/);
        if (phoneMatch) {
          const phone = normalizarDigitos(phoneMatch[1]);
          console.log(`📊 [Parse] phoneMatch found: "${phone}" (len=${phone.length})`);
          if (phone.length >= 10) {
            const byPhone = pickBestCliente(clientesByWhatsapp.get(phone));
            if (byPhone) { console.log(`📊 [Parse] → matched by phone: ${byPhone.nome}`); return byPhone; }
          }
        }

        const usuarioConcluidaMatch = acao.match(/conclu[ií]da:\s*([a-zA-Z0-9._-]+)/i);
        if (usuarioConcluidaMatch) {
          const usuario = normalizarTexto(usuarioConcluidaMatch[1]);
          console.log(`📊 [Parse] concluída match: "${usuario}"`);
          const byUsuario = pickBestCliente(clientesByUsuario.get(usuario));
          if (byUsuario) { console.log(`📊 [Parse] → matched by concluída: ${byUsuario.nome}`); return byUsuario; }
        }

        const userMatch = acao.match(/cliente\s+([a-zA-Z0-9._-]+)/i) || acao.match(/\(([^)]+)\)/);
        if (userMatch) {
          const usuario = normalizarTexto(userMatch[1]);
          console.log(`📊 [Parse] userMatch: "${usuario}", exists in map: ${clientesByUsuario.has(usuario)}`);
          const byUsuario = pickBestCliente(clientesByUsuario.get(usuario));
          if (byUsuario) { console.log(`📊 [Parse] → matched by user: ${byUsuario.nome}`); return byUsuario; }
        }

        const nomeComUsuarioMatch = acao.match(/:\s*([^()→]+?)\s*\(([a-zA-Z0-9._-]+)\)/);
        if (nomeComUsuarioMatch) {
          const usuario = normalizarTexto(nomeComUsuarioMatch[2]);
          console.log(`📊 [Parse] nomeComUsuario: "${usuario}"`);
          const byUsuario = pickBestCliente(clientesByUsuario.get(usuario));
          if (byUsuario) { console.log(`📊 [Parse] → matched by nomeComUsuario: ${byUsuario.nome}`); return byUsuario; }
        }

        const nomeMatch = acao.match(/:\s*([^()→]+?)(?:\(|→|$)/);
        if (nomeMatch) {
          const nome = normalizarTexto(nomeMatch[1]);
          console.log(`📊 [Parse] nomeMatch: "${nome}"`);
          const byNome = pickBestCliente(clientesByNome.get(nome));
          if (byNome) { console.log(`📊 [Parse] → matched by nome: ${byNome.nome}`); return byNome; }
        }

        console.log(`📊 [Parse] → NO MATCH FOUND`);
        return null;
      };

      const logsRenovacaoContados = new Set<string>();
      const logsFallbackContados = new Set<string>();
      
      console.log(`📊 [Métricas] ${logsRenovacao.length} logs de renovação encontrados`);
      console.log(`📊 [Métricas] clientesByUsuario keys:`, Array.from(clientesByUsuario.keys()).join(', '));
      
      logsRenovacao.forEach(log => {
        if (!log.created_at) return;
        
        if (!isLogRenovacaoValido(log.acao)) {
          console.log(`📊 [Métricas] Log descartado (erro/falha): ${log.acao.substring(0, 80)}`);
          return;
        }

        const cliente = extrairClienteDoLog(log.acao);
        const dayKey = makeDayKey(new Date(log.created_at));

        if (!cliente?.id) {
          console.log(`📊 [Métricas] Log sem cliente identificado: ${log.acao.substring(0, 100)}`);
          const fallbackKey = `${log.id}|${dayKey}`;
          if (!logsFallbackContados.has(fallbackKey)) {
            logsFallbackContados.add(fallbackKey);
          }
          return;
        }

        const chave = `${cliente.id}|${dayKey}`;

        const usuarioKey = normalizarTexto(cliente.usuario);
        const whatsappKey = normalizarDigitos(cliente.whatsapp);
        const jaCobertoPorFatura = 
          faturasPagasPorClienteDia.has(chave) ||
          (usuarioKey && faturasPagasPorUsuarioDia.has(`${usuarioKey}|${dayKey}`)) ||
          (whatsappKey && faturasPagasPorWhatsappDia.has(`${whatsappKey}|${dayKey}`));

        if (jaCobertoPorFatura) {
          console.log(`📊 [Métricas] Log dedupado (fatura existe): ${cliente.nome} (${dayKey})`);
          return;
        }
        
        if (logsRenovacaoContados.has(chave)) {
          console.log(`📊 [Métricas] Log dedupado (já contado): ${cliente.nome} (${dayKey})`);
          return;
        }
        
        logsRenovacaoContados.add(chave);

        const valorPlano = getPlanoValor(cliente);
        const planoObj = cliente.plano ? planosMap.get(cliente.plano) : null;
        console.log(`📊 [Métricas] Log contado: ${cliente.nome} | plano=${cliente.plano} | planoFound=${!!planoObj} | planoValorRaw=${planoObj?.valor} | valorCalculado=R$${valorPlano} (${dayKey})`);
        if (valorPlano > 0) addToMap(vendasMap, dayKey, valorPlano);

        const custo = getCustoServidor(cliente);
        if (custo > 0) addToMap(custosMap, dayKey, custo);
      });

      console.log(`📊 [Métricas] === RESUMO FINAL ===`);
      console.log(`📊 [Métricas] Faturas pagas: ${faturasPagas.length}`);
      console.log(`📊 [Métricas] Logs renovação contados: ${logsRenovacaoContados.size}`);
      console.log(`📊 [Métricas] Logs fallback: ${logsFallbackContados.size}`);
      console.log(`📊 [Métricas] VendasMap:`, Object.fromEntries(vendasMap));
      console.log(`📊 [Métricas] CustosMap:`, Object.fromEntries(custosMap));
      console.log(`📊 [Métricas] PlanosMap keys:`, Array.from(planosMap.keys()).join(', '));

      // 3.5) Clientes novos SEM fatura paga → fallback pelo valor do plano (ativação)
      const clientesComFatura = new Set<string>();
      faturasPagas.forEach(f => {
        if (f.cliente_id) clientesComFatura.add(f.cliente_id);
      });

      clientes.forEach(cliente => {
        if (!cliente.id || clientesComFatura.has(cliente.id)) return;
        if ((cliente as any).ativo === false) return;
        const valorPlano = getPlanoValor(cliente);
        if (valorPlano <= 0) return;
        const dataCliente = new Date(cliente.created_at || '');
        const dayKey = makeDayKey(dataCliente);
        addToMap(vendasMap, dayKey, valorPlano);
        const custo = getCustoServidor(cliente);
        if (custo > 0) addToMap(custosMap, dayKey, custo);
      });

      // 4) Transações manuais de entrada
      const transacoesMap = new Map<string, number>();
      transacoesEntrada.forEach(t => {
        if (t.created_at) {
          addToMap(transacoesMap, makeDayKey(new Date(t.created_at)), t.valor);
        }
      });

      // Calculate totals for the month
      let valorTotalMes = 0;
      let totalPagamentos = 0;

      // Faturas pagas this month
      faturasPagas.forEach(f => {
        if (f.paid_at) {
          const d = new Date(f.paid_at);
          if (d >= inicioMes) {
            valorTotalMes += f.valor;
            totalPagamentos++;
          }
        }
      });

      // Sem fallback mensal por criação de cliente (evita inflar valor sem recebimento real)

      // Renewals from logs without paid fatura in same day
      logsRenovacaoContados.forEach(chave => {
        const [clienteId, dayKey] = chave.split('|');
        const [dia, mes, ano] = dayKey.split('/').map(Number);
        const dataEvento = new Date(ano, mes - 1, dia);
        if (dataEvento < inicioMes) return;

        const cliente = clientesMap.get(clienteId);
        if (!cliente) return;

        const valorPlano = getPlanoValor(cliente);
        if (valorPlano > 0) {
          valorTotalMes += valorPlano;
          totalPagamentos++;
        }
      });

      // Custom entrada transactions this month
      transacoesEntrada.forEach(t => {
        if (t.created_at) {
          const d = new Date(t.created_at);
          if (d >= inicioMes) valorTotalMes += t.valor;
        }
      });

      // Build pagamentosData for chart (last 7 days)
      const pagamentosData = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        data.setHours(0, 0, 0, 0);
        const dayKey = makeDayKey(data);

        const valor = (vendasMap.get(dayKey) || 0) + (transacoesMap.get(dayKey) || 0);
        const custos = custosMap.get(dayKey) || 0;

        pagamentosData.push({ day: dayKey, valor, custos });
      }

      const diasNoMes = new Date().getDate();
      const mediaPorDia = valorTotalMes / diasNoMes;

      setMetricas({
        totalPagamentos,
        valorTotalMes,
        mediaPorDia,
        pagamentosData,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Erro ao carregar métricas de pagamentos:', error);
      setMetricas(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar métricas de pagamentos',
      }));
    }
  };

  return metricas;
}

export function useMetricasRenovacoes(): MetricasRenovacoes {
  const { userId } = useCurrentUser();
  const [metricas, setMetricas] = useState<MetricasRenovacoes>({
    totalRenovacoes: 0,
    renovacoesHoje: 0,
    mediaPorDia: 0,
    renovacoesData: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (userId) {
      carregarMetricasRenovacoes();
    }
  }, [userId]);

  const carregarMetricasRenovacoes = async () => {
    try {
      if (!userId) return;
      
      setMetricas(prev => ({ ...prev, loading: true, error: null }));

      const clientes = await fetchAllRows<Cliente>('clientes', userId);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const inicioMesAtual = new Date();
      inicioMesAtual.setDate(1);
      inicioMesAtual.setHours(0, 0, 0, 0);

      const makeDayKey = (d: Date) => {
        const dd = new Date(d);
        dd.setHours(0, 0, 0, 0);
        return `${dd.getDate().toString().padStart(2, '0')}/${(dd.getMonth() + 1).toString().padStart(2, '0')}/${dd.getFullYear()}`;
      };

      // Fetch paid faturas to identify real renewals (2nd+ fatura per client)
      let faturasPagas: Array<{ id: string; cliente_id: string | null; paid_at: string | null }> = [];
      try {
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('faturas')
            .select('id, cliente_id, paid_at')
            .eq('user_id', userId)
            .eq('status', 'pago')
            .not('paid_at', 'is', null)
            .order('paid_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          faturasPagas = faturasPagas.concat(data as any[]);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      } catch { /* faturas table might not exist */ }

      // Fetch renewal logs
      let logsRenovacao: Array<{ id: string; acao: string; created_at: string }> = [];
      try {
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('logs_painel')
            .select('id, acao, created_at')
            .eq('user_id', userId)
            .eq('tipo', 'renovacao')
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          logsRenovacao = logsRenovacao.concat(data as any[]);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      } catch { /* logs table might not exist */ }

      // Count renewals from faturas
      // Regra: 1ª fatura só é "ativação" se estiver colada na criação do cliente.
      // Se cliente já existia e a 1ª fatura registrada veio agora, conta como renovação.
      const renovacoesPorDia = new Map<string, number>();
      const primeiraFaturaProcessada = new Set<string>();
      const faturasPorClienteDia = new Set<string>();
      const faturasPorUsuarioDia = new Set<string>();
      const faturasPorWhatsappDia = new Set<string>();
      const renovacoesClienteDiaContadas = new Set<string>();
      const clientesMap = new Map(clientes.filter(c => !!c.id).map(c => [c.id as string, c]));

      const normalizarTexto = (text?: string | null) => (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      const normalizarDigitos = (text?: string | null) => (text || '').replace(/\D/g, '');

      const isPrimeiraFaturaDeAtivacao = (fatura: { cliente_id: string | null; paid_at: string | null }) => {
        if (!fatura.cliente_id || !fatura.paid_at) return false;

        const cliente = clientesMap.get(fatura.cliente_id);
        if (!cliente?.created_at) return false;

        const dataCriacao = new Date(cliente.created_at);
        const dataPagamento = new Date(fatura.paid_at);

        if (Number.isNaN(dataCriacao.getTime()) || Number.isNaN(dataPagamento.getTime())) return false;

        const diffMs = Math.abs(dataPagamento.getTime() - dataCriacao.getTime());
        const horasDesdeCriacao = diffMs / (1000 * 60 * 60);

        // Até 36h da criação: tratar como ativação inicial
        return horasDesdeCriacao <= 36;
      };

      faturasPagas.forEach(f => {
        if (!f.paid_at || !f.cliente_id) return;

        const dayKey = makeDayKey(new Date(f.paid_at));
        const chave = `${f.cliente_id}|${dayKey}`;
        const primeiraDoCliente = !primeiraFaturaProcessada.has(f.cliente_id);

        // Sempre registra para deduplicar logs no mesmo cliente/dia (por ID, usuario e whatsapp)
        faturasPorClienteDia.add(chave);
        const cliente = clientesMap.get(f.cliente_id);
        if (cliente) {
          const usuario = normalizarTexto(cliente.usuario);
          if (usuario) faturasPorUsuarioDia.add(`${usuario}|${dayKey}`);
          const whatsapp = normalizarDigitos(cliente.whatsapp);
          if (whatsapp) faturasPorWhatsappDia.add(`${whatsapp}|${dayKey}`);
        }

        if (primeiraDoCliente) {
          primeiraFaturaProcessada.add(f.cliente_id);
          if (isPrimeiraFaturaDeAtivacao(f)) {
            return; // ativação, não renovação
          }
        }

        if (renovacoesClienteDiaContadas.has(chave)) return;
        renovacoesClienteDiaContadas.add(chave);
        renovacoesPorDia.set(dayKey, (renovacoesPorDia.get(dayKey) || 0) + 1);
      });

      // Count renewals from logs (deduplicate against faturas)

      const clientesByWhatsapp = new Map<string, Cliente[]>();
      const clientesByUsuario = new Map<string, Cliente[]>();
      const clientesByNome = new Map<string, Cliente[]>();
      clientes.forEach(c => {
        const w = normalizarDigitos(c.whatsapp);
        if (w) { clientesByWhatsapp.set(w, [...(clientesByWhatsapp.get(w) || []), c]); }
        const u = normalizarTexto(c.usuario);
        if (u) { clientesByUsuario.set(u, [...(clientesByUsuario.get(u) || []), c]); }
        const n = normalizarTexto(c.nome);
        if (n) { clientesByNome.set(n, [...(clientesByNome.get(n) || []), c]); }
      });

      const pickBestCliente = (list?: Cliente[]) => {
        if (!list || list.length === 0) return null;
        if (list.length === 1) return list[0];

        // Evita perder renovação quando houver duplicidade de cadastro.
        // Preferir cliente ativo e mais recentemente criado.
        const sorted = [...list].sort((a, b) => {
          const ativoA = (a as any).ativo === false ? 0 : 1;
          const ativoB = (b as any).ativo === false ? 0 : 1;
          if (ativoA !== ativoB) return ativoB - ativoA;

          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return createdB - createdA;
        });

        return sorted[0] ?? null;
      };

      const logsContados = new Set<string>();
      const logsFallbackContados = new Set<string>();
      logsRenovacao.forEach(log => {
        if (!log.created_at) return;
        const l = normalizarTexto(log.acao);
        if (!l.includes('renovacao') || l.includes('falhou') || l.includes('erro') || l.includes('❌')) return;

        const dayKey = makeDayKey(new Date(log.created_at));

        // Try to identify client: phone → usuario → nome
        let cliente: Cliente | null = null;
        const phoneMatch = log.acao.match(/\((\+?[\d\s\-().]{8,})\)/);
        if (phoneMatch) cliente = pickBestCliente(clientesByWhatsapp.get(normalizarDigitos(phoneMatch[1])));

        if (!cliente) {
          const userMatch = log.acao.match(/cliente\s+([a-zA-Z0-9._-]+)/i) || log.acao.match(/\(([^)]+)\)/);
          if (userMatch) {
            const usuario = normalizarTexto(userMatch[1]);
            cliente = pickBestCliente(clientesByUsuario.get(usuario));
          }
        }

        if (!cliente) {
          const nomeMatch = log.acao.match(/:\s*([^()→]+?)(?:\(|→|$)/);
          if (nomeMatch) cliente = pickBestCliente(clientesByNome.get(normalizarTexto(nomeMatch[1])));
        }

        // Fallback: renovação manual sem identificação única do cliente
        // (evita subcontagem; não aplica para "automática via" para reduzir risco de duplicação com fatura)
        if (!cliente?.id) {
          const isAutomatica = l.includes('automatica via');
          const fallbackKey = `${log.id}|${dayKey}`;
          if (!isAutomatica && !logsFallbackContados.has(fallbackKey)) {
            logsFallbackContados.add(fallbackKey);
            renovacoesPorDia.set(dayKey, (renovacoesPorDia.get(dayKey) || 0) + 1);
          }
          return;
        }

        const chave = `${cliente.id}|${dayKey}`;
        const usuarioKey = normalizarTexto(cliente.usuario);
        const whatsappKey = normalizarDigitos(cliente.whatsapp);
        const jaCobertoPorFatura = 
          faturasPorClienteDia.has(chave) ||
          (usuarioKey && faturasPorUsuarioDia.has(`${usuarioKey}|${dayKey}`)) ||
          (whatsappKey && faturasPorWhatsappDia.has(`${whatsappKey}|${dayKey}`));
        if (jaCobertoPorFatura || logsContados.has(chave)) return;
        logsContados.add(chave);
        renovacoesPorDia.set(dayKey, (renovacoesPorDia.get(dayKey) || 0) + 1);
      });

      // Build chart data (last 7 days)
      const renovacoesData = [];
      let totalRenovacoes = 0;
      let renovacoesHoje = 0;

      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        data.setHours(0, 0, 0, 0);
        const dayKey = makeDayKey(data);
        const total = renovacoesPorDia.get(dayKey) || 0;

        renovacoesData.push({ day: dayKey, total });
        totalRenovacoes += total;
        if (i === 0) renovacoesHoje = total;
      }

      const diasNoMes = new Date().getDate();
      const mediaPorDia = totalRenovacoes / diasNoMes;

      setMetricas({
        totalRenovacoes,
        renovacoesHoje,
        mediaPorDia,
        renovacoesData,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Erro ao carregar métricas de renovações:', error);
      setMetricas(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar métricas de renovações',
      }));
    }
  };

  return metricas;
}
