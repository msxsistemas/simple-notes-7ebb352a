import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Pencil, Receipt, Search, ChevronLeft, ChevronRight, UserX } from "lucide-react";

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string;
  inicio: string;
  expira_em: string | null;
  plan_name?: string;
  user_email?: string;
  user_role?: string;
}

interface Plan { id: string; nome: string; intervalo?: string; }

const PER_PAGE = 10;

export default function AdminAssinaturas() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editExpiraEm, setEditExpiraEm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "todas";
  const { toast } = useToast();

  const setStatusFilter = (v: string) => {
    if (v === "todas") { searchParams.delete("status"); } else { searchParams.set("status", v); }
    setSearchParams(searchParams);
  };

  const fetch_ = async () => {
    const [subsRes, plansRes] = await Promise.all([
      supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("system_plans").select("id, nome, intervalo"),
    ]);

    const planMap: Record<string, string> = {};
    (plansRes.data || []).forEach(p => { planMap[p.id] = p.nome; });
    setPlans((plansRes.data || []) as Plan[]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "list_users" }),
      });
      const result = await resp.json();
      const emailMap: Record<string, string> = {};
      const roleMap: Record<string, string> = {};
      result.users?.forEach((u: any) => { emailMap[u.id] = u.email; roleMap[u.id] = u.role; });

      setSubs((subsRes.data || []).map(s => ({
        ...s,
        plan_name: planMap[s.plan_id] || "Sem plano",
        user_email: emailMap[s.user_id] || s.user_id,
        user_role: roleMap[s.user_id] || "user",
      })) as Subscription[]);
    } catch {
      setSubs((subsRes.data || []).map(s => ({ ...s, plan_name: planMap[s.plan_id] || "—" })) as Subscription[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Assinaturas | Admin Gestor Msx";
    fetch_();
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const openEdit = (s: Subscription) => { setEditSub(s); setEditStatus(s.status); setEditPlan(s.plan_id || ""); setEditExpiraEm(s.expira_em ? s.expira_em.slice(0, 10) : ""); };

  const handleUpdate = async () => {
    if (!editSub) return;

    let finalStatus = editStatus;
    let newExpiraEm: string | null = editSub.expira_em || null;
    let newInicio = editSub.inicio;
    let finalPlanId: string | null = editPlan || null;

    if (finalStatus === "trial") {
      // Ao definir como trial, limpar plano e calcular dias de teste
      finalPlanId = null;
      newInicio = new Date().toISOString();
      let trialDays = 7;
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('trial_dias')
          .limit(1)
          .maybeSingle();
        if (config?.trial_dias) trialDays = config.trial_dias;
      } catch {}
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + trialDays);
      newExpiraEm = expDate.toISOString();
    } else if (finalStatus === "ativa") {
      // Recalcular datas quando ativando ou mudando plano
      const needsDateRecalc = editSub.status !== "ativa" || (finalPlanId && finalPlanId !== editSub.plan_id);
      if (needsDateRecalc && finalPlanId) {
        newInicio = new Date().toISOString();
        const selectedPlan = plans.find(p => p.id === finalPlanId);
        const expDate = new Date();
        if (selectedPlan?.intervalo === "anual") {
          expDate.setFullYear(expDate.getFullYear() + 1);
        } else if (selectedPlan?.intervalo === "trimestral") {
          expDate.setMonth(expDate.getMonth() + 3);
        } else if (selectedPlan?.intervalo === "semestral") {
          expDate.setMonth(expDate.getMonth() + 6);
        } else {
          expDate.setMonth(expDate.getMonth() + 1);
        }
        newExpiraEm = expDate.toISOString();
      }
    } else if (finalStatus === "expirada") {
      newExpiraEm = new Date().toISOString();
    }

    await supabase.from("user_subscriptions").update({ 
      status: finalStatus, 
      plan_id: finalPlanId,
      expira_em: newExpiraEm,
      inicio: newInicio,
    }).eq("id", editSub.id);
    toast({ title: "Assinatura atualizada!" });
    setEditSub(null);
    fetch_();
  };

  const statusColor = (s: string) => {
    if (s === "ativa") return "default" as const;
    if (s === "trial") return "secondary" as const;
    return "destructive" as const;
  };

  const filtered = useMemo(() => {
    let list = subs;
    if (statusFilter !== "todas") list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => 
        s.user_email?.toLowerCase().includes(q) || 
        s.plan_name?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q) ||
        s.user_id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [subs, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <div className="space-y-3">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Assinaturas</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Gerencie as assinaturas e status dos usuários do sistema.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Assinaturas ({filtered.length})</CardTitle>
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="h-8">
                <TabsTrigger value="todas" className="text-xs px-3 h-7">Todas</TabsTrigger>
                <TabsTrigger value="ativa" className="text-xs px-3 h-7">Ativas</TabsTrigger>
                <TabsTrigger value="trial" className="text-xs px-3 h-7">Trial</TabsTrigger>
                <TabsTrigger value="expirada" className="text-xs px-3 h-7">Expiradas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>Altere planos e status das assinaturas.</CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail ou plano..."
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
              <UserX className="h-10 w-10 opacity-40" />
              <p className="text-sm">Nenhuma assinatura encontrada.</p>
              {(search || statusFilter !== "todas") && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setStatusFilter("todas"); }}>
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
                        <TableHead>Usuário</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">
                            {s.user_email}
                            {s.user_role === "admin" && <Badge variant="outline" className="ml-2 text-[10px]">Admin</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">{s.plan_name}</TableCell>
                          <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(s.inicio).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.expira_em ? new Date(s.expira_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
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

      <Dialog open={!!editSub} onOpenChange={() => setEditSub(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Assinatura</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border px-3 py-2">
              <p className="text-sm text-muted-foreground">Usuário: <span className="font-medium text-foreground">{editSub?.user_email}</span>
                {editSub?.user_role === "admin" && <Badge variant="outline" className="ml-2 text-[10px]">Admin</Badge>}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={editStatus} onValueChange={(v) => { setEditStatus(v); if (v === "trial") setEditPlan(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expirada">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === "trial" ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-sm text-muted-foreground">Os dias de teste serão definidos automaticamente conforme a configuração do sistema.</p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">Plano</label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleUpdate} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
