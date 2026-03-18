import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { 
  Wallet, UserPlus, DollarSign, Gift, FileText, MessageSquare, Users,
  History, Copy, Check, Link as LinkIcon, Share2, Loader2, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIndicacoes } from "@/hooks/useIndicacoes";

interface SaqueRow {
  id: string;
  valor: number;
  chave_pix: string;
  status: string;
  motivo_rejeicao: string | null;
  created_at: string;
}

export default function IndicacoesSistema() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { indicacoes, clientesIndicados, stats, isLoading } = useIndicacoes();
  const [tipoBonus, setTipoBonus] = useState<string>("fixo");
  const [valorBonusConfig, setValorBonusConfig] = useState<number>(0);
  const [indPage, setIndPage] = useState(1);
  const [saquePage, setSaquePage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Withdrawal state
  const [saqueDialogOpen, setSaqueDialogOpen] = useState(false);
  const [saqueValor, setSaqueValor] = useState("");
  const [saqueValorRaw, setSaqueValorRaw] = useState(0);
  const [chavePix, setChavePix] = useState("");
  const [loadingChavePix, setLoadingChavePix] = useState(false);
  const [savingSaque, setSavingSaque] = useState(false);
  const [saques, setSaques] = useState<SaqueRow[]>([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [saqueError, setSaqueError] = useState("");

  // Currency mask helper
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setSaqueValor(""); setSaqueValorRaw(0); return; }
    const numericValue = parseInt(raw, 10) / 100;
    setSaqueValorRaw(numericValue);
    setSaqueValor(formatCurrency(numericValue));
  };

  // PIX mask helper
  const formatPixKey = (value: string) => {
    const digits = value.replace(/\D/g, "");
    // CPF: 000.000.000-00
    if (digits.length <= 11 && /^\d+$/.test(value.replace(/[.\-/]/g, ""))) {
      if (digits.length <= 11) {
        return digits
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      }
    }
    // CNPJ: 00.000.000/0000-00
    if (digits.length > 11 && digits.length <= 14 && /^\d+$/.test(value.replace(/[.\-/]/g, ""))) {
      return digits
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    // Phone: (00) 00000-0000
    if (digits.length >= 10 && digits.length <= 11 && /^\d+$/.test(value.replace(/[() \-]/g, ""))) {
      if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      }
      if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      }
    }
    // E-mail or random key: no mask
    return value;
  };

  const handlePixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // If it looks like it could be digits-only (CPF/CNPJ/Phone), apply mask
    const onlyDigits = value.replace(/\D/g, "");
    if (onlyDigits.length > 0 && !value.includes("@") && onlyDigits.length <= 14) {
      setChavePix(formatPixKey(value));
    } else {
      setChavePix(value);
    }
  };

  const userCode = useMemo(() => {
    if (!userId) return "CARREGANDO...";
    return "REF_" + userId.replace(/-/g, "").substring(0, 12).toUpperCase();
  }, [userId]);

  const baseUrl = "https://gestormsx.pro";
  
  const links = useMemo(() => ({
    vendas: `${baseUrl}/site?ref=${userCode}`,
    cadastro: `${baseUrl}/register?ref=${userCode}`,
  }), [baseUrl, userCode]);

  useEffect(() => {
    document.title = "Indique e Ganhe | Tech Play";
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchSavedPixKey(user.id);
        fetchSaques(user.id);
      }
    };
    getUser();

    // Fetch bonus type config + check user's individual bonus
    const fetchBonusConfig = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data } = await supabase.from("system_indicacoes_config").select("tipo_bonus, valor_bonus").eq("id", 1).single();
      if (data?.tipo_bonus) setTipoBonus(data.tipo_bonus);
      if (data?.valor_bonus != null) setValorBonusConfig(Number(data.valor_bonus));
      
      // Check if user has individual bonus (from latest indicação)
      if (currentUser) {
        const { data: lastInd } = await supabase
          .from("indicacoes")
          .select("bonus")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastInd && Number(lastInd.bonus) > 0) {
          setValorBonusConfig(Number(lastInd.bonus));
        }
      }
    };
    fetchBonusConfig();
  }, []);

  const fetchSavedPixKey = async (uid: string) => {
    setLoadingChavePix(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("chave_pix_indicacao")
        .eq("user_id", uid)
        .single();
      if (data?.chave_pix_indicacao) {
        setChavePix(data.chave_pix_indicacao);
      }
    } catch (err) {
      console.error("Erro ao carregar chave PIX:", err);
    } finally {
      setLoadingChavePix(false);
    }
  };

  const fetchSaques = async (uid: string) => {
    setLoadingSaques(true);
    try {
      const { data, error } = await supabase
        .from("saques_indicacao")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSaques(data || []);
    } catch (err) {
      console.error("Erro ao carregar saques:", err);
    } finally {
      setLoadingSaques(false);
    }
  };

  const handleOpenSaqueDialog = () => {
    setSaqueValor("");
    setSaqueValorRaw(0);
    setSaqueError("");
    setSaqueDialogOpen(true);
  };


  const handleSolicitarSaque = async () => {
    if (!userId) return;
    setSaqueError("");
    
    const valor = saqueValorRaw;
    if (!valor || valor <= 0) {
      setSaqueError("Informe um valor válido");
      return;
    }
    if (valor < 50) {
      setSaqueError("O valor mínimo para saque é R$ 50,00");
      return;
    }
    const valorComTaxa = valor + TAXA_SAQUE;
    if (valorComTaxa > saldoReal) {
      setSaqueError(`Saldo insuficiente. Valor + taxa: R$ ${valorComTaxa.toFixed(2).replace(".", ",")}`);
      return;
    }
    if (!chavePix.trim()) {
      setSaqueError("Informe sua chave PIX");
      return;
    }

    setSavingSaque(true);
    try {
      // Save PIX key to profile
      await supabase
        .from("profiles")
        .update({ chave_pix_indicacao: chavePix.trim() })
        .eq("user_id", userId);

      // Create withdrawal request (valor includes the fee info)
      const { error } = await supabase.from("saques_indicacao").insert({
        user_id: userId,
        valor: valorComTaxa,
        chave_pix: chavePix.trim(),
        status: "pendente",
      });

      if (error) throw error;

      toast.success(`Saque de R$ ${valor.toFixed(2).replace(".", ",")} solicitado (taxa R$ ${TAXA_SAQUE.toFixed(2).replace(".", ",")})`);
      setSaqueDialogOpen(false);
      fetchSaques(userId);
    } catch (err: any) {
      toast.error("Erro ao solicitar saque: " + (err.message || ""));
    } finally {
      setSavingSaque(false);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    if (userCode === "CARREGANDO...") {
      toast.error("Aguarde o carregamento do código");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Aprovado</Badge>;
      case "pago":
        return <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Pago</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getSaqueStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Aprovado</Badge>;
      case "pago":
        return <Badge className="bg-green-500/10 text-green-500">Pago</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const TAXA_SAQUE = 1.50;
  const VALOR_MINIMO_SAQUE = 50.00;

  // Calculate pending withdrawals to show correct available balance
  const saquePendente = saques
    .filter(s => s.status === "pendente" || s.status === "aprovado")
    .reduce((acc, s) => acc + Number(s.valor), 0);

  const saldoReal = stats.saldoDisponivel - saquePendente;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando indicações...</p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Indique e Ganhe</h1>
            <p className="text-sm text-muted-foreground">Ganhe comissões indicando novos clientes</p>
          </div>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90"
          onClick={handleOpenSaqueDialog}
          disabled={saldoReal <= 0}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Solicitar Resgate
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Saldo Disponível</p>
              <p className="text-lg font-bold text-foreground">R$ {saldoReal.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gift className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ganho por Indicação</p>
              <p className="text-lg font-bold text-foreground">
                {tipoBonus === "percentual"
                  ? `${valorBonusConfig.toFixed(2).replace('.', ',')}%`
                  : `R$ ${valorBonusConfig.toFixed(2).replace('.', ',')}`}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total de Indicações</p>
              <p className="text-lg font-bold text-foreground">{stats.totalIndicacoes}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Resgates Pagos</p>
              <p className="text-lg font-bold text-foreground">R$ {stats.resgatesPagos.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Clientes Indicados</p>
              <p className="text-lg font-bold text-foreground">{clientesIndicados.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Código do usuário */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Seu código de indicação:</p>
              <p className="text-lg font-mono font-bold text-primary">{userCode}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleCopy(userCode, 'code')}>
              {copiedLink === 'code' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar Código
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="indique" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="indique" className="gap-1.5 text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Gift className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Indique & Ganhe</span>
            <span className="sm:hidden">Indicar</span>
          </TabsTrigger>
          <TabsTrigger value="materiais" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Materiais</span>
            <span className="sm:hidden">Mídias</span>
          </TabsTrigger>
          <TabsTrigger value="modelos" className="gap-1.5 text-xs py-2">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mensagens</span>
            <span className="sm:hidden">Msgs</span>
          </TabsTrigger>
          <TabsTrigger value="indicacoes" className="gap-1.5 text-xs py-2">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suas Indicações</span>
            <span className="sm:hidden">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="saques" className="gap-1.5 text-xs py-2">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Meus Saques</span>
            <span className="sm:hidden">Saques</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Indique & Ganhe */}
        <TabsContent value="indique" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                Link de Cadastro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                  {links.vendas}
                </div>
                <Button size="sm" onClick={() => handleCopy(links.vendas, 'vendas')}>
                  {copiedLink === 'vendas' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ★ Ideal para divulgação! Leva para a página.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Materiais */}
        <TabsContent value="materiais" className="mt-3">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Em breve: banners e materiais para divulgação.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Modelos */}
        <TabsContent value="modelos" className="mt-3">
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Em breve: modelos de mensagens prontas.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Suas Indicações */}
        <TabsContent value="indicacoes" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : indicacoes.length === 0 ? (
                <div className="p-6 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma indicação ainda. Compartilhe seu link!</p>
                </div>
              ) : (() => {
                const indTotalPages = Math.ceil(indicacoes.length / ITEMS_PER_PAGE);
                const indPaginated = indicacoes.slice((indPage - 1) * ITEMS_PER_PAGE, indPage * ITEMS_PER_PAGE);
                return (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Bônus</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {indPaginated.map((ind) => (
                          <TableRow key={ind.id}>
                            <TableCell className="font-medium">{ind.indicado_nome || ind.cliente?.nome || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{ind.codigo_indicacao}</TableCell>
                            <TableCell>
                              {tipoBonus === "percentual"
                                ? `${Number(ind.bonus).toFixed(2).replace(".", ",")}%`
                                : `R$ ${Number(ind.bonus).toFixed(2).replace(".", ",")}`}
                            </TableCell>
                            <TableCell>{getStatusBadge(ind.status)}</TableCell>
                            <TableCell>
                              {new Date(ind.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {indTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">{indicacoes.length} registro(s) — Página {indPage} de {indTotalPages}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={indPage <= 1} onClick={() => setIndPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={indPage >= indTotalPages} onClick={() => setIndPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Meus Saques */}
        <TabsContent value="saques" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {loadingSaques ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : saques.length === 0 ? (
                <div className="p-6 text-center">
                  <Wallet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum saque solicitado ainda.</p>
                </div>
              ) : (() => {
                const saqueTotalPages = Math.ceil(saques.length / ITEMS_PER_PAGE);
                const saquePaginated = saques.slice((saquePage - 1) * ITEMS_PER_PAGE, saquePage * ITEMS_PER_PAGE);
                return (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Valor</TableHead>
                          <TableHead>Chave PIX</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saquePaginated.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">R$ {Number(s.valor).toFixed(2).replace(".", ",")}</TableCell>
                            <TableCell className="font-mono text-xs">{s.chave_pix}</TableCell>
                            <TableCell>{getSaqueStatusBadge(s.status)}</TableCell>
                            <TableCell>{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.motivo_rejeicao || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {saqueTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">{saques.length} registro(s) — Página {saquePage} de {saqueTotalPages}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={saquePage <= 1} onClick={() => setSaquePage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={saquePage >= saqueTotalPages} onClick={() => setSaquePage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Solicitar Saque */}
      <Dialog open={saqueDialogOpen} onOpenChange={setSaqueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Resgate</DialogTitle>
            <DialogDescription>
              Saldo disponível: R$ {saldoReal.toFixed(2).replace(".", ",")} | Taxa por saque: R$ {TAXA_SAQUE.toFixed(2).replace(".", ",")} | Mínimo: R$ {VALOR_MINIMO_SAQUE.toFixed(2).replace(".", ",")}
            </DialogDescription>
          </DialogHeader>
          {saqueError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {saqueError}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Resgate (R$)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={saqueValor}
                onChange={handleValorChange}
              />
              {saqueValorRaw > 0 && (
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor solicitado:</span>
                    <span>R$ {formatCurrency(saqueValorRaw)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de saque:</span>
                    <span className="text-destructive">- R$ {formatCurrency(TAXA_SAQUE)}</span>
                  </div>
                  <div className="border-t border-border pt-1 flex justify-between font-medium">
                    <span>Total debitado do saldo:</span>
                    <span>R$ {formatCurrency(saqueValorRaw + TAXA_SAQUE)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={chavePix}
                onChange={handlePixChange}
              />
              <p className="text-[11px] text-muted-foreground">
                Sua chave PIX será salva para futuros saques. Você pode alterá-la a qualquer momento.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaqueDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSolicitarSaque} disabled={savingSaque}>
              {savingSaque ? "Enviando..." : "Solicitar Resgate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
