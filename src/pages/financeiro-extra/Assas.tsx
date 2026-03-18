import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Key, 
  Copy,
  Webhook,
  ExternalLink,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useAssas } from "@/hooks/useAssas";

export default function Assas() {
  const [apiKey, setApiKey] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const {
    isConfigured,
    loading,
    configureAsaas,
  } = useAssas();

  const webhookUrl = `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/asaas-integration`;

  useEffect(() => {
    document.title = "Asaas - Gateway de Pagamentos | Gestor Tech Play";
  }, []);

  const handleConfigureAsaas = async () => {
    if (!apiKey.trim()) {
      toast.error("Por favor, insira o Token do Asaas");
      return;
    }

    const formatAsaasError = (raw: any) => {
      const msg = typeof raw === 'string' ? raw : raw?.message || JSON.stringify(raw);
      if (/Failed to fetch|NetworkError/i.test(msg)) return "Falha de rede ao acessar a função. Verifique sua conexão.";
      if (/Invalid token|Authorization required|401/i.test(msg)) return "Sessão expirada. Faça login novamente.";
      if (/API Key inválida/i.test(msg)) return "Token do Asaas inválido ou sem permissão.";
      return msg;
    };

    setErrorDetails(null);
    const delays = [0, 700, 1500];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        await configureAsaas(apiKey, webhookUrl);
        return;
      } catch (e: any) {
        if (i === delays.length - 1) {
          const friendly = formatAsaasError(e);
          setErrorDetails(friendly);
        }
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração do Asaas">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do Asaas</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure seu gateway de pagamentos Asaas para receber pagamentos dos seus clientes.</p>
        </div>
      </header>

      <main className="space-y-4">
        {/* WEBHOOK - em cima */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Webhook URL</CardTitle>
              </div>
              <CardDescription>
                Copie esta URL e adicione no painel do Asaas em: Configurações → Integrações → Webhooks.
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
                Acesse o painel Asaas → Configurações → Integrações → API para obter sua chave.
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
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => window.open("https://www.asaas.com/config/index", "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir Configurações do Asaas
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* TOKEN - embaixo */}
        <section>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Token API Asaas</CardTitle>
              </div>
              <CardDescription>
                Cole o token da API do Asaas abaixo para ativar a integração com o gateway de pagamentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmZjY..."
                  className="font-mono text-sm"
                />
                {errorDetails && (
                  <p className="text-sm text-destructive">{errorDetails}</p>
                )}
              </div>
              <div className="flex justify-center border-t pt-4 mt-2">
                <Button onClick={handleConfigureAsaas} disabled={loading}>
                  {loading ? "Verificando..." : "Ativar Asaas"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
