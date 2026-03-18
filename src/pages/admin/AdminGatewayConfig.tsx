import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Webhook, ExternalLink, Settings } from "lucide-react";
import { toast as sonnerToast } from "sonner";

const provedorLabels: Record<string, string> = {
  asaas: "Asaas",
  mercadopago: "Mercado Pago",
  v3pay: "V3Pay",
  ciabra: "Ciabra",
  woovi: "Woovi",
};

const provedorDescriptions: Record<string, string> = {
  asaas: "Configure o gateway Asaas para processar pagamentos de assinaturas.",
  mercadopago: "Configure o gateway Mercado Pago para processar pagamentos de assinaturas.",
  v3pay: "Configure o gateway V3Pay para processar pagamentos PIX, cartão e boleto.",
  ciabra: "Configure o gateway Ciabra Invoice para processar pagamentos de assinaturas.",
  woovi: "Configure o gateway Woovi para processar pagamentos PIX de assinaturas.",
};

const provedorWebhookDescriptions: Record<string, string> = {
  asaas: "Copie esta URL e adicione no painel do Asaas em: Configurações → Integrações → Webhooks.",
  mercadopago: "Copie esta URL e adicione no painel do Mercado Pago em: Sua Aplicação → Webhooks → Notificações IPN.",
  v3pay: "Copie esta URL e adicione no painel V3Pay para receber notificações de pagamento.",
  ciabra: "Copie esta URL e adicione na plataforma Ciabra em: Integração → Webhooks.",
  woovi: "Copie esta URL e adicione no painel Woovi em: API/Plugins → Webhooks para receber notificações de pagamento.",
};

const provedorDocsDescriptions: Record<string, string> = {
  asaas: "Acesse o painel Asaas → Configurações → Integrações → API para obter sua chave.",
  mercadopago: "Acesse o painel Mercado Pago → Seu Negócio → Configurações → Credenciais para obter seu Access Token.",
  v3pay: "Acesse o painel V3Pay para obter seu token de API.",
  ciabra: "Acesse a plataforma Ciabra → Integração → API Keys para obter sua chave de API.",
  woovi: "Acesse o painel Woovi → API/Plugins → Aplicações → App ID para obter seu AppID.",
};

const provedorDocsUrls: Record<string, string> = {
  asaas: "https://www.asaas.com/config/index",
  mercadopago: "https://www.mercadopago.com.br/developers/panel/app",
  v3pay: "https://app.v3pay.com.br",
  ciabra: "https://plataforma.ciabra.com.br",
  woovi: "https://app.woovi.com/home/applications/add",
};

const provedorDocsButtonLabels: Record<string, string> = {
  asaas: "Abrir Configurações do Asaas",
  mercadopago: "Abrir Painel do Mercado Pago",
  v3pay: "Abrir Painel V3Pay",
  ciabra: "Abrir Plataforma Ciabra",
  woovi: "Abrir Painel Woovi",
};

const provedorTokenLabels: Record<string, string> = {
  asaas: "Token API Asaas",
  mercadopago: "Access Token Mercado Pago",
  v3pay: "Token API V3Pay",
  ciabra: "Chaves de API Ciabra",
  woovi: "App ID Woovi",
};

const provedorTokenDescriptions: Record<string, string> = {
  asaas: "Cole o token da API do Asaas abaixo para ativar a integração com o gateway de pagamentos.",
  mercadopago: "Cole o Access Token de produção do Mercado Pago abaixo para ativar a integração.",
  v3pay: "Cole o token da API do V3Pay abaixo para ativar a integração.",
  ciabra: "Acesse a plataforma Ciabra → Integração → Chave da API para obter sua Chave Pública e Chave Secreta.",
  woovi: "Cole o App ID da Woovi abaixo. Acesse o painel Woovi → API/Plugins → Aplicações → App ID.",
};

const provedorTokenPlaceholders: Record<string, string> = {
  asaas: "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmZjY...",
  mercadopago: "APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000",
  v3pay: "Seu token Bearer da API V3Pay...",
  ciabra: "sk_live_...",
  woovi: "Q2xpZW50X0lkOjZjYzc...",
};

const SUPABASE_PROJECT_ID = "dxxfablfqigoewcfmjzl";

const provedorWebhookEndpoints: Record<string, string> = {
  asaas: "asaas-integration",
  mercadopago: "mercadopago-integration",
  v3pay: "v3pay-integration",
  ciabra: "ciabra-integration",
  woovi: "woovi-integration",
};

interface GatewayData {
  id: string;
  nome: string;
  provedor: string;
  ativo: boolean;
  ambiente: string;
  api_key_hash: string | null;
  public_key_hash: string | null;
  webhook_url: string | null;
}

export default function AdminGatewayConfig() {
  const { provider } = useParams<{ provider: string }>();
  const [gateway, setGateway] = useState<GatewayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const label = provedorLabels[provider || ""] || provider || "";
  const isCiabra = provider === "ciabra";

  const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${provedorWebhookEndpoints[provider || ""] || provider}`;

  useEffect(() => {
    document.title = `${label} | Admin Gateways`;
    const fetch_ = async () => {
      const { data } = await supabase
        .from("system_gateways")
        .select("*")
        .eq("provedor", provider)
        .maybeSingle();
      if (data) {
        setGateway(data as GatewayData);
      } else {
        const { data: created } = await supabase
          .from("system_gateways")
          .insert({ nome: label, provedor: provider!, ativo: false, ambiente: "sandbox" })
          .select()
          .single();
        if (created) setGateway(created as GatewayData);
      }
      setLoading(false);
    };
    fetch_();
  }, [provider]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateway) return;

    setSaving(true);
    try {
      // Desativar todos os outros gateways primeiro
      await supabase
        .from("system_gateways")
        .update({ ativo: false })
        .neq("provedor", provider!);

      const updatePayload = {
        nome: gateway.nome,
        provedor: gateway.provedor,
        ativo: true,
        ambiente: gateway.ambiente,
        api_key_hash: gateway.api_key_hash,
        public_key_hash: gateway.public_key_hash,
        webhook_url: webhookUrl,
      };

      if (gateway.id) {
        const { error } = await supabase
          .from("system_gateways")
          .update(updatePayload)
          .eq("id", gateway.id);

        if (error) {
          console.error("Erro ao salvar gateway:", error);
          toast({ title: "Erro ao salvar credenciais", description: error.message, variant: "destructive" });
          return;
        }

        // Recarregar dados do banco para confirmar persistência
        const { data: refreshed } = await supabase
          .from("system_gateways")
          .select("*")
          .eq("id", gateway.id)
          .single();

        if (refreshed) {
          // Limpar credenciais da tela por privacidade
          setGateway({
            ...(refreshed as GatewayData),
            api_key_hash: "",
            public_key_hash: "",
          });
        }
      } else {
        const { data, error } = await supabase
          .from("system_gateways")
          .insert({ ...updatePayload, provedor: provider! })
          .select()
          .single();

        if (error) {
          console.error("Erro ao criar gateway:", error);
          toast({ title: "Erro ao criar gateway", description: error.message, variant: "destructive" });
          return;
        }
        if (data) setGateway(data as GatewayData);
      }

      toast({ title: `${label} ativado com sucesso!` });
    } catch (err: any) {
      console.error("Erro inesperado:", err);
      toast({ title: "Erro ao ativar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, copyLabel: string) => {
    navigator.clipboard.writeText(text);
    sonnerToast.success(`${copyLabel} copiado!`);
  };

  const set = (key: keyof GatewayData, value: any) =>
    setGateway((g) => (g ? { ...g, [key]: value } : g));

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label={`Configuração do ${label}`}>
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do {label}</h1>
          </div>
          <p className="text-xs/6 opacity-90">{provedorDescriptions[provider || ""] || `Configure o gateway ${label} para processar pagamentos.`}</p>
        </div>
      </header>

      {!gateway ? (
        <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>
      ) : (
        <main className="space-y-4">
          {/* Top row: Webhook + Docs */}
          <section className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-foreground/70" />
                  <CardTitle className="text-sm">Webhook URL</CardTitle>
                </div>
                <CardDescription>
                  {provedorWebhookDescriptions[provider || ""] || "URL para receber notificações de pagamento."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="font-mono text-xs bg-muted/50"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, "URL do Webhook")}
                    className="shrink-0"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-foreground/70" />
                  <CardTitle className="text-sm">Documentação</CardTitle>
                </div>
                <CardDescription>
                  {provedorDocsDescriptions[provider || ""] || "Acesse o painel do provedor para obter suas credenciais."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Status Gateway</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={gateway.ativo} disabled />
                    <Badge variant={gateway.ativo ? "default" : "destructive"}>
                      {gateway.ativo ? "Ativado" : "Desativado"}
                    </Badge>
                  </div>
                </div>
                {provedorDocsUrls[provider || ""] && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => window.open(provedorDocsUrls[provider || ""], "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {provedorDocsButtonLabels[provider || ""] || `Abrir Painel ${label}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Bottom: Credentials */}
          <section>
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-foreground/70" />
                  <CardTitle className="text-sm">{provedorTokenLabels[provider || ""] || "Credenciais"}</CardTitle>
                </div>
                <CardDescription>
                  {provedorTokenDescriptions[provider || ""] || `Chaves de API e configurações de autenticação do ${label}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleActivate} className="space-y-3">
                  {isCiabra ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Chave Pública</label>
                    <Input
                          required
                          type="password"
                          value={gateway.public_key_hash || ""}
                          onChange={(e) => set("public_key_hash", e.target.value)}
                          placeholder="pk_live_..."
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Chave Secreta</label>
                        <Input
                          required
                          type="password"
                          value={gateway.api_key_hash || ""}
                          onChange={(e) => set("api_key_hash", e.target.value)}
                          placeholder="sk_live_..."
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <Input
                      required
                      type="password"
                      value={gateway.api_key_hash || ""}
                      onChange={(e) => set("api_key_hash", e.target.value)}
                      placeholder={provedorTokenPlaceholders[provider || ""] || "Cole a chave da API aqui"}
                      className="font-mono text-sm"
                    />
                  )}
                  <div className="flex justify-center border-t pt-4 mt-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Verificando..." : `Ativar ${label}`}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>
        </main>
      )}
    </div>
  );
}