import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Server, ChevronRight, Wrench, Loader2 } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

const PROVIDER_ROUTES: Record<string, string> = {
  'koffice-api': '/servidores/koffice-api',
  'koffice-v2': '/servidores/koffice-v2',
  'mundogf': '/servidores/mundogf',
  'uniplay': '/servidores/uniplay',
  'playfast': '/servidores/playfast',
  'unitv': '/servidores/unitv',
  'sigma': '/servidores/sigma',
};

interface ServidorDB {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
}

export default function ServidoresIndex() {
  const [servidores, setServidores] = useState<ServidorDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Servidores | Tech Play";
    const fetch_ = async () => {
      const { data } = await supabase
        .from("system_servidores")
        .select("*")
        .in("status", ["ativo", "manutencao"])
        .order("nome");
      if (data) setServidores(data as ServidorDB[]);
      setLoading(false);
    };
    fetch_();
  }, []);

  if (loading) {
    return <PageLoader message="Carregando servidores..." />;
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Servidores IPTV</h1>
            <p className="text-sm text-muted-foreground">Selecione um provedor para gerenciar seus painéis</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servidores.map((srv) => {
          const route = PROVIDER_ROUTES[srv.id];

          if (srv.status === "manutencao") {
            return (
              <div key={srv.id} className="rounded-lg p-5 bg-card border border-border opacity-70">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
                <h3 className="font-semibold text-foreground">{srv.nome}</h3>
                <Badge variant="outline" className="mt-3 text-orange-400 border-orange-400/50 bg-orange-400/10">
                  Em manutenção
                </Badge>
              </div>
            );
          }

          if (route) {
            return (
              <NavLink
                key={srv.id}
                to={route}
                className="rounded-lg p-5 bg-card border border-border hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                    <Server className="w-5 h-5 text-green-500" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground">{srv.nome}</h3>
                <Badge className="mt-3 bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/10">
                  Integrado
                </Badge>
              </NavLink>
            );
          }

          return null;
        })}
      </div>

      {servidores.length === 0 && (
        <div className="rounded-lg p-8 bg-card border border-border text-center">
          <p className="text-muted-foreground">Nenhum servidor disponível no momento.</p>
        </div>
      )}
    </main>
  );
}
