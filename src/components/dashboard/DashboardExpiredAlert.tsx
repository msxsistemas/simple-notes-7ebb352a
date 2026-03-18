import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  clientesVencidos: number;
}

export default function DashboardExpiredAlert({ clientesVencidos }: Props) {
  if (clientesVencidos === 0) return null;

  return (
    <section>
      <div className="rounded-xl bg-[hsl(0,50%,20%)] border border-[hsl(0,50%,30%)] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[hsl(0,72%,60%)]" />
            <div>
              <h3 className="font-semibold text-[hsl(0,72%,70%)]">
                Meus Clientes Com Plano Vencido
              </h3>
              <p className="text-sm text-[hsl(0,30%,60%)]">
                Informe aos seus clientes sobre o vencimento
              </p>
            </div>
          </div>
          <Link
            to="/clientes"
            className="flex items-center gap-1 text-sm text-[hsl(199,89%,48%)] hover:text-[hsl(199,89%,60%)] transition-colors"
          >
            Ver clientes
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
