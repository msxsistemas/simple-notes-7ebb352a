import { Users, AlertTriangle, UserX } from "lucide-react";

interface Props {
  clientesAtivos: number;
  clientesVencidos: number;
  clientesDesativados?: number;
}

export default function DashboardClientCards({
  clientesAtivos,
  clientesVencidos,
  clientesDesativados = 0,
}: Props) {
  const cards = [
    {
      label: "Clientes Ativos",
      value: clientesAtivos,
      icon: Users,
      bgColor: "bg-success",
      iconBgColor: "bg-success/80",
    },
    {
      label: "Clientes Vencidos",
      value: clientesVencidos,
      icon: AlertTriangle,
      bgColor: "bg-destructive",
      iconBgColor: "bg-destructive/80",
    },
    {
      label: "Clientes Desativados",
      value: clientesDesativados,
      icon: UserX,
      bgColor: "bg-dashboard-purple",
      iconBgColor: "bg-dashboard-purple/80",
    },
  ];

  return (
    <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl ${card.bgColor} p-5 text-white transition-transform duration-200 hover:scale-[1.02] shadow-lg`}
        >
          <div className="flex items-center gap-4">
            <card.icon className="h-6 w-6 text-white/80" />
            <div>
              <p className="text-base font-medium text-white">{card.label}</p>
              <p className="text-2xl font-bold ml-1">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
