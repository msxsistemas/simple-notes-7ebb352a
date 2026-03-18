import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Network, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NiveisConfig {
  id: number;
  ativo: boolean;
  n1_tipo: string;
  n1_valor: number;
  n2_tipo: string;
  n2_valor: number;
  n3_tipo: string;
  n3_valor: number;
}

export default function AdminAfiliadosConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-afiliados-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("afiliados_niveis_config" as any)
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as unknown as NiveisConfig;
    },
  });

  const [form, setForm] = useState<NiveisConfig | null>(null);
  const currentForm = form || config;

  const saveMutation = useMutation({
    mutationFn: async (values: Partial<NiveisConfig>) => {
      const { error } = await supabase
        .from("afiliados_niveis_config" as any)
        .update({ ...values, updated_at: new Date().toISOString() } as any)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-afiliados-config"] });
      toast.success("Configurações salvas!");
      setForm(null);
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleSave = () => {
    if (!currentForm) return;
    saveMutation.mutate({
      ativo: currentForm.ativo,
      n1_tipo: currentForm.n1_tipo,
      n1_valor: currentForm.n1_valor,
      n2_tipo: currentForm.n2_tipo,
      n2_valor: currentForm.n2_valor,
      n3_tipo: currentForm.n3_tipo,
      n3_valor: currentForm.n3_valor,
    });
  };

  const updateField = (field: keyof NiveisConfig, value: any) => {
    setForm((prev) => ({
      ...(prev || config!),
      [field]: value,
    }));
  };

  if (isLoading || !currentForm) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Configuração de Afiliados</h1>
            <p className="text-sm text-muted-foreground">Defina as comissões máximas por nível de afiliados.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Sistema de Afiliados
            <div className="flex items-center gap-2">
              <Label htmlFor="ativo" className="text-xs text-muted-foreground">Ativo</Label>
              <Switch
                id="ativo"
                checked={currentForm.ativo}
                onCheckedChange={(v) => updateField("ativo", v)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* N1 */}
          <div className="space-y-2 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="text-sm font-medium text-primary">Nível 1 — N1 (Usuário do Painel)</h3>
            <p className="text-xs text-muted-foreground mb-3">Comissão máxima que o usuário N1 recebe sobre vendas de seus afiliados.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={currentForm.n1_tipo} onValueChange={(v) => updateField("n1_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Máximo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currentForm.n1_tipo === "percentual" ? "%" : "R$"}
                  </span>
                  <Input type="number" step="0.01" min="0" max={currentForm.n1_tipo === "percentual" ? 100 : undefined} className="pl-10" value={currentForm.n1_valor} onChange={(e) => updateField("n1_valor", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>

          {/* N2 */}
          <div className="space-y-2 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="text-sm font-medium text-blue-500">Nível 2 — N2 (Afiliado Direto)</h3>
            <p className="text-xs text-muted-foreground mb-3">Comissão máxima que um afiliado N2 pode receber.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={currentForm.n2_tipo} onValueChange={(v) => updateField("n2_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Máximo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currentForm.n2_tipo === "percentual" ? "%" : "R$"}
                  </span>
                  <Input type="number" step="0.01" min="0" max={currentForm.n2_tipo === "percentual" ? 100 : undefined} className="pl-10" value={currentForm.n2_valor} onChange={(e) => updateField("n2_valor", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>

          {/* N3 */}
          <div className="space-y-2 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="text-sm font-medium text-purple-500">Nível 3 — N3 (Sub-afiliado)</h3>
            <p className="text-xs text-muted-foreground mb-3">Comissão máxima que um afiliado N3 pode receber.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={currentForm.n3_tipo} onValueChange={(v) => updateField("n3_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Máximo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currentForm.n3_tipo === "percentual" ? "%" : "R$"}
                  </span>
                  <Input type="number" step="0.01" min="0" max={currentForm.n3_tipo === "percentual" ? 100 : undefined} className="pl-10" value={currentForm.n3_valor} onChange={(e) => updateField("n3_valor", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
