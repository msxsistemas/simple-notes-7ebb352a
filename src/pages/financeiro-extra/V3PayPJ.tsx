import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Key, Copy, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { useV3PayPJ } from "@/hooks/useV3PayPJ";

export default function V3PayPJ() {
  const [apiToken, setApiToken] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const { isConfigured, loading, configureV3PayPJ } = useV3PayPJ();

  useEffect(() => {
    document.title = "V3Pay PJ - Gateway de Pagamentos | Gestor IPTV";
  }, []);

  const handleConfigure = async () => {
    if (!apiToken.trim()) {
      toast.error("Por favor, insira o Token da API V3Pay PJ");
      return;
    }
    setErrorDetails(null);
    try {
      await configureV3PayPJ(apiToken);
    } catch (e: any) {
      setErrorDetails(e.message || "Erro ao configurar");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const webhookUrl = `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/v3pay-pj-integration`;

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração do V3Pay PJ">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do V3Pay PJ</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure seu gateway V3Pay (Pessoa Jurídica) para receber pagamentos PIX, cartão e boleto.</p>
        </div>
      </header>

      <main className="space-y-4">
        <section className="grid gap-4 md:grid-cols-2">
          {/* Webhook */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Webhook URL</CardTitle>
              </div>
              <CardDescription>
                Copie esta URL e adicione no painel V3Pay para receber notificações de pagamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/50" />
                <Button variant="default" size="sm" onClick={() => copyToClipboard(webhookUrl, "URL do Webhook")} className="shrink-0">
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status + Docs */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Documentação</CardTitle>
              </div>
              <CardDescription>
                Acesse o painel V3Pay para obter seu token de API (conta PJ).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Status Gateway</span>
                <div className="flex items-center gap-2">
                  <Switch checked={isConfigured} disabled />
                  <Badge variant={isConfigured ? "default" : "destructive"}>
                    {isConfigured ? "Ativado" : "Desativado"}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full"
                onClick={() => window.open("https://app.v3pay.com.br", "_blank")}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir Painel V3Pay
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Token Input */}
        <section>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Token API V3Pay PJ</CardTitle>
              </div>
              <CardDescription>
                Cole o token da API do V3Pay (conta Pessoa Jurídica) abaixo para ativar a integração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Seu token Bearer da API V3Pay PJ..."
                  className="font-mono text-sm"
                />
                {errorDetails && <p className="text-sm text-destructive">{errorDetails}</p>}
              </div>
              <div className="flex justify-center border-t pt-4 mt-2">
                <Button onClick={handleConfigure} disabled={loading}>
                  {loading ? "Verificando..." : "Ativar V3Pay PJ"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
