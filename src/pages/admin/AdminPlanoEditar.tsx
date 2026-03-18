import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
export default function AdminPlanoEditar() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [recursoInput, setRecursoInput] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("system_plans").select("*").eq("id", id).single();
      if (data) setForm({ ...data, recursos: data.recursos || [] });
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (!form) return <div className="text-center py-8 text-muted-foreground">Plano não encontrado</div>;

  const addRecurso = () => {
    if (recursoInput.trim()) {
      setForm((f: any) => ({ ...f, recursos: [...f.recursos, recursoInput.trim()] }));
      setRecursoInput("");
    }
  };

  const removeRecurso = (i: number) => setForm((f: any) => ({ ...f, recursos: f.recursos.filter((_: any, idx: number) => idx !== i) }));

  const handleSave = async () => {
    try {
      const { id: _, created_at, updated_at, ...payload } = form;
      await supabase.from("system_plans").update(payload).eq("id", id);
      toast({ title: "Plano atualizado!" });
      navigate("/role/admin/planos");
    } catch {
      toast({ title: "Erro ao salvar plano", variant: "destructive" });
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
                <h1 className="text-base font-semibold tracking-tight text-foreground">Editar Plano</h1>
              </div>
              <p className="text-xs/6 text-muted-foreground">Altere os dados do plano SaaS.</p>
            </div>
            <Button onClick={() => navigate("/role/admin/planos")} size="sm" variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm">Dados do Plano</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Valor</Label><CurrencyInput value={Number(form.valor)} onValueChange={v => setForm((f: any) => ({ ...f, valor: v }))} /></div>
          </div>
          <div><Label>Descrição</Label><Input value={form.descricao || ""} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Intervalo</Label>
              <Select value={form.intervalo} onValueChange={v => setForm((f: any) => ({ ...f, intervalo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={e => setForm((f: any) => ({ ...f, ordem: Number(e.target.value) }))} /></div>
          </div>
          <div>
            <Label>Recursos</Label>
            <div className="flex gap-2 mt-1">
              <Input value={recursoInput} onChange={e => setRecursoInput(e.target.value)} placeholder="Ex: Suporte prioritário" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecurso())} />
              <Button type="button" variant="outline" onClick={addRecurso}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.recursos.map((r: string, i: number) => (
                <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeRecurso(i)}>{r} ×</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {RECURSOS_SUGERIDOS.filter(r => !form.recursos.includes(r)).map(r => (
                <Badge key={r} variant="outline" className="cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setForm((f: any) => ({ ...f, recursos: [...f.recursos, r] }))}>+ {r}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={v => setForm((f: any) => ({ ...f, ativo: v }))} /><Label>Ativo</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.destaque} onCheckedChange={v => setForm((f: any) => ({ ...f, destaque: v }))} /><Label>Destaque</Label></div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/role/admin/planos")}>Cancelar</Button>
            <Button onClick={handleSave} className="flex-1">Salvar Alterações</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
