import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Package } from "lucide-react";

const RECURSOS_SUGERIDOS = [
  "Suporte prioritário", "Envios ilimitados", "WhatsApp conectado",
  "Painéis ilimitados", "Relatórios avançados", "Renovação automática",
  "Cobranças automáticas", "Templates personalizados", "Cupons de desconto",
  "Múltiplas sessões WhatsApp", "API de integração", "Backup diário",
];

const emptyPlan = {
  nome: "", descricao: "", valor: 0, intervalo: "mensal",
  recursos: [] as string[], ativo: true, destaque: false, ordem: 0,
};

export default function AdminPlanoNovo() {
  const [form, setForm] = useState(emptyPlan);
  const [recursoInput, setRecursoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const addRecurso = () => {
    if (recursoInput.trim()) {
      setForm(f => ({ ...f, recursos: [...f.recursos, recursoInput.trim()] }));
      setRecursoInput("");
    }
  };

  const removeRecurso = (i: number) => setForm(f => ({ ...f, recursos: f.recursos.filter((_, idx) => idx !== i) }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("system_plans").insert({ ...form });
      if (error) throw error;
      toast({ title: "Plano criado com sucesso!" });
      navigate("/role/admin/planos");
    } catch {
      toast({ title: "Erro ao criar plano", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="rounded-lg border mb-3 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-foreground/70" />
                <h1 className="text-base font-semibold tracking-tight text-foreground">Novo Plano</h1>
              </div>
              <p className="text-xs/6 text-muted-foreground">Preencha os dados para criar um novo plano SaaS.</p>
            </div>
            <Button onClick={() => navigate("/role/admin/planos")} size="sm" variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm">Dados do Plano</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Básico, Profissional" /></div>
            <div><Label>Valor</Label><CurrencyInput value={form.valor} onValueChange={v => setForm(f => ({ ...f, valor: v }))} /></div>
          </div>
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva os benefícios do plano" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Intervalo</Label>
              <Select value={form.intervalo} onValueChange={v => setForm(f => ({ ...f, intervalo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordem</Label><Input type="number" min={0} value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} /></div>
          </div>
          <div>
            <Label>Recursos</Label>
            <div className="flex gap-2 mt-1">
              <Input value={recursoInput} onChange={e => setRecursoInput(e.target.value)} placeholder="Ex: Suporte prioritário" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecurso())} />
              <Button type="button" variant="outline" onClick={addRecurso}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.recursos.map((r, i) => (
                <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeRecurso(i)}>{r} ×</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {RECURSOS_SUGERIDOS.filter(r => !form.recursos.includes(r)).map(r => (
                <Badge key={r} variant="outline" className="cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setForm(f => ({ ...f, recursos: [...f.recursos, r] }))}>+ {r}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label>Ativo</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.destaque} onCheckedChange={v => setForm(f => ({ ...f, destaque: v }))} /><Label>Destaque</Label></div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/role/admin/planos")}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Criando..." : "Criar Plano"}
            </Button>
          </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
