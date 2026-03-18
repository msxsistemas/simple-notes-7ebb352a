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
import { supabase } from "@/integrations/supabase/client";

export default function Ciabra() {
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const webhookUrl = `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/ciabra-integration`;

  useEffect(() => {
    document.title = "Ciabra - Gateway de Pagamentos | Gestor Tech Play";
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await (supabase as any)
        .from('ciabra_config')
        .select('*')
        .eq('is_configured', true)
        .maybeSingle();
      if (data) setIsConfigured(true);
    } catch (e) {
      console.error('Erro ao carregar config Ciabra:', e);
    }
  };

  const handleConfigure = async () => {
    if (!publicKey.trim() || !secretKey.trim()) {
      toast.error("Por favor, insira a Chave Pública e a Chave Secreta do Ciabra");
      return;
    }

    setErrorDetails(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ciabra-integration', {
        body: { action: 'configure', apiKey: secretKey, publicKey, webhookUrl }
      });

      if (error) throw error;
      if (data?.success) {
        setIsConfigured(true);
        toast.success('Ciabra configurado com sucesso!');
      } else {
        throw new Error(data?.error || 'Erro ao configurar Ciabra');
      }
    } catch (e: any) {
      const msg = e?.message || 'Erro desconhecido';
      setErrorDetails(msg);
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Configuração do Ciabra">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Configuração do Ciabra</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure seu gateway de pagamentos Ciabra Invoice para receber pagamentos dos seus clientes.</p>
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
                Copie esta URL e adicione na plataforma Ciabra em: Integração → Webhooks.
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
                Acesse a plataforma Ciabra → Integração → API Keys para obter sua chave de API.
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
                onClick={() => window.open("https://plataforma.ciabra.com.br", "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir Plataforma Ciabra
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Chaves de API Ciabra</CardTitle>
              </div>
              <CardDescription>
                Acesse a plataforma Ciabra → Integração → Chave da API para obter sua Chave Pública e Chave Secreta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Chave Pública</label>
                    <Input
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder="pk_live_..."
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Chave Secreta</label>
                    <Input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="sk_live_..."
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                {errorDetails && (
                  <p className="text-sm text-destructive">{errorDetails}</p>
                )}
              </div>
              <div className="flex justify-center border-t pt-4 mt-2">
                <Button onClick={handleConfigure} disabled={loading}>
                  {loading ? "Verificando..." : "Ativar Ciabra"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}