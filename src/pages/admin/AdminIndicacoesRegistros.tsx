import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2, Search, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface IndicacaoRow {
  id: string;
  user_id: string;
  cliente_indicado_id: string | null;
  codigo_indicacao: string;
  bonus: number;
  status: string;
  created_at: string;
  user_email?: string;
  cliente_nome?: string;
}

const PAGE_SIZE = 10;

export default function AdminIndicacoesRegistros() {
  const [indicacoes, setIndicacoes] = useState<IndicacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [tipoBonus, setTipoBonus] = useState("fixo");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Indicações | Admin";
    fetchConfig();
    fetchIndicacoes();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from("system_indicacoes_config").select("tipo_bonus").eq("id", 1).single();
    if (data?.tipo_bonus) setTipoBonus(data.tipo_bonus);
  };

  const fetchIndicacoes = async () => {
    setLoading(true);
    try {
      const { data: inds, error } = await supabase.from("indicacoes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!inds?.length) { setIndicacoes([]); setLoading(false); return; }

      const userIds = [...new Set(inds.map(i => i.user_id))];
      const clienteIds = [...new Set(inds.map(i => i.cliente_indicado_id).filter(Boolean))] as string[];

      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome_completo").in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p.nome_completo || "Sem nome"));
      }

      const clienteMap = new Map<string, string>();
      if (clienteIds.length) {
        const { data: clientes } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
        clientes?.forEach(c => clienteMap.set(c.id, c.nome));
      }

      setIndicacoes(inds.map(i => ({
        ...i,
        user_email: profileMap.get(i.user_id) || i.user_id.substring(0, 8) + "...",
        cliente_nome: i.cliente_indicado_id ? (clienteMap.get(i.cliente_indicado_id) || "-") : "-",
      })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("indicacoes").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar status", variant: "destructive" }); }
    else { toast({ title: "Status atualizado!" }); fetchIndicacoes(); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado": return <Badge className="bg-green-500/10 text-green-500">Aprovado</Badge>;
      case "pago": return <Badge className="bg-primary/10 text-primary">Pago</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const formatBonus = (bonus: number) => {
    return tipoBonus === "percentual"
      ? `${bonus.toFixed(2).replace(".", ",")}%`
      : `R$ ${bonus.toFixed(2).replace(".", ",")}`;
  };

  // Filter
  const filtered = indicacoes.filter(i => {
    const matchesSearch = (i.user_email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.cliente_nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.codigo_indicacao.toLowerCase().includes(searchTerm.toLowerCase());
    
    const createdDate = new Date(i.created_at);
    const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
    const matchesDateTo = dateTo ? createdDate <= new Date(dateTo.getTime() + 86400000) : true;
    
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchTerm, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Todas as Indicações</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Indicações de todos os usuários do sistema.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-sm">Registros</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-48" />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Limpar</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center"><Share2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" /><p className="text-sm text-muted-foreground">Nenhuma indicação encontrada.</p></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cliente Indicado</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Bônus</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(ind => (
                    <TableRow key={ind.id}>
                      <TableCell className="font-medium">{ind.user_email}</TableCell>
                      <TableCell>{ind.cliente_nome}</TableCell>
                      <TableCell className="font-mono text-xs">{ind.codigo_indicacao}</TableCell>
                      <TableCell>{formatBonus(Number(ind.bonus))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {tipoBonus === "percentual" ? "%" : "R$"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(ind.status)}</TableCell>
                      <TableCell>{new Date(ind.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Select value={ind.status} onValueChange={v => handleUpdateStatus(ind.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">{filtered.length} registro(s) — Página {page} de {totalPages}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
