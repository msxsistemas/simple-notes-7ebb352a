import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

interface MetricasExtras {
  novosClientesHoje: number;
  novosClientesSemana: number;
  novosClientesMes: number;
  clientesVencendoHoje: number;
  clientesVencendo3Dias: number;
  clientesSemRenovar: number;
  clientesRecuperadosMes: number;
  totalClientesRecuperados: number;
  valoresHoje: number;
  valoresAmanha: number;
  projecaoMensal: number;
  loading: boolean;
}

export function useMetricasExtras(): MetricasExtras {
  const { userId } = useCurrentUser();
  const [metricas, setMetricas] = useState<MetricasExtras>({
    novosClientesHoje: 0,
    novosClientesSemana: 0,
    novosClientesMes: 0,
    clientesVencendoHoje: 0,
    clientesVencendo3Dias: 0,
    clientesSemRenovar: 0,
    clientesRecuperadosMes: 0,
    totalClientesRecuperados: 0,
    valoresHoje: 0,
    valoresAmanha: 0,
    projecaoMensal: 0,
    loading: true,
  });

  useEffect(() => {
    if (userId) {
      carregarMetricas();
    }
  }, [userId]);

  const carregarMetricas = async () => {
    try {
      if (!userId) return;

      const [clientesRes, planosRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('user_id', userId),
        supabase.from('planos').select('*').eq('user_id', userId)
      ]);

      if (clientesRes.error) throw clientesRes.error;
      if (planosRes.error) throw planosRes.error;

      const clientes = clientesRes.data || [];
      const planos = planosRes.data || [];
      const planosMap = new Map(planos.map(p => [p.id, p]));

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const tresDias = new Date(hoje);
      tresDias.setDate(tresDias.getDate() + 3);

      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      // Novos clientes
      let novosClientesHoje = 0;
      let novosClientesSemana = 0;
      let novosClientesMes = 0;

      // Clientes vencendo
      let clientesVencendoHoje = 0;
      let clientesVencendo3Dias = 0;
      let clientesSemRenovar = 0;
      let clientesRecuperadosMes = 0;
      let totalClientesRecuperados = 0;

      // Valores a receber
      let valoresHoje = 0;
      let valoresAmanha = 0;
      let projecaoMensal = 0;

      clientes.forEach(cliente => {
        const dataCriacao = new Date(cliente.created_at || '');
        dataCriacao.setHours(0, 0, 0, 0);

        // Novos clientes hoje
        if (dataCriacao.getTime() === hoje.getTime()) {
          novosClientesHoje++;
        }

        // Novos clientes esta semana
        if (dataCriacao >= inicioSemana) {
          novosClientesSemana++;
        }

        // Novos clientes este mês
        if (dataCriacao >= inicioMes) {
          novosClientesMes++;
        }

        // Verificar vencimento
        if (cliente.data_vencimento) {
          const dataVenc = new Date(cliente.data_vencimento);
          dataVenc.setHours(0, 0, 0, 0);

          // Vencendo hoje
          if (dataVenc.getTime() === hoje.getTime()) {
            clientesVencendoHoje++;
          }

          // Vencendo em 3 dias
          if (dataVenc > hoje && dataVenc <= tresDias) {
            clientesVencendo3Dias++;
          }

          // Sem renovar este mês (venceu no mês atual e ainda está vencido)
          if (dataVenc >= inicioMes && dataVenc < hoje) {
            clientesSemRenovar++;
          }

          // Recuperados: cliente criado antes deste mês, que estava vencido mas renovou
          // (data_vencimento >= hoje e criado antes do mês atual)
          if (dataCriacao < inicioMes && dataVenc >= hoje) {
            totalClientesRecuperados++;
            // Recuperados este mês: vencimento cai no mês atual (renovação recente)
            const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            if (dataVenc >= inicioMes && dataVenc <= fimMes) {
              clientesRecuperadosMes++;
            }
          }

          // Calcular valores a receber baseado no plano
          if (cliente.plano && planosMap.has(cliente.plano)) {
            const plano = planosMap.get(cliente.plano)!;
            const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
            const valor = parseFloat(valorStr);

            if (!isNaN(valor)) {
              // Valor hoje (clientes vencendo hoje)
              if (dataVenc.getTime() === hoje.getTime()) {
                valoresHoje += valor;
              }

              // Valor amanhã
              if (dataVenc.getTime() === amanha.getTime()) {
                valoresAmanha += valor;
              }

              // Projeção mensal (clientes que vencem neste mês)
              const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
              if (dataVenc >= hoje && dataVenc <= fimMes) {
                projecaoMensal += valor;
              }
            }
          }
        }
      });

      setMetricas({
        novosClientesHoje,
        novosClientesSemana,
        novosClientesMes,
        clientesVencendoHoje,
        clientesVencendo3Dias,
        clientesSemRenovar,
        clientesRecuperadosMes,
        totalClientesRecuperados,
        valoresHoje,
        valoresAmanha,
        projecaoMensal,
        loading: false,
      });

    } catch (error) {
      console.error('Erro ao carregar métricas extras:', error);
      setMetricas(prev => ({ ...prev, loading: false }));
    }
  };

  return metricas;
}
