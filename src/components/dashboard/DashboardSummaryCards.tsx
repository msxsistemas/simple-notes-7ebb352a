import { Card, CardContent } from "@/components/ui/card";
import { Banknote, Calendar, UserCheck, Star } from "lucide-react";

interface Props {
  mediaPorDia: number;
  valorTotalMes: number;
  totalClientes: number;
  pagamentosData: Array<{ day: string; valor: number }>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function DashboardSummaryCards({
  mediaPorDia,
  valorTotalMes,
  totalClientes,
  pagamentosData,
}: Props) {
  const recebidoHoje = pagamentosData.length > 0 ? pagamentosData[pagamentosData.length - 1].valor : 0;
  const melhorDia = Math.max(...pagamentosData.map((d) => d.valor), 0);
  const mediaPorCliente = totalClientes > 0 ? valorTotalMes / totalClientes : 0;

  const items = [
    { label: "Recebido Hoje", value: fmt(recebidoHoje), icon: Banknote, color: "text-dashboard-success" },
    { label: "Recebido no Mês", value: fmt(valorTotalMes), icon: Calendar, color: "text-dashboard-secondary" },
    { label: "Média por Cliente", value: fmt(mediaPorCliente), icon: UserCheck, color: "text-dashboard-warning" },
    { label: "Melhor Dia", value: fmt(melhorDia), icon: Star, color: "text-dashboard-danger" },
  ];

  return (
    <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
