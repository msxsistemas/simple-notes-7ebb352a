import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Key, Copy, ExternalLink, Settings, Webhook } from "lucide-react";
import { toast } from "sonner";
import { useWoovi } from "@/hooks/useWoovi";

export default function Woovi() {
  const [appId, setAppId] = useState("");
  const { isConfigured, loading, configureWoovi } = useWoovi();

  const webhookUrl = `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/woovi-integration`;

  useEffect(() => {
    document.title = "Woovi - Gateway de Pagamentos | Gestor MSX";
  }, []);

  const handleConfigure = async () => {
    if (!appId.trim()) {
      toast.error("Por favor, insira o App ID da Woovi");
      return;
    }
    try {
      await configureWoovi(appId);
      setAppId("");
    } catch {
      // error already toasted in hook
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração da Woovi">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração da Woovi</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure seu gateway de pagamentos Woovi (PIX) para receber pagamentos dos seus clientes.</p>
        </div>
      </header>

      <main className="space-y-4">
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Webhook URL</CardTitle>
              </div>
              <CardDescription>
                Copie esta URL e adicione no painel da Woovi em: Configurações → Webhooks.
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

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Documentação</CardTitle>
              </div>
              <CardDescription>
                Acesse o painel Woovi → API/Plugins → Copie o App ID da sua conta.
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
                onClick={() => window.open("https://app.woovi.com/home/applications", "_blank")}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir Painel da Woovi
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">App ID Woovi</CardTitle>
              </div>
              <CardDescription>
                Cole o App ID da sua conta Woovi abaixo para ativar a integração com o gateway de pagamentos PIX.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="6342d06d6241c400130e4267..."
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-center border-t pt-4 mt-2">
                <Button onClick={handleConfigure} disabled={loading}>
                  {loading ? "Verificando..." : "Ativar Woovi"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
