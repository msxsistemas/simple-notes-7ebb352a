import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText } from "lucide-react";

export default function AdminTemplateEditar() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("system_templates").select("*").eq("id", id).single();
      if (data) setForm(data);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (!form) return <div className="text-center py-8 text-muted-foreground">Template não encontrado</div>;

  const handleSave = async () => {
    try {
      const { id: _, created_at, updated_at, ...payload } = form;
      await supabase.from("system_templates").update(payload).eq("id", id);
      toast({ title: "Template atualizado!" });
      navigate("/role/admin/templates");
    } catch {
      toast({ title: "Erro ao salvar template", variant: "destructive" });
    }
  };

  return (
    <div>
      <header className="rounded-lg border mb-3 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-foreground/70" />
                <h1 className="text-base font-semibold tracking-tight text-foreground">Editar Template</h1>
              </div>
              <p className="text-xs/6 text-muted-foreground">Altere os dados do template padrão.</p>
            </div>
            <Button onClick={() => navigate("/role/admin/templates")} size="sm" variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm">Dados do Template</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Tipo</Label><Input value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} /></div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={form.mensagem} onChange={e => setForm((f: any) => ({ ...f, mensagem: e.target.value }))} rows={4} />
            <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{nome}"}, {"{whatsapp}"}, {"{data_vencimento}"}, {"{plano}"}, {"{valor}"}</p>
          </div>
          <div className="rounded-md border px-3 py-2 flex items-center justify-between">
            <span className="text-sm">Ativo</span>
            <Switch checked={form.ativo} onCheckedChange={v => setForm((f: any) => ({ ...f, ativo: v }))} />
          </div>
          <Button onClick={handleSave} className="w-full">Salvar Alterações</Button>
        </CardContent>
      </Card>
    </div>
  );
}
