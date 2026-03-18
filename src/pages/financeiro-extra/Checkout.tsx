import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, QrCode, Settings, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssas } from "@/hooks/useAssas";
import { useV3Pay } from "@/hooks/useV3Pay";
import { useV3PayPJ } from "@/hooks/useV3PayPJ";
import { useWoovi } from "@/hooks/useWoovi";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface GatewayInfo {
  id: string;
  label: string;
  configured: boolean;
}

export default function Checkout() {
  const { toast } = useToast();
  const { isConfigured: asaasConfigured } = useAssas();
  const { isConfigured: v3payConfigured } = useV3Pay();
  const { isConfigured: v3payPjConfigured } = useV3PayPJ();
  const { isConfigured: wooviConfigured } = useWoovi();
  const { isConfigured: mercadoPagoConfigured } = useMercadoPago();
  const { user } = useCurrentUser();
  const [pixEnabled, setPixEnabled] = useState(false);
  const [creditCardEnabled, setCreditCardEnabled] = useState(false);
  const [pixManualEnabled, setPixManualEnabled] = useState(false);
  const [pixManualKey, setPixManualKey] = useState("");
  const [gatewayAtivo, setGatewayAtivo] = useState("asaas");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [ciabraConfigured, setCiabraConfigured] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadAllConfigs();
  }, [user?.id]);

  const loadAllConfigs = async () => {
    if (!user?.id) return;
    const [checkoutResult, ciabra] = await Promise.all([
      supabase.from('checkout_config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('ciabra_config').select('is_configured').eq('user_id', user.id).maybeSingle(),
    ]);

    setCiabraConfigured(!!(ciabra.data as any)?.is_configured);

    if (checkoutResult.data) {
      const data = checkoutResult.data;
      setPixEnabled(data.pix_enabled);
      setCreditCardEnabled(data.credit_card_enabled);
      setPixManualEnabled(data.pix_manual_enabled);
      setPixManualKey(data.pix_manual_key || "");
      setGatewayAtivo((data as any).gateway_ativo || "asaas");
    }
    setInitialLoading(false);
  };

  useEffect(() => {
    document.title = "Checkout – Pagamentos | Gestor IPTV";
  }, []);

  const gateways: GatewayInfo[] = [
    { id: "asaas", label: "Asaas", configured: asaasConfigured },
    { id: "mercadopago", label: "Mercado Pago", configured: mercadoPagoConfigured },
    { id: "ciabra", label: "Ciabra", configured: ciabraConfigured },
    { id: "v3pay", label: "V3Pay PF", configured: v3payConfigured },
    { id: "v3pay_pj", label: "V3Pay PJ", configured: v3payPjConfigured },
    { id: "woovi", label: "Woovi", configured: wooviConfigured },
  ];

  const configuredGateways = gateways.filter(g => g.configured);

  const handleSave = async () => {
    if (!user?.id) {
      toast({ title: "Erro", description: "Você precisa estar logado para salvar as configurações.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const configData = {
        user_id: user.id,
        pix_enabled: pixEnabled && configuredGateways.length > 0,
        credit_card_enabled: creditCardEnabled,
        pix_manual_enabled: pixManualEnabled,
        pix_manual_key: pixManualEnabled ? pixManualKey.trim() || null : null,
        gateway_ativo: gatewayAtivo,
      };

      const { error } = await supabase
        .from('checkout_config')
        .upsert(configData as any, { onConflict: 'user_id', ignoreDuplicates: false });

      if (error) {
        console.error('Erro ao salvar:', error);
        toast({ title: "Erro", description: "Erro ao salvar configurações. Tente novamente.", variant: "destructive" });
        return;
      }

      toast({ title: "Configurações salvas", description: "As preferências do checkout foram atualizadas com sucesso." });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({ title: "Erro", description: "Erro ao salvar configurações. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração do Checkout">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do Checkout</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure os métodos de pagamento disponíveis para seus clientes.</p>
        </div>
      </header>

      <main className="space-y-4">
        {/* Gateway + Métodos de Pagamento */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Gateway e Métodos de Pagamento</CardTitle>
            </div>
            <CardDescription>
              Selecione o gateway ativo e habilite os métodos de pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gateway Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Gateway Ativo</label>
              {configuredGateways.length === 0 ? (
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Nenhum gateway configurado.{" "}
                    <a href="/configuracoes/asaas" className="text-primary underline">Asaas</a>{" · "}
                    <a href="/configuracoes/mercado-pago" className="text-primary underline">Mercado Pago</a>{" · "}
                    <a href="/configuracoes/ciabra" className="text-primary underline">Ciabra</a>{" · "}
                    <a href="/configuracoes/v3pay" className="text-primary underline">V3Pay PF</a>{" · "}
                    <a href="/configuracoes/v3pay-pj" className="text-primary underline">V3Pay PJ</a>{" · "}
                    <a href="/configuracoes/woovi" className="text-primary underline">Woovi</a>
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Select value={gatewayAtivo} onValueChange={setGatewayAtivo}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredGateways.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    {gateways.map((g) => (
                      <Badge
                        key={g.id}
                        variant={g.configured ? (g.id === gatewayAtivo ? "default" : "secondary") : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {g.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="grid gap-2">
              <div className="rounded-md border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">PIX Automático</span>
                </div>
                <Switch
                  checked={pixEnabled}
                  onCheckedChange={setPixEnabled}
                  id="pix-toggle"
                  disabled={configuredGateways.length === 0}
                />
              </div>

              <div className="rounded-md border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Cartão de Crédito</span>
                </div>
                <Switch
                  checked={creditCardEnabled}
                  onCheckedChange={setCreditCardEnabled}
                  id="credit-card-toggle"
                />
              </div>
            </div>

            {pixEnabled && configuredGateways.length > 0 && (
              <p className="text-xs text-muted-foreground">
                ✅ PIX ativo via <strong>{gateways.find(g => g.id === gatewayAtivo)?.label}</strong>
              </p>
            )}
            <div className="flex justify-center border-t pt-4 mt-2">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
