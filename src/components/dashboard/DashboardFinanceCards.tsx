import { DollarSign, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Props {
  entradas: number;
  saidas: number;
  lucros: number;
  valorTotalMes: number;
  valorTotalAno?: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function DashboardFinanceCards({ 
  entradas, 
  saidas, 
  lucros, 
  valorTotalMes,
  valorTotalAno = 0
}: Props) {
  const [showValueMes, setShowValueMes] = useState(false);
  const [showValueAno, setShowValueAno] = useState(false);
  
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  const currentYear = new Date().getFullYear();
  
  const saldoMes = lucros;
  const saldoAno = valorTotalAno;

  return (
    <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-primary/20 p-3">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">Saldo Líquido do Mês</p>
              <Badge className="bg-success text-success-foreground text-xs px-2 py-0.5">
                {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">
                {showValueMes ? fmt(saldoMes) : "R$ •••••"}
              </p>
              <button
                onClick={() => setShowValueMes(!showValueMes)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showValueMes ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-primary/20 p-3">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">Saldo Líquido do Ano</p>
              <Badge className="bg-success text-success-foreground text-xs px-2 py-0.5">
                {currentYear}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">
                {showValueAno ? fmt(saldoAno) : "R$ •••••"}
              </p>
              <button
                onClick={() => setShowValueAno(!showValueAno)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showValueAno ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
