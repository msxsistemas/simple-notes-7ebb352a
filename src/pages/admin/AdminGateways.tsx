import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Settings, Building2, QrCode, CreditCard } from "lucide-react";

interface SystemGateway {
  id: string;
  nome: string;
  provedor: string;
  ativo: boolean;
  ambiente: string;
  webhook_url: string | null;
}

const provedorLabels: Record<string, string> = {
  asaas: "Asaas",
  mercadopago: "Mercado Pago",
  v3pay: "V3Pay",
  ciabra: "Ciabra",
  woovi: "Woovi",
};

const allGateways = ["asaas", "mercadopago", "v3pay", "ciabra", "woovi"];

export default function AdminGateways() {
  const [gateways, setGateways] = useState<SystemGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [gatewayAtivo, setGatewayAtivo] = useState("");
  const [pixEnabled, setPixEnabled] = useState(true);
  const [creditCardEnabled, setCreditCardEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data } = await supabase.from("system_gateways").select("*").order("created_at");
    if (data) {
      setGateways(data as SystemGateway[]);
      const active = data.find((g: any) => g.ativo);
      if (active) setGatewayAtivo(active.provedor);
    }
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Gateways | Admin Gestor Msx";
    fetch_();
  }, []);

  const gatewayList = allGateways.map(id => ({
    id,
    label: provedorLabels[id],
    configured: gateways.some(g => g.provedor === id),
  }));

  const configuredList = gatewayList.filter(g => g.configured);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const g of gateways) {
        await supabase.from("system_gateways").update({ ativo: g.provedor === gatewayAtivo }).eq("id", g.id);
      }
      toast({ title: "Configurações salvas!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
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
          <p className="text-xs/6 opacity-90">Configure os métodos de pagamento disponíveis para cobranças de planos.</p>
        </div>
      </header>

      <main className="space-y-4">
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
              {configuredList.length === 0 ? (
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Nenhum gateway configurado. Use o submenu para configurar:{" "}
                    {allGateways.map((id, i) => (
                      <span key={id}>
                        <a href={`/admin/gateways/${id}`} className="text-primary underline">{provedorLabels[id]}</a>
                        {i < allGateways.length - 1 && " · "}
                      </span>
                    ))}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Select value={gatewayAtivo} onValueChange={setGatewayAtivo}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredList.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    {gatewayList.map((g) => (
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
                  disabled={configuredList.length === 0}
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
                />
              </div>

            </div>

            {pixEnabled && configuredList.length > 0 && (
              <p className="text-xs text-muted-foreground">
                ✅ PIX ativo via <strong>{provedorLabels[gatewayAtivo]}</strong>
              </p>
            )}

            <div className="flex justify-center border-t pt-4 mt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
