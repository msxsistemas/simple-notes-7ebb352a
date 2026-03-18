import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Users, Ban, CheckCircle, Shield, Search, ChevronLeft, ChevronRight, UserX, Repeat, Settings2, Network, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  clientes_count: number;
  banned_until: string | null;
}

interface RecorrenteConfig {
  ativo: boolean;
  valor_desconto: number;
  tipo_desconto: string;
  min_indicacoes: number;
  periodo: string;
}

interface AfiliadoUserConfig {
  afiliados_liberado: boolean;
  comissao_tipo: string;
  comissao_valor: number;
}

const DEFAULT_CONFIG: RecorrenteConfig = {
  ativo: true,
  valor_desconto: 10,
  tipo_desconto: "percentual",
  min_indicacoes: 3,
  periodo: "mensal",
};

const DEFAULT_AFILIADO_CONFIG: AfiliadoUserConfig = {
  afiliados_liberado: false,
  comissao_tipo: "percentual",
  comissao_valor: 10,
};

const PER_PAGE = 10;

export default function AdminUsuarios() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [recorrenteMap, setRecorrenteMap] = useState<Record<string, RecorrenteConfig>>({});
  const [togglingRecorrente, setTogglingRecorrente] = useState<string | null>(null);
  const [configDialog, setConfigDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [editConfig, setEditConfig] = useState<RecorrenteConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [afiliadoMap, setAfiliadoMap] = useState<Record<string, AfiliadoUserConfig>>({});
  const [afiliadoDialog, setAfiliadoDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [editAfiliadoConfig, setEditAfiliadoConfig] = useState<AfiliadoUserConfig>(DEFAULT_AFILIADO_CONFIG);
  const [savingAfiliado, setSavingAfiliado] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const filteredUsers = useMemo(() => users.filter((u) => {
    const term = search.toLowerCase();
    const matchesSearch = !term || u.email.toLowerCase().includes(term) || (u.full_name || "").toLowerCase().includes(term);
    if (!matchesSearch) return false;
    if (filter === "todos") return true;
    const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
    return filter === "ativos" ? !isBanned : isBanned;
  }), [users, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => { setPage(1); }, [search, filter]);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "list_users" }),
        }
      );
      const result = await resp.json();
      if (result.success) setUsers(result.users);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecorrenteStatus = async () => {
    const { data } = await supabase
      .from("indicacoes_auto_renovacao")
      .select("user_id, ativo, valor_desconto, tipo_desconto, min_indicacoes, periodo");
    if (data) {
      const map: Record<string, RecorrenteConfig> = {};
      data.forEach((r) => {
        map[r.user_id] = {
          ativo: r.ativo ?? false,
          valor_desconto: r.valor_desconto ?? 10,
          tipo_desconto: r.tipo_desconto ?? "percentual",
          min_indicacoes: r.min_indicacoes ?? 3,
          periodo: r.periodo ?? "mensal",
        };
      });
      setRecorrenteMap(map);
    }
  };

  const fetchAfiliadoStatus = async () => {
    const { data } = await supabase
      .from("afiliados_usuarios_config" as any)
      .select("user_id, afiliados_liberado, comissao_tipo, comissao_valor");
    if (data) {
      const map: Record<string, AfiliadoUserConfig> = {};
      (data as any[]).forEach((r: any) => {
        map[r.user_id] = {
          afiliados_liberado: r.afiliados_liberado ?? false,
          comissao_tipo: r.comissao_tipo ?? "percentual",
          comissao_valor: r.comissao_valor ?? 10,
        };
      });
      setAfiliadoMap(map);
    }
  };

  useEffect(() => {
    document.title = "Usuários | Admin Gestor Msx";
    fetchUsers();
    fetchRecorrenteStatus();
    fetchAfiliadoStatus();
  }, []);

  const handleToggleRecorrente = async (userId: string, ativo: boolean) => {
    if (ativo) {
      // Opening config dialog when activating
      const user = users.find(u => u.id === userId);
      const existing = recorrenteMap[userId];
      setEditConfig(existing || DEFAULT_CONFIG);
      setEditConfig(prev => ({ ...prev, ativo: true }));
      setConfigDialog({ userId, userName: user?.full_name || user?.email || userId });
      return;
    }

    // Deactivating directly
    setTogglingRecorrente(userId);
    try {
      const { data: existing } = await supabase
        .from("indicacoes_auto_renovacao")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("indicacoes_auto_renovacao")
          .update({ ativo: false })
          .eq("user_id", userId);
      }

      setRecorrenteMap((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || DEFAULT_CONFIG), ativo: false },
      }));
      toast({ title: "Indicação recorrente desativada" });
    } catch {
      toast({ title: "Erro ao desativar", variant: "destructive" });
    } finally {
      setTogglingRecorrente(null);
    }
  };

  const handleOpenConfig = (userId: string) => {
    const user = users.find(u => u.id === userId);
    const existing = recorrenteMap[userId];
    setEditConfig(existing || DEFAULT_CONFIG);
    setConfigDialog({ userId, userName: user?.full_name || user?.email || userId });
  };

  const handleSaveConfig = async () => {
    if (!configDialog) return;
    setSavingConfig(true);
    try {
      const { data: existing } = await supabase
        .from("indicacoes_auto_renovacao")
        .select("id")
        .eq("user_id", configDialog.userId)
        .maybeSingle();

      const payload = {
        ativo: editConfig.ativo,
        valor_desconto: editConfig.valor_desconto,
        tipo_desconto: editConfig.tipo_desconto,
        min_indicacoes: editConfig.min_indicacoes,
        periodo: editConfig.periodo,
      };

      if (existing) {
        await supabase
          .from("indicacoes_auto_renovacao")
          .update(payload)
          .eq("user_id", configDialog.userId);
      } else {
        await supabase
          .from("indicacoes_auto_renovacao")
          .insert({ user_id: configDialog.userId, ...payload });
      }

      setRecorrenteMap((prev) => ({
        ...prev,
        [configDialog.userId]: editConfig,
      }));
      toast({ title: "Configuração de indicação recorrente salva!" });
      setConfigDialog(null);
    } catch {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleBan = async (userId: string, ban: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "toggle_user_ban", target_user_id: userId, ban }),
        }
      );
      toast({ title: ban ? "Usuário bloqueado" : "Usuário desbloqueado" });
      fetchUsers();
    } catch {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "delete_user", target_user_id: deleteDialog.userId }),
        }
      );
      const result = await resp.json();
      if (result.success) {
        toast({ title: "Usuário removido com sucesso!" });
        fetchUsers();
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao remover usuário", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  };

  const handleToggleAfiliado = (userId: string, liberado: boolean) => {
    const user = users.find(u => u.id === userId);
    const existing = afiliadoMap[userId];
    setEditAfiliadoConfig(existing ? { ...existing, afiliados_liberado: liberado } : { ...DEFAULT_AFILIADO_CONFIG, afiliados_liberado: liberado });
    setAfiliadoDialog({ userId, userName: user?.full_name || user?.email || userId });
  };

  const handleSaveAfiliado = async () => {
    if (!afiliadoDialog) return;
    setSavingAfiliado(true);
    try {
      const { data: existing } = await supabase
        .from("afiliados_usuarios_config" as any)
        .select("id")
        .eq("user_id", afiliadoDialog.userId)
        .maybeSingle();

      const generateCode = () => 'AFF_' + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 10);

      const payload: any = {
        afiliados_liberado: editAfiliadoConfig.afiliados_liberado,
        comissao_tipo: editAfiliadoConfig.comissao_tipo,
        comissao_valor: editAfiliadoConfig.comissao_valor,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // If enabling affiliates, check if code exists, generate if not
        if (editAfiliadoConfig.afiliados_liberado) {
          const { data: currentConfig } = await supabase
            .from("afiliados_usuarios_config" as any)
            .select("codigo_convite")
            .eq("user_id", afiliadoDialog.userId)
            .single();
          if (!(currentConfig as any)?.codigo_convite) {
            payload.codigo_convite = generateCode();
          }
        }
        await supabase
          .from("afiliados_usuarios_config" as any)
          .update(payload as any)
          .eq("user_id", afiliadoDialog.userId);
      } else {
        if (editAfiliadoConfig.afiliados_liberado) {
          payload.codigo_convite = generateCode();
        }
        await supabase
          .from("afiliados_usuarios_config" as any)
          .insert({ user_id: afiliadoDialog.userId, ...payload } as any);
      }

      setAfiliadoMap((prev) => ({
        ...prev,
        [afiliadoDialog.userId]: editAfiliadoConfig,
      }));
      toast({ title: editAfiliadoConfig.afiliados_liberado ? "Afiliados liberado para o usuário!" : "Afiliados desativado para o usuário" });
      setAfiliadoDialog(null);
    } catch {
      toast({ title: "Erro ao salvar configuração de afiliados", variant: "destructive" });
    } finally {
      setSavingAfiliado(false);
    }
  };

  return (
    <div className="space-y-3">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Gerenciar Usuários</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Visualize e gerencie o acesso dos usuários do sistema.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Usuários ({filteredUsers.length})</CardTitle>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
                <TabsTrigger value="ativos" className="text-xs px-3 h-7">Ativos</TabsTrigger>
                <TabsTrigger value="inativos" className="text-xs px-3 h-7">Inativos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>Lista de todos os usuários registrados na plataforma.</CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <UserX className="h-10 w-10 opacity-40" />
              <p className="text-sm">Nenhum usuário encontrado.</p>
              {(search || filter !== "todos") && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setFilter("todos"); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6">
                <div className="min-w-[800px] px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-center">Clientes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1 cursor-help">
                                  <Repeat className="h-3.5 w-3.5" />
                                  <span>Ind. Recorrente</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Ativa comissão recorrente por indicações para este usuário</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1 cursor-help">
                                  <Network className="h-3.5 w-3.5" />
                                  <span>Afiliados</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Libera o painel de afiliados e define a comissão do usuário</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Último Login</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((u) => {
                        const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
                        const isAdmin = u.role === "admin";
                        const userConfig = recorrenteMap[u.id];
                        const isRecorrente = userConfig?.ativo ?? false;
                        const userAfiliadoConfig = afiliadoMap[u.id];
                        const isAfiliadoLiberado = userAfiliadoConfig?.afiliados_liberado ?? false;
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate">{u.email}</TableCell>
                            <TableCell className="text-sm">{u.full_name || "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{u.clientes_count}</Badge>
                            </TableCell>
                            <TableCell>
                              {isBanned && !isAdmin ? (
                                <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30">
                                  <Ban className="h-3 w-3 mr-1" />
                                  Bloqueado
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Switch
                                  checked={isRecorrente}
                                  disabled={togglingRecorrente === u.id}
                                  onCheckedChange={(v) => handleToggleRecorrente(u.id, v)}
                                />
                                {isRecorrente && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleOpenConfig(u.id)}
                                        >
                                          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Configurar indicação recorrente</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Switch
                                  checked={isAfiliadoLiberado}
                                  onCheckedChange={(v) => handleToggleAfiliado(u.id, v)}
                                />
                                {isAfiliadoLiberado && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleToggleAfiliado(u.id, true)}
                                        >
                                          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Configurar comissão de afiliados</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}
                            </TableCell>
                            <TableCell className="text-right">
                              {isAdmin ? (
                                <span className="text-xs text-muted-foreground italic">Protegido</span>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  {isBanned ? (
                                    <Button variant="ghost" size="sm" onClick={() => handleToggleBan(u.id, false)} className="text-green-400 hover:text-green-300 h-8">
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      <span className="text-xs">Desbloquear</span>
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" onClick={() => handleToggleBan(u.id, true)} className="text-destructive hover:text-destructive h-8">
                                      <Ban className="h-4 w-4 mr-1" />
                                      <span className="text-xs">Bloquear</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteDialog({ userId: u.id, userName: u.full_name || u.email })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {((currentPage - 1) * PER_PAGE) + 1}–{Math.min(currentPage * PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={p === currentPage ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Config Dialog */}
      <Dialog open={!!configDialog} onOpenChange={(open) => !open && setConfigDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Repeat className="h-4 w-4" />
              Indicação Recorrente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configurar comissão recorrente por indicações para <strong>{configDialog?.userName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Comissão</Label>
                <Select
                  value={editConfig.tipo_desconto}
                  onValueChange={(v) => setEditConfig((c) => ({ ...c, tipo_desconto: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {editConfig.tipo_desconto === "fixo" ? "Valor (R$)" : "Percentual (%)"}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-9"
                  value={editConfig.valor_desconto}
                  onChange={(e) => setEditConfig((c) => ({ ...c, valor_desconto: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mín. de Indicações</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-9"
                  value={editConfig.min_indicacoes}
                  onChange={(e) => setEditConfig((c) => ({ ...c, min_indicacoes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Período</Label>
                <Select
                  value={editConfig.periodo}
                  onValueChange={(v) => setEditConfig((c) => ({ ...c, periodo: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
              O usuário indicador receberá uma comissão de{" "}
              <strong>
                {editConfig.tipo_desconto === "fixo"
                  ? `R$ ${editConfig.valor_desconto.toFixed(2)}`
                  : `${editConfig.valor_desconto}%`}
              </strong>{" "}
              a cada <strong>{editConfig.min_indicacoes}</strong> indicação(ões) aprovada(s), 
              renovado <strong>{editConfig.periodo === "mensal" ? "mensalmente" : editConfig.periodo === "trimestral" ? "trimestralmente" : editConfig.periodo === "semestral" ? "semestralmente" : "anualmente"}</strong>.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfigDialog(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Afiliados Config Dialog */}
      <Dialog open={!!afiliadoDialog} onOpenChange={(open) => !open && setAfiliadoDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4" />
              Configurar Afiliados
            </DialogTitle>
            <DialogDescription className="text-xs">
              Liberar acesso e definir comissão de afiliados para <strong>{afiliadoDialog?.userName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Liberar Painel de Afiliados</Label>
              <Switch
                checked={editAfiliadoConfig.afiliados_liberado}
                onCheckedChange={(v) => setEditAfiliadoConfig((c) => ({ ...c, afiliados_liberado: v }))}
              />
            </div>

            {editAfiliadoConfig.afiliados_liberado && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Comissão</Label>
                  <Select
                    value={editAfiliadoConfig.comissao_tipo}
                    onValueChange={(v) => setEditAfiliadoConfig((c) => ({ ...c, comissao_tipo: v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                      <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {editAfiliadoConfig.comissao_tipo === "fixo" ? "Valor (R$)" : "Percentual (%)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-9"
                    value={editAfiliadoConfig.comissao_valor}
                    onChange={(e) => setEditAfiliadoConfig((c) => ({ ...c, comissao_valor: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
              {editAfiliadoConfig.afiliados_liberado
                ? `O usuário terá acesso ao painel de afiliados com comissão de ${
                    editAfiliadoConfig.comissao_tipo === "fixo"
                      ? `R$ ${editAfiliadoConfig.comissao_valor.toFixed(2)}`
                      : `${editAfiliadoConfig.comissao_valor}%`
                  } por indicação.`
                : "O painel de afiliados ficará bloqueado para este usuário."}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setAfiliadoDialog(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveAfiliado} disabled={savingAfiliado}>
              {savingAfiliado ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteDialog?.userName}</strong>? Esta ação é irreversível e todos os dados do usuário serão apagados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
