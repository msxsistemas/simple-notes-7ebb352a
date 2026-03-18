import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface TransacaoFinanceira {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  detalheTitulo: string;
  [key: string]: any;
}

interface Props {
  pagamentosData: Array<{ day: string; valor: number; custos: number }>;
  clientesNovosData: Array<{ day: string; total: number }>;
  renovacoesData: Array<{ day: string; total: number }>;
  entradas: number;
  saidas: number;
  transacoes: TransacaoFinanceira[];
}

export default function DashboardCharts({
  pagamentosData,
  clientesNovosData,
  renovacoesData,
}: Props) {
  // Client movement data
  const clientData = clientesNovosData.map((d, i) => ({
    day: d.day,
    "Clientes Ativados": d.total,
    "Clientes Renovados": renovacoesData[i]?.total ?? 0,
  }));

  // Finance data - use custos from pagamentosData directly
  const financeData = pagamentosData.map((d) => ({
    day: d.day,
    Vendas: d.valor,
    "Custos Servidor": d.custos || 0,
  }));

  const tooltipStyle = {
    backgroundColor: "hsl(220, 18%, 18%)",
    border: "1px solid hsl(220, 15%, 25%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(210, 40%, 98%)",
  };

  return (
    <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {/* Movimentação de Clientes - Blue/Cyan theme */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Movimentação de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={clientData}>
                <defs>
                  <linearGradient id="gAtivados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gRenovados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)" opacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(215, 20%, 65%)" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 65%)" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend 
                  wrapperStyle={{ fontSize: "11px", color: "hsl(215, 20%, 65%)" }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="Clientes Ativados"
                  stroke="hsl(142, 70%, 45%)"
                  fill="url(#gAtivados)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Clientes Renovados"
                  stroke="hsl(199, 89%, 48%)"
                  fill="url(#gRenovados)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Financeiro - Green/Pink theme */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Movimentação Financeira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeData}>
                <defs>
                  <linearGradient id="gVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)" opacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(215, 20%, 65%)" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 65%)" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name]}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px", color: "hsl(215, 20%, 65%)" }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="Vendas"
                  stroke="hsl(142, 70%, 45%)"
                  fill="url(#gVendas)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Custos Servidor"
                  stroke="hsl(300, 70%, 50%)"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
