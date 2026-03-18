import { Users, TrendingUp } from "lucide-react";

interface Props {
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
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function DashboardNewCards({
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
}: Props) {
  return (
    <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {/* Card 1 - Novos Clientes */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-[hsl(142,70%,45%)]/20 p-2">
            <Users className="h-5 w-5 text-[hsl(142,70%,45%)]" />
          </div>
          <span className="text-sm font-medium text-foreground">Novos Clientes</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Hoje</span>
            <span className="text-sm font-semibold text-foreground">{novosClientesHoje}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Esta Semana</span>
            <span className="text-sm font-semibold text-foreground">{novosClientesSemana}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Este Mês</span>
            <span className="text-sm font-semibold text-foreground">{novosClientesMes}</span>
          </div>
        </div>
      </div>

      {/* Card 2 - Clientes Vencendo */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-[hsl(142,70%,45%)]/20 p-2">
            <Users className="h-5 w-5 text-[hsl(142,70%,45%)]" />
          </div>
          <span className="text-sm font-medium text-foreground">Clientes Vencendo</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vencendo Hoje</span>
            <span className="text-sm font-semibold text-foreground">{clientesVencendoHoje}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vencendo em 3 Dias</span>
            <span className="text-sm font-semibold text-foreground">{clientesVencendo3Dias}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sem Renovar este Mês</span>
            <span className="text-sm font-semibold text-foreground">{clientesSemRenovar}</span>
          </div>
        </div>
      </div>

      {/* Card 3 - Valores a Receber */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-[hsl(142,70%,45%)]/20 p-2">
            <TrendingUp className="h-5 w-5 text-[hsl(142,70%,45%)]" />
          </div>
          <span className="text-sm font-medium text-foreground">Valores a Receber</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Projeção Mensal</span>
            <span className="text-sm font-semibold text-foreground">{fmt(projecaoMensal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Hoje</span>
            <span className="text-sm font-semibold text-foreground">{fmt(valoresHoje)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Amanhã</span>
            <span className="text-sm font-semibold text-foreground">{fmt(valoresAmanha)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
