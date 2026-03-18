import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Settings, DollarSign, Share2 } from "lucide-react";

interface IndicacoesConfig {
  ativo: boolean;
  valor_bonus: number;
  tipo_bonus: string;
  descricao: string | null;
}

export default function AdminIndicacoesConfig() {
  const [config, setConfig] = useState<IndicacoesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Configurações Indicações | Admin";
    const fetchConfig = async () => {
      const { data } = await supabase.from("system_indicacoes_config").select("*").eq("id", 1).single();
      if (data) setConfig(data as IndicacoesConfig);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await supabase.from("system_indicacoes_config").update({
        ativo: config.ativo, valor_bonus: config.valor_bonus, tipo_bonus: config.tipo_bonus, descricao: config.descricao,
      }).eq("id", 1);
      toast({ title: "Configurações salvas!" });
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const set = (key: keyof IndicacoesConfig, value: any) => setConfig(c => c ? { ...c, [key]: value } : c);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (!config) return <div className="text-center py-8 text-muted-foreground">Erro ao carregar configurações</div>;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Configurações do Programa</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Configure o programa de indicações do sistema.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-foreground/70" />
            <CardTitle className="text-sm">Status do Programa</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border px-3 py-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Programa Ativo</span>
              <p className="text-xs text-muted-foreground">Permitir que usuários indiquem e ganhem comissões</p>
            </div>
            <Switch checked={config.ativo} onCheckedChange={v => set("ativo", v)} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">* A comissão só é creditada quando o indicado assina um plano.</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-foreground/70" />
            <CardTitle className="text-sm">Valores da Comissão (Padrão)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Comissão</Label>
              <Select value={config.tipo_bonus} onValueChange={v => set("tipo_bonus", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{config.tipo_bonus === "fixo" ? "Valor da Comissão (R$)" : "Percentual da Comissão (%)"}</Label>
              <Input type="number" step="0.01" min="0" value={config.valor_bonus} onChange={e => set("valor_bonus", Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição do Programa</Label>
            <Input value={config.descricao || ""} onChange={e => set("descricao", e.target.value)} placeholder="Indique amigos e ganhe comissões..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Configurações"}</Button>
      </div>
    </div>
  );
}
