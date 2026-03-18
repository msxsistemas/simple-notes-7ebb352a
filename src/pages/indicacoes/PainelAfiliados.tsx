import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, Network, Copy, Check, Loader2, Trash2, ChevronRight, ChevronDown, Link as LinkIcon, Lock, DollarSign, UserCheck, Wallet, HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import { useAfiliados, AfiliadoRede } from "@/hooks/useAfiliados";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function PainelAfiliados() {
  const {
    tree, rede, redeN2, redeN3, niveisConfig, userConfig, isLoading,
    removeAfiliado, saldoDisponivel, indicacoesValidas, resgatesPagos, solicitarResgate,
  } = useAfiliados();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [resgateDialogOpen, setResgateDialogOpen] = useState(false);
  const [resgateValor, setResgateValor] = useState("");
  const [resgateChavePix, setResgateChavePix] = useState("");

  // Check if user has affiliate access
  const { data: afiliadoAccess, isLoading: isLoadingAccess } = useQuery({
    queryKey: ["afiliado-user-access"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("afiliados_usuarios_config" as any)
        .select("afiliados_liberado, comissao_tipo, comissao_valor, codigo_convite")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { afiliados_liberado: boolean; comissao_tipo: string; comissao_valor: number; codigo_convite: string | null } | null;
    },
  });

  const baseUrl = "https://gestormsx.pro";
  const inviteCode = afiliadoAccess?.codigo_convite || userConfig?.codigo_convite;
  const inviteLink = inviteCode ? `${baseUrl}/register?ref=${inviteCode}` : null;

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      toast.success("Link de convite copiado!");
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      const link = `https://gestormsx.pro/register?ref=${code}`;
      await navigator.clipboard.writeText(link);
      setCopiedCode(code);
      toast.success("Link de convite copiado!");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleSolicitarResgate = () => {
    const valor = parseFloat(resgateValor);
    if (isNaN(valor) || valor < 100) {
      toast.error("Valor mínimo para resgate: R$ 100,00");
      return;
    }
    if (!resgateChavePix.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }
    solicitarResgate.mutate(
      { valor, chavePix: resgateChavePix.trim() },
      {
        onSuccess: () => {
          setResgateDialogOpen(false);
          setResgateValor("");
          setResgateChavePix("");
        },
      }
    );
  };

  const getNivelBadge = (nivel: number) => {
    const colors: Record<number, string> = {
      2: "bg-blue-500/10 text-blue-500",
      3: "bg-purple-500/10 text-purple-500",
    };
    return <Badge className={colors[nivel] || "bg-primary/10 text-primary"}>{`N${nivel}`}</Badge>;
  };

  const renderAfiliadoRow = (afiliado: AfiliadoRede, depth: number = 0) => {
    const hasFilhos = afiliado.filhos && afiliado.filhos.length > 0;
    const isExpanded = expandedNodes.has(afiliado.id);
    const displayName = afiliado.afiliado_nome || afiliado.afiliado_email || "Usuário";

    return (
      <div key={afiliado.id}>
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {hasFilhos ? (
            <button onClick={() => toggleNode(afiliado.id)} className="p-0.5 hover:bg-muted rounded">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {getNivelBadge(afiliado.nivel)}
          <span className="font-medium text-sm flex-1 min-w-0 truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">{afiliado.afiliado_email}</span>
          <Badge className={afiliado.ativo ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}>
            {afiliado.ativo ? "Ativo" : "Inativo"}
          </Badge>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAfiliado.mutate(afiliado.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {hasFilhos && isExpanded && afiliado.filhos!.map((filho) => renderAfiliadoRow(filho, depth + 1))}
      </div>
    );
  };

  if (isLoading || isLoadingAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando rede de afiliados...</p>
      </div>
    );
  }

  if (!afiliadoAccess?.afiliados_liberado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 rounded-full bg-muted">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Painel de Afiliados Bloqueado</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          O painel de afiliados ainda não foi liberado para sua conta. Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Painel de Afiliados</h1>
            <p className="text-sm text-muted-foreground">Você é N1 — gerencie sua rede de sub-afiliados (N2, N3)</p>
          </div>
        </div>
        <Button onClick={() => setResgateDialogOpen(true)} className="gap-2">
          <HandCoins className="h-4 w-4" />
          Solicitar Resgate
        </Button>
      </header>

      {/* Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Wallet className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Disponível</p>
              <p className="text-lg font-bold">R$ {saldoDisponivel.toFixed(2).replace(".", ",")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Cadastros</p>
              <p className="text-lg font-bold">{rede.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <UserCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Indicações Válidas</p>
              <p className="text-lg font-bold">{indicacoesValidas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resgates Pagos</p>
              <p className="text-lg font-bold">R$ {resgatesPagos.toFixed(2).replace(".", ",")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">N2 / N3</p>
              <p className="text-lg font-bold">{redeN2.length} / {redeN3.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Link */}
      {inviteLink && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Seu Link de Convite (N2)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Compartilhe este link para convidar novos afiliados N2 para sua rede.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted/50 border border-border rounded-md px-3 py-2">
                <code className="text-sm text-foreground break-all">{inviteLink}</code>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyInviteLink} className="shrink-0">
                {copiedInvite ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="ml-1.5">{copiedInvite ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Config global info */}
      {niveisConfig && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sua Comissão (definida pelo admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/10 text-primary">N1 (Você)</Badge>
              <span className="text-sm font-medium">
                {niveisConfig.n1_tipo === "percentual" ? `${niveisConfig.n1_valor}%` : `R$ ${Number(niveisConfig.n1_valor).toFixed(2).replace(".", ",")}`} sobre o total de vendas da sua rede
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Você recebe essa comissão sobre todas as vendas realizadas pelos seus afiliados N2 e N3.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Network tree */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Sua Rede de Afiliados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tree.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum afiliado na rede ainda.</p>
              <p className="text-xs mt-1">Compartilhe seu link de convite para adicionar afiliados N2!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {tree.map((n2) => renderAfiliadoRow(n2, 0))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Dialog */}
      <Dialog open={resgateDialogOpen} onOpenChange={setResgateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Resgate</DialogTitle>
            <DialogDescription>
              Valor mínimo para resgate: R$ 100,00. Saldo disponível: R$ {saldoDisponivel.toFixed(2).replace(".", ",")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor do Resgate (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="100"
                placeholder="100,00"
                value={resgateValor}
                onChange={(e) => setResgateValor(e.target.value)}
              />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={resgateChavePix}
                onChange={(e) => setResgateChavePix(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResgateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSolicitarResgate} disabled={solicitarResgate.isPending}>
              {solicitarResgate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
