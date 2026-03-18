import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, Users, Gift, TrendingUp, ChevronLeft, ChevronRight, Share2, CheckCircle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";

interface RowData {
  id: string;
  nome: string;
  indicador_nome: string;
  indicador_id: string;
  plano_nome: string;
  created_at: string | null;
  ativo: boolean | null;
}

interface DescontoLog {
  id: string;
  indicador_nome: string;
  valor_original: number;
  valor_desconto: number;
  valor_final: number;
  tipo_desconto: string;
  ciclo: number;
  created_at: string;
}

interface AutoRenovacaoConfig {
  id?: string;
  ativo: boolean;
  min_indicacoes: number;
  periodo: string;
  valor_desconto: number;
  tipo_desconto: string;
}

const ITEMS_PER_PAGE = 10;

export default function Indicacoes() {
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [periodo, setPeriodo] = useState("todos");
  const { userId } = useCurrentUser();

  // Auto-renovação config
  const [autoConfig, setAutoConfig] = useState<AutoRenovacaoConfig>({
    ativo: false, min_indicacoes: 3, periodo: "mensal", valor_desconto: 10, tipo_desconto: "percentual",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [descontosLog, setDescontosLog] = useState<DescontoLog[]>([]);

  useEffect(() => { document.title = "Indicações | Tech Play"; }, []);

  useEffect(() => {
    if (userId) {
      fetchIndicacoes();
      fetchAutoConfig();
      fetchDescontosLog();
    }
  }, [userId]);

  const fetchAutoConfig = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("indicacoes_auto_renovacao")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setAutoConfig(data as AutoRenovacaoConfig);
  };

  const fetchDescontosLog = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("indicacoes_descontos_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setDescontosLog(data as DescontoLog[]);
  };

  const saveAutoConfig = async () => {
    if (!userId) return;
    setSavingConfig(true);
    try {
      const payload = {
        user_id: userId,
        ativo: autoConfig.ativo,
        min_indicacoes: autoConfig.min_indicacoes,
        periodo: autoConfig.periodo,
        valor_desconto: autoConfig.valor_desconto,
        tipo_desconto: autoConfig.tipo_desconto,
      };
      const { error } = await supabase
        .from("indicacoes_auto_renovacao")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Configuração salva com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchIndicacoes = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, nome, indicador, plano, created_at, ativo")
        .eq("user_id", userId)
        .not("indicador", "is", null)
        .not("indicador", "eq", "");

      if (error) throw error;
      if (!clientes?.length) { setRows([]); setLoading(false); return; }

      const indicadorIds = [...new Set(clientes.map(c => c.indicador).filter(Boolean))] as string[];
      const planoIds = [...new Set(clientes.map(c => c.plano).filter(Boolean))] as string[];

      const indicadorMap = new Map<string, string>();
      if (indicadorIds.length) {
        const { data: indicadores } = await supabase
          .from("clientes")
          .select("id, nome")
          .in("id", indicadorIds);
        indicadores?.forEach(i => indicadorMap.set(i.id, i.nome));
      }

      const planoMap = new Map<string, string>();
      if (planoIds.length) {
        const { data: planos } = await supabase
          .from("planos")
          .select("id, nome")
          .in("id", planoIds);
        planos?.forEach(p => planoMap.set(p.id, p.nome));
      }

      const resolved: RowData[] = clientes.map(c => ({
        id: c.id,
        nome: c.nome,
        indicador_nome: indicadorMap.get(c.indicador!) || c.indicador || "-",
        indicador_id: c.indicador || "",
        plano_nome: planoMap.get(c.plano!) || c.plano || "-",
        created_at: c.created_at,
        ativo: c.ativo,
      }));

      setRows(resolved);
    } catch (error) {
      console.error("Erro ao carregar indicações:", error);
      toast.error("Erro ao carregar indicações");
    } finally {
      setLoading(false);
    }
  };

  const getDateFrom = () => {
    const now = new Date();
    switch (periodo) {
      case "7dias": return subDays(now, 7);
      case "15dias": return subDays(now, 15);
      case "30dias": return subDays(now, 30);
      case "mes": return startOfMonth(now);
      case "ano": return startOfYear(now);
      default: return null;
    }
  };

  const filtered = rows.filter((r) => {
    const matchesSearch =
      r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.indicador_nome.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    const dateLimit = getDateFrom();
    if (dateLimit && r.created_at) {
      matchesDate = new Date(r.created_at) >= dateLimit;
    } else if (dateLimit && !r.created_at) {
      matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedRows = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm, periodo]);

  const totalIndicadores = new Set(rows.map(r => r.indicador_nome)).size;
  const totalIndicados = rows.length;

  // Count referrals per indicador
  const indicadorCounts = new Map<string, number>();
  rows.forEach(r => {
    const key = r.indicador_id || r.indicador_nome;
    indicadorCounts.set(key, (indicadorCounts.get(key) || 0) + 1);
  });

  // Build position map: for each indicador, sort referrals by date and assign position
  const indicadorPositions = new Map<string, number>();
  const indicadorGroups = new Map<string, RowData[]>();
  rows.forEach(r => {
    const key = r.indicador_id || r.indicador_nome;
    if (!indicadorGroups.has(key)) indicadorGroups.set(key, []);
    indicadorGroups.get(key)!.push(r);
  });
  indicadorGroups.forEach((group) => {
    group.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    group.forEach((r, idx) => {
      indicadorPositions.set(r.id, idx + 1); // 1-based position
    });
  });

  // Calculate accumulated discount for the indicador up to a specific position
  const getDescontoAcumulado = (indicadorKey: string, position: number): string => {
    if (!autoConfig.ativo || autoConfig.min_indicacoes < 1) return "-";
    // How many cycles completed up to this position
    const ciclosAteAqui = Math.floor(position / autoConfig.min_indicacoes);
    if (ciclosAteAqui < 1) return "-";
    if (autoConfig.tipo_desconto === "percentual") {
      const totalPercent = autoConfig.valor_desconto * ciclosAteAqui;
      return `${totalPercent}%`;
    }
    const total = autoConfig.valor_desconto * ciclosAteAqui;
    return `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  // Check if a specific row is the one that completes a cycle
  const isMetaRow = (row: RowData): boolean => {
    if (!autoConfig.ativo || autoConfig.min_indicacoes < 1) return false;
    const pos = indicadorPositions.get(row.id) || 0;
    return pos > 0 && pos % autoConfig.min_indicacoes === 0;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando indicações...</p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Indicações</h1>
            <p className="text-sm text-muted-foreground">Clientes indicados e seus indicadores</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Indicadores</p>
              <p className="text-2xl font-bold text-foreground">{totalIndicadores}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes Indicados</p>
              <p className="text-2xl font-bold text-foreground">{totalIndicados}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Gift className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Descontos Concedidos</p>
              <p className="text-2xl font-bold text-foreground">
                {(() => {
                  if (!autoConfig.ativo) return "R$ 0,00";
                  let total = 0;
                  const counted = new Set<string>();
                  rows.forEach(r => {
                    const key = r.indicador_id || r.indicador_nome;
                    if (counted.has(key)) return;
                    const count = indicadorCounts.get(key) || 0;
                    if (count >= autoConfig.min_indicacoes) {
                      const vezes = Math.floor(count / autoConfig.min_indicacoes);
                      if (autoConfig.tipo_desconto === "fixo") {
                        total += autoConfig.valor_desconto * vezes;
                      } else {
                        total += vezes; // count occurrences for percentage
                      }
                      counted.add(key);
                    }
                  });
                  if (autoConfig.tipo_desconto === "percentual") return `${total}x ${autoConfig.valor_desconto}%`;
                  return `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desconto na Fatura por Indicações */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Desconto na Fatura por Indicações</h2>
              <p className="text-sm text-muted-foreground">Aplique desconto automático na fatura do indicador ao atingir a meta</p>
            </div>
          </div>
          <Switch
            checked={autoConfig.ativo}
            onCheckedChange={(v) => setAutoConfig(c => ({ ...c, ativo: v }))}
          />
        </div>

        {autoConfig.ativo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Mín. de Indicações</Label>
              <Input
                type="number"
                min={1}
                value={autoConfig.min_indicacoes}
                onChange={(e) => setAutoConfig(c => ({ ...c, min_indicacoes: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">Quantidade para ganhar desconto</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Período de Contagem</Label>
              <Select value={autoConfig.periodo} onValueChange={(v) => setAutoConfig(c => ({ ...c, periodo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="todos">Todos os tempos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Tipo de Desconto</Label>
              <Select value={autoConfig.tipo_desconto} onValueChange={(v) => setAutoConfig(c => ({ ...c, tipo_desconto: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Valor do Desconto</Label>
              {autoConfig.tipo_desconto === "fixo" ? (
                <CurrencyInput
                  value={autoConfig.valor_desconto}
                  onValueChange={(v) => setAutoConfig(c => ({ ...c, valor_desconto: v }))}
                />
              ) : (
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={autoConfig.valor_desconto}
                    onChange={(e) => setAutoConfig(c => ({ ...c, valor_desconto: Number(e.target.value) }))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">%</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{autoConfig.tipo_desconto === "percentual" ? "% de desconto na fatura" : "R$ de desconto na fatura"}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={saveAutoConfig} disabled={savingConfig} size="sm">
            {savingConfig ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configuração"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Busca</Label>
            <Input placeholder="Nome ou indicador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="15dias">Últimos 15 dias</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="ano">Este ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setSearchTerm(""); setPeriodo("todos"); }}>Limpar</Button>
          </div>
        </div>
      </div>

      <div className="text-right text-sm text-muted-foreground">
        Mostrando {paginatedRows.length} de {filtered.length} registros.
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="px-6 py-3">Indicado</TableHead>
              <TableHead className="px-6 py-3">Quem Indicou</TableHead>
              <TableHead className="px-6 py-3">Indicações</TableHead>
              <TableHead className="px-6 py-3">Desconto</TableHead>
              <TableHead className="px-6 py-3">Registro</TableHead>
              <TableHead className="px-6 py-3">Plano</TableHead>
              <TableHead className="px-6 py-3 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length ? (
              paginatedRows.map((row) => {
                const count = indicadorCounts.get(row.indicador_id || row.indicador_nome) || 0;
                const cicloAtual = autoConfig.ativo ? (count % autoConfig.min_indicacoes) : count;
                const ciclosCompletos = autoConfig.ativo ? Math.floor(count / autoConfig.min_indicacoes) : 0;
                const metaAtingida = autoConfig.ativo && count >= autoConfig.min_indicacoes;
                return (
                  <TableRow key={row.id} className="border-border">
                    <TableCell className="px-6 py-4 font-medium text-blue-600 dark:text-blue-500">{row.nome}</TableCell>
                    <TableCell className="px-6 py-4 text-blue-600 dark:text-blue-500">{row.indicador_nome}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${metaAtingida ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {autoConfig.ativo ? `${cicloAtual}/${autoConfig.min_indicacoes}` : count}
                        {ciclosCompletos > 0 && <span className="text-[10px] opacity-70">({ciclosCompletos}x)</span>}
                        {metaAtingida && <CheckCircle className="h-3 w-3" />}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className={`text-sm font-medium ${isMetaRow(row) ? "text-green-500" : "text-muted-foreground"}`}>
                        {isMetaRow(row) ? getDescontoAcumulado(row.indicador_id || row.indicador_nome, indicadorPositions.get(row.id) || 0) : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4">{row.plano_nome}</TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover indicação</AlertDialogTitle>
                            <AlertDialogDescription>
                              Para remover a indicação, edite o cliente e limpe o campo "Indicador".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Entendi</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma indicação encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Histórico de Descontos por Indicações */}
      {descontosLog.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Histórico de Descontos</h2>
              <p className="text-sm text-muted-foreground">Descontos concedidos por indicações</p>
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="px-4 py-2">Indicador</TableHead>
                  <TableHead className="px-4 py-2">Valor Original</TableHead>
                  <TableHead className="px-4 py-2">Desconto</TableHead>
                  <TableHead className="px-4 py-2">Valor Final</TableHead>
                  <TableHead className="px-4 py-2">Ciclo</TableHead>
                  <TableHead className="px-4 py-2">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {descontosLog.map((log) => (
                  <TableRow key={log.id} className="border-border">
                    <TableCell className="px-4 py-3 font-medium text-foreground">{log.indicador_nome}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      R$ {Number(log.valor_original).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-green-500 font-medium">
                        - {log.tipo_desconto === "percentual"
                          ? `${Number(log.valor_desconto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`
                          : `R$ ${Number(log.valor_desconto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 font-semibold text-foreground">
                      R$ {Number(log.valor_final).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {log.ciclo}º
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </main>
  );
}
