import { useEffect, useState } from "react";
import { useMensagensPadroes } from "@/hooks/useDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function MensagensPadroes() {
  const [loading, setLoading] = useState(false);
  const [confirmacaoCliente, setConfirmacaoCliente] = useState("");
  const [expiracaoApp, setExpiracaoApp] = useState("");
  const [aniversarioCliente, setAniversarioCliente] = useState("");
  
  const { salvar, buscar } = useMensagensPadroes();

  useEffect(() => {
    document.title = "Gerenciador de Mensagens Padrão | Gestor Tech Play";
    const d = document.querySelector('meta[name="description"]') || document.createElement('meta');
    d.setAttribute('name', 'description');
    d.setAttribute('content', 'Gerenciador de mensagens padrão para diferentes situações.');
    if (!d.parentElement) document.head.appendChild(d);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
    
    // Carregar dados existentes
    const carregarDados = async () => {
      const dados = await buscar();
      if (dados) {
        setConfirmacaoCliente(dados.confirmacao_cliente || "");
        setExpiracaoApp(dados.expiracao_app || "");
        setAniversarioCliente(dados.aniversario_cliente || "");
      }
    };
    
    carregarDados();
  }, []);

  const handleSalvar = async () => {
    setLoading(true);
    try {
      await salvar({
        confirmacao_cliente: confirmacaoCliente,
        expiracao_app: expiracaoApp,
        aniversario_cliente: aniversarioCliente
      });
    } catch (error) {
      console.error("Erro ao salvar mensagens:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        Gerenciador de Mensagens Padrão
      </h1>
      
      {/* Seção 1: Confirmação de Pagamento - Cliente */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            1. Confirmação de Pagamento - Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mensagem-cliente" className="text-sm font-medium text-foreground">
              Mensagem para Cliente
            </Label>
            <Textarea
              id="mensagem-cliente"
              value={confirmacaoCliente}
              onChange={(e) => setConfirmacaoCliente(e.target.value)}
              className="h-[120px] overflow-y-auto resize-none bg-background border-border text-foreground"
              placeholder="Digite a mensagem de confirmação de pagamento..."
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Mídia para Cliente</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground border-primary">
                Escolher ficheiro
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Nenhum ficheiro selecionado
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Expiração - App */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            3. Expiração - App
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mensagem-app" className="text-sm font-medium text-foreground">
              Mensagem para App
            </Label>
            <Textarea
              id="mensagem-app"
              value={expiracaoApp}
              onChange={(e) => setExpiracaoApp(e.target.value)}
              className="h-[120px] overflow-y-auto resize-none bg-background border-border text-foreground"
              placeholder="Digite a mensagem de expiração para o app..."
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Mídia para App</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground border-primary">
                Escolher ficheiro
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Nenhum ficheiro selecionado
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4: Aniversário - Cliente */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            4. Aniversário - Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mensagem-aniversario" className="text-sm font-medium text-foreground">
              Mensagem para Aniversário Cliente
            </Label>
            <Textarea
              id="mensagem-aniversario"
              value={aniversarioCliente}
              onChange={(e) => setAniversarioCliente(e.target.value)}
              className="h-[120px] overflow-y-auto resize-none bg-background border-border text-foreground"
              placeholder="Digite a mensagem de aniversário..."
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Mídia para Aniversário Cliente</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground border-primary">
                Escolher ficheiro
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Nenhum ficheiro selecionado
              </span>
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              onClick={handleSalvar}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
