import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogPainel {
  id: string;
  acao: string;
  tipo: string;
  created_at: string;
}

const getBadgeVariant = (tipo: string) => {
  switch (tipo) {
    case "success": return "default" as const;
    case "error": return "destructive" as const;
    case "warning": return "secondary" as const;
    default: return "outline" as const;
  }
};

const getBadgeLabel = (tipo: string) => {
  switch (tipo) {
    case "success": return "Sucesso";
    case "error": return "Erro";
    case "warning": return "Aviso";
    default: return "Info";
  }
};

export default function Logs() {
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["logs-painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs_painel")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as LogPainel[];
    },
  });

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Logs</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Carregando logs...</p>
            </div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="overflow-x-auto mobile-scroll-x">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>{log.acao}</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(log.tipo)}>
                          {getBadgeLabel(log.tipo)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
              <p className="text-sm text-muted-foreground/70">
                As atividades do painel aparecerão aqui
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
