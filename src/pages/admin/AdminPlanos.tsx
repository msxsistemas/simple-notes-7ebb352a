import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus, Pencil, Trash2, Star, Package, Search, ChevronLeft, ChevronRight, PackageX } from "lucide-react";

interface SystemPlan {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  intervalo: string;
  recursos: string[];
  ativo: boolean;
  destaque: boolean;
  ordem: number;
}

const PER_PAGE = 10;

export default function AdminPlanos() {
  const [plans, setPlans] = useState<SystemPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPlans = async () => {
    const { data } = await supabase.from("system_plans").select("*").order("ordem");
    if (data) setPlans(data as SystemPlan[]);
    setLoading(false);
  };

  const fetchSubscriberCounts = async () => {
    const { data } = await supabase.from("user_subscriptions").select("plan_id, status");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((sub) => {
        if (sub.plan_id && sub.status === "active") {
          counts[sub.plan_id] = (counts[sub.plan_id] || 0) + 1;
        }
      });
      setSubscriberCounts(counts);
    }
  };

  useEffect(() => {
    document.title = "Planos SaaS | Admin Gestor Msx";
    fetchPlans();
    fetchSubscriberCounts();
  }, []);

  useEffect(() => { setPage(1); }, [search, filter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    await supabase.from("system_plans").delete().eq("id", id);
    toast({ title: "Plano excluído" });
    fetchPlans();
  };

  const formatCurrency = (val: number) =>
    `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const filtered = useMemo(() => {
    let list = plans;
    if (filter === "ativos") list = list.filter(p => p.ativo);
    if (filter === "inativos") list = list.filter(p => !p.ativo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(q) || p.descricao?.toLowerCase().includes(q));
    }
    return list;
  }, [plans, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const totalAtivos = plans.filter(p => p.ativo).length;
  const totalInativos = plans.filter(p => !p.ativo).length;
  const totalAssinantes = Object.values(subscriberCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-foreground/70" />
                <h1 className="text-base font-semibold tracking-tight text-foreground">Planos SaaS</h1>
              </div>
              <p className="text-xs/6 text-muted-foreground">Gerencie os planos de assinatura disponíveis no sistema.</p>
            </div>
            <Button onClick={() => navigate("/role/admin/planos/novo")} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total de Planos</p>
            <p className="text-xl font-bold">{plans.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-xl font-bold text-emerald-500">{totalAtivos}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Inativos</p>
            <p className="text-xl font-bold text-destructive">{totalInativos}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Assinantes Ativos</p>
            <p className="text-xl font-bold text-primary">{totalAssinantes}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Planos ({filtered.length})</CardTitle>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
                <TabsTrigger value="ativos" className="text-xs px-3 h-7">Ativos</TabsTrigger>
                <TabsTrigger value="inativos" className="text-xs px-3 h-7">Inativos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>Planos exibidos na página pública de preços.</CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <PackageX className="h-10 w-10 opacity-40" />
              <p className="text-sm">Nenhum plano encontrado.</p>
              {(search || filter !== "todos") && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setFilter("todos"); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6">
                <div className="min-w-[700px] px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Intervalo</TableHead>
                        <TableHead>Recursos</TableHead>
                        <TableHead>Assinantes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {p.nome}
                              {p.destaque && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            </div>
                            {p.descricao && <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{p.descricao}</p>}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(p.valor)}</TableCell>
                          <TableCell className="capitalize">{p.intervalo}</TableCell>
                          <TableCell>
                            {p.recursos && p.recursos.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {p.recursos.slice(0, 3).map((r: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-[0.625rem] px-1.5 py-0">{r}</Badge>
                                ))}
                                {p.recursos.length > 3 && (
                                  <Badge variant="secondary" className="text-[0.625rem] px-1.5 py-0">+{p.recursos.length - 3}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm">{subscriberCounts[p.id] || 0}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate(`/role/admin/planos/editar/${p.id}`)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {((currentPage - 1) * PER_PAGE) + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} de {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p)}>
                        {p}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
