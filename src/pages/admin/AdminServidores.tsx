import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Wrench, Ban, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ServidorDB {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
}

export default function AdminServidores() {
  const [servidores, setServidores] = useState<ServidorDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Servidores | Admin";
    fetchServidores();
  }, []);

  const fetchServidores = async () => {
    const { data } = await supabase.from("system_servidores").select("*").order("nome");
    if (data) setServidores(data as ServidorDB[]);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("system_servidores")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      return;
    }

    setServidores(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    toast({ title: `Status atualizado para "${newStatus}"` });
  };

  const getStatusIcon = (status: string) => {
    if (status === "manutencao") return <Wrench className="w-5 h-5 text-orange-500" />;
    if (status === "inativo") return <Ban className="w-5 h-5 text-destructive" />;
    return <Server className="w-5 h-5 text-green-500" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === "manutencao") return <Badge variant="outline" className="text-orange-400 border-orange-400/50 bg-orange-400/10 text-[11px]">Manutenção</Badge>;
    if (status === "inativo") return <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10 text-[11px]">Inativo</Badge>;
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/10 text-[11px]">Ativo</Badge>;
  };

  const statusOrder: Record<string, number> = { ativo: 0, manutencao: 1, inativo: 2 };

  const filtrados = useMemo(() => {
    let list = [...servidores].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(s => s.nome.toLowerCase().includes(q));
    }
    if (filtro !== "todos") list = list.filter(s => s.status === filtro);
    return list;
  }, [servidores, busca, filtro]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-3">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Gerenciar Servidores</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Altere o status dos servidores visíveis para os usuários.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Servidores ({filtrados.length})</CardTitle>
            </div>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v)}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
                <TabsTrigger value="ativo" className="text-xs px-3 h-7">Ativos</TabsTrigger>
                <TabsTrigger value="manutencao" className="text-xs px-3 h-7">Manutenção</TabsTrigger>
                <TabsTrigger value="inativo" className="text-xs px-3 h-7">Inativos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>Controle quais servidores são exibidos para os usuários.</CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do servidor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map((srv) => (
              <div key={srv.id} className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      srv.status === "manutencao" ? "bg-orange-500/10" : srv.status === "inativo" ? "bg-destructive/10" : "bg-green-500/10"
                    }`}>
                      {getStatusIcon(srv.status)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{srv.nome}</h3>
                      <p className="text-xs text-muted-foreground">{srv.descricao}</p>
                    </div>
                  </div>
                  {getStatusBadge(srv.status)}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Alterar Status</label>
                  <Select value={srv.status} onValueChange={(v) => handleStatusChange(srv.id, v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
                Nenhum servidor encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
