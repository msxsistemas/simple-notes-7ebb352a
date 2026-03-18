import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useConfiguracoes } from "@/hooks/useDatabase";
import { toast } from "sonner";

export default function AtivarCobrancas() {
  const [ativo, setAtivo] = useState(false);
  const [initialValue, setInitialValue] = useState(false);
  const [loading, setLoading] = useState(false);
  const { buscar, salvarCobrancasStatus } = useConfiguracoes();

  useEffect(() => {
    document.title = "Ativar Cobranças | Gestor Tech Play";

    (async () => {
      const cfg = await buscar();
      if (cfg && typeof cfg.cobrancas_ativas === 'boolean') {
        setAtivo(cfg.cobrancas_ativas);
        setInitialValue(cfg.cobrancas_ativas);
      }
    })();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await salvarCobrancasStatus(ativo);
      setInitialValue(ativo);
      toast.success("Configuração salva com sucesso!");
    } catch (e) {
      setAtivo(initialValue);
      toast.error("Não foi possível atualizar o status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="Ativar Cobranças">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">Ativar Cobranças</h1>
          </div>
          <p className="text-xs/6 opacity-90">Ative ou desative o sistema de cobranças automáticas para seus clientes.</p>
        </div>
      </header>

      <main className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Status do Sistema</CardTitle>
              <Badge variant={ativo ? "default" : "destructive"} className="font-semibold">
                {ativo ? "Ativo" : "Desativado"}
              </Badge>
            </div>
            <CardDescription>Controle se o sistema de cobranças está ativo para seus clientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Habilitar Cobranças</span>
              <Switch
                id="ativar"
                checked={ativo}
                onCheckedChange={setAtivo}
              />
            </div>
            <div className="flex justify-center border-t pt-4 mt-4">
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
