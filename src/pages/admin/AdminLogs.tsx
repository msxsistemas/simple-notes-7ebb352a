import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { ScrollText, Activity } from "lucide-react";

interface LogItem {
  id: string;
  user_id: string;
  owner_email: string;
  acao?: string;
  evento?: string;
  tipo?: string;
  nivel?: string;
  componente?: string;
  created_at: string;
}

export default function AdminLogs() {
  const [painelLogs, setPainelLogs] = useState<LogItem[]>([]);
  const [sistemaLogs, setSistemaLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Logs | Admin Gestor Msx";
    const fetch_ = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const [r1, r2] = await Promise.all([
          fetch(`https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ action: "list_logs", tipo: "painel" }),
          }),
          fetch(`https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ action: "list_logs", tipo: "sistema" }),
          }),
        ]);
        const d1 = await r1.json();
        const d2 = await r2.json();
        if (d1.success) setPainelLogs(d1.logs);
        if (d2.success) setSistemaLogs(d2.logs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  const nivelColor = (n: string) => {
    if (n === "error") return "destructive" as const;
    if (n === "warning" || n === "warn") return "secondary" as const;
    return "default" as const;
  };

  return (
    <div>
      <header className="rounded-lg border mb-3 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Logs do Sistema</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Visualize logs de atividade de todos os usuários da plataforma.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-foreground/70" />
            <CardTitle className="text-sm">Registros de Atividade</CardTitle>
          </div>
          <CardDescription>Logs de painel e sistema de todos os usuários.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Tabs defaultValue="painel">
              <TabsList>
                <TabsTrigger value="painel">Painel ({painelLogs.length})</TabsTrigger>
                <TabsTrigger value="sistema">Sistema ({sistemaLogs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="painel">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {painelLogs.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{l.owner_email}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{l.acao}</TableCell>
                          <TableCell><Badge variant="secondary">{l.tipo}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="sistema">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Componente</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sistemaLogs.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{l.owner_email}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{l.evento}</TableCell>
                          <TableCell className="text-xs">{l.componente}</TableCell>
                          <TableCell><Badge variant={nivelColor(l.nivel || "info")}>{l.nivel}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
