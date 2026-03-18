import { useEffect } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import {
  useMetricasClientes,
  useMetricasPagamentos,
  useMetricasRenovacoes,
} from "@/hooks/useMetricas";
import { useMetricasExtras } from "@/hooks/useMetricasExtras";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProfile } from "@/hooks/useProfile";
import DashboardClientCards from "@/components/dashboard/DashboardClientCards";
import DashboardFinanceCards from "@/components/dashboard/DashboardFinanceCards";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DashboardNewCards from "@/components/dashboard/DashboardNewCards";
import DashboardClientTables from "@/components/dashboard/DashboardClientTables";

export default function Index() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);
  const { entradas, saidas, lucros, lucrosMes, lucrosAno, transacoes, loading: loadingFinanceiro } = useFinanceiro();
  const {
    totalClientes,
    clientesAtivos,
    clientesVencidos,
    clientesNovosHoje,
    clientesNovosData,
    loading: loadingClientes,
  } = useMetricasClientes();
  const {
    totalPagamentos,
    valorTotalMes,
    mediaPorDia,
    pagamentosData,
    loading: loadingPagamentos,
  } = useMetricasPagamentos();
  const {
    renovacoesData,
    loading: loadingRenovacoes,
  } = useMetricasRenovacoes();

  const metricasExtras = useMetricasExtras();

  useEffect(() => {
    document.title = "Dashboard | Gestor Msx";
  }, []);

  const isLoading =
    loadingFinanceiro || loadingClientes || loadingPagamentos || loadingRenovacoes || metricasExtras.loading;

  if (isLoading) {
    return <PageLoader message="Carregando dashboard..." />;
  }

  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom Dia" : hora < 18 ? "Boa Tarde" : "Boa Noite";

  const primeiroNome = profile?.nome_completo?.split(" ")[0] || profile?.nome_empresa?.split(" ")[0] || "";

  return (
    <div className="space-y-6">
      
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {saudacao}, {primeiroNome || "Gestor Msx"}!
      </h1>

      {/* 1ª linha — Cards de clientes (3 cards) */}
      <DashboardClientCards
        clientesAtivos={clientesAtivos}
        clientesVencidos={clientesVencidos}
        clientesDesativados={0}
      />

      {/* Nova linha — Cards extras */}
      <DashboardNewCards
        novosClientesHoje={metricasExtras.novosClientesHoje}
        novosClientesSemana={metricasExtras.novosClientesSemana}
        novosClientesMes={metricasExtras.novosClientesMes}
        clientesVencendoHoje={metricasExtras.clientesVencendoHoje}
        clientesVencendo3Dias={metricasExtras.clientesVencendo3Dias}
        clientesSemRenovar={metricasExtras.clientesSemRenovar}
        clientesRecuperadosMes={metricasExtras.clientesRecuperadosMes}
        totalClientesRecuperados={metricasExtras.totalClientesRecuperados}
        valoresHoje={metricasExtras.valoresHoje}
        valoresAmanha={metricasExtras.valoresAmanha}
        projecaoMensal={metricasExtras.projecaoMensal}
      />

      {/* 2ª linha — Financeiro (2 cards) */}
      <DashboardFinanceCards
        entradas={entradas}
        saidas={saidas}
        lucros={lucrosMes}
        valorTotalMes={valorTotalMes}
        valorTotalAno={lucrosAno}
      />

      {/* 3ª linha — Gráficos */}
      <DashboardCharts
        pagamentosData={pagamentosData}
        clientesNovosData={clientesNovosData}
        renovacoesData={renovacoesData}
        entradas={entradas}
        saidas={saidas}
        transacoes={transacoes}
      />

      {/* 4ª linha — Tabelas de clientes */}
      <DashboardClientTables />
    </div>
  );
}
