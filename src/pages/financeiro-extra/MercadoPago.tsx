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
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { SUPABASE_URL } from "@/lib/constants";
import { useMercadoPago } from "@/hooks/useMercadoPago";

export default function MercadoPago() {
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const { isConfigured, loading, checking, configure, disconnect } = useMercadoPago();

  const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-integration`;

  useEffect(() => {
    document.title = "Mercado Pago - Gateway de Pagamentos | Gestor Tech Play";
  }, []);

  const handleConfigure = async () => {
    setErrorDetails(null);
    try {
      await configure(accessToken, publicKey);
      setAccessToken("");
      setPublicKey("");
    } catch (e: any) {
      setErrorDetails(e?.message || "Erro desconhecido");
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração do Mercado Pago">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do Mercado Pago</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure seu gateway de pagamentos Mercado Pago para receber pagamentos dos seus clientes.</p>
        </div>
      </header>

      <main className="space-y-4">
        {/* Status + Webhook */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Webhook URL</CardTitle>
              </div>
              <CardDescription>
                Copie esta URL e adicione no painel do Mercado Pago em: Sua Aplicação → Webhooks → Notificações IPN.
                Selecione os tópicos <strong>payment.created</strong> e <strong>payment.updated</strong>.
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
                <CardTitle className="text-sm">Status & Documentação</CardTitle>
              </div>
              <CardDescription>
                Acesse o painel Mercado Pago → Seu Negócio → Configurações → Credenciais para obter suas chaves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Status Gateway</span>
                <div className="flex items-center gap-2">
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Switch checked={isConfigured} disabled />
                      <Badge variant={isConfigured ? "default" : "destructive"}>
                        {isConfigured ? "Ativado" : "Desativado"}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open("https://www.mercadopago.com.br/developers/panel/app", "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir Painel do Mercado Pago
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Configured success state */}
        {isConfigured && (
          <Card className="shadow-sm border-green-200 dark:border-green-900">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">Mercado Pago configurado e ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Cobranças PIX serão geradas automaticamente quando este gateway estiver selecionado no Checkout.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="text-destructive hover:text-destructive"
                >
                  <Unplug className="h-3 w-3 mr-1" />
                  Desconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credentials form */}
        <section>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">
                  {isConfigured ? "Atualizar Credenciais" : "Credenciais de Produção"}
                </CardTitle>
              </div>
              <CardDescription>
                Cole as credenciais de produção do Mercado Pago. Encontre em: Sua Aplicação → Credenciais de produção.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    Public Key <span className="text-xs text-muted-foreground">(opcional)</span>
                  </label>
                  <Input
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="APP_USR-00000000-0000-0000-0000-000000000000"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Access Token <span className="text-xs text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    O token é armazenado de forma segura no Vault e nunca exposto no código.
                  </p>
                </div>
                {errorDetails && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{errorDetails}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center border-t pt-4 mt-4">
                <Button onClick={handleConfigure} disabled={loading || !accessToken.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Verificando...
                    </>
                  ) : isConfigured ? "Atualizar Credenciais" : "Ativar Mercado Pago"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
