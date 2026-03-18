import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const GATEWAY_OPTIONS = [
  { id: "asaas", label: "Asaas" },
  { id: "mercadopago", label: "Mercado Pago" },
  { id: "ciabra", label: "Ciabra" },
  { id: "v3pay", label: "V3Pay PF" },
  { id: "v3pay_pj", label: "V3Pay PJ" },
  { id: "woovi", label: "Woovi" },
];

export default function RotacaoGateway() {
  const { user } = useCurrentUser();
  const [ativo, setAtivo] = useState(false);
  const [gatewayA, setGatewayA] = useState("asaas");
  const [gatewayB, setGatewayB] = useState("v3pay");
  const [intervalo, setIntervalo] = useState(5);
  const [contadorAtual, setContadorAtual] = useState(0);
  const [gatewayAtual, setGatewayAtual] = useState("a");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    document.title = "Rotação de Gateways | Gestor MSX";
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadConfig();
  }, [user?.id]);

  const loadConfig = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("gateway_rotation_config" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setAtivo(d.ativo);
      setGatewayA(d.gateway_a);
      setGatewayB(d.gateway_b);
      setIntervalo(d.intervalo);
      setContadorAtual(d.contador_atual);
      setGatewayAtual(d.gateway_atual);
    }
    setInitialLoading(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (gatewayA === gatewayB) {
      toast.error("Os dois gateways devem ser diferentes.");
      return;
    }
    if (intervalo < 10 || intervalo > 100) {
      toast.error("O intervalo deve ser entre 10 e 100 faturas.");
      return;
    }

    setLoading(true);
    try {
      const configData = {
        user_id: user.id,
        ativo,
        gateway_a: gatewayA,
        gateway_b: gatewayB,
        intervalo,
        contador_atual: contadorAtual,
        gateway_atual: gatewayAtual,
      };

      const { error } = await supabase
        .from("gateway_rotation_config" as any)
        .upsert(configData as any, { onConflict: "user_id", ignoreDuplicates: false });

      if (error) throw error;
      toast.success("Configuração de rotação salva com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao salvar configuração.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetCounter = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("gateway_rotation_config" as any)
        .update({ contador_atual: 0, gateway_atual: "a" } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      setContadorAtual(0);
      setGatewayAtual("a");
      toast.success("Contador resetado!");
    } catch {
      toast.error("Erro ao resetar contador.");
    } finally {
      setLoading(false);
    }
  };

  const gatewayAtivoLabel = gatewayAtual === "a"
    ? GATEWAY_OPTIONS.find(g => g.id === gatewayA)?.label || gatewayA
    : GATEWAY_OPTIONS.find(g => g.id === gatewayB)?.label || gatewayB;

  if (initialLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Rotação de Gateways">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Rotação de Gateways</h1>
          </div>
          <p className="text-xs/6 opacity-90">Alterne automaticamente entre 2 gateways a cada X faturas geradas.</p>
        </div>
      </header>

      <main className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Configuração da Rotação</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{ativo ? "Ativo" : "Desativado"}</span>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
            <CardDescription>
              Quando ativo, o sistema alternará entre os dois gateways configurados ao gerar faturas, ignorando o gateway padrão do checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Gateway A */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Gateway A (primário)</Label>
                <Select value={gatewayA} onValueChange={setGatewayA} disabled={!ativo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_OPTIONS.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gateway B */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Gateway B (secundário)</Label>
                <Select value={gatewayB} onValueChange={setGatewayB} disabled={!ativo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_OPTIONS.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {gatewayA === gatewayB && ativo && (
              <p className="text-xs text-destructive">⚠️ Os gateways A e B devem ser diferentes.</p>
            )}

            {/* Intervalo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Alternar a cada quantas faturas?</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={100}
                  value={intervalo}
                  onChange={(e) => setIntervalo(Math.max(10, Math.min(100, parseInt(e.target.value) || 10)))}
                  className="w-24"
                  disabled={!ativo}
                />
                <span className="text-xs text-muted-foreground">faturas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemplo: se definir 10, a cada 10 faturas o sistema troca do Gateway A para o B e vice-versa.
              </p>
            </div>

            {/* Status */}
            {ativo && (
              <div className="rounded-md border px-3 py-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Status atual</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleResetCounter} disabled={loading}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Resetar
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-[11px]">
                    Usando: {gatewayAtivoLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {contadorAtual} / {intervalo} faturas (próxima troca em {Math.max(0, intervalo - contadorAtual)})
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-center border-t pt-4 mt-2">
              <Button onClick={handleSave} disabled={loading || (ativo && gatewayA === gatewayB)}>
                {loading ? "Salvando..." : "Salvar Configuração"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
