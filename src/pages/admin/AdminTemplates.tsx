import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Pencil, Trash2, FileText } from "lucide-react";

interface SystemTemplate {
  id: string;
  tipo: string;
  nome: string;
  mensagem: string;
  ativo: boolean;
}

const tipoLabels: Record<string, string> = {
  bem_vindo: "Boas-vindas",
  vencido: "Vencido",
  vence_hoje: "Vence Hoje",
  proximo_vencer: "Próximo a Vencer",
  confirmacao_pagamento: "Confirmação Pagamento",
  aniversario: "Aniversário",
  dados_cliente: "Dados do Cliente",
  fatura_criada: "Fatura Criada",
  expiracao_app: "Expiração App",
  indicacao_meta: "Meta de Indicações",
  indicacao_convite: "Indicação",
};

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetch_ = async () => {
    const { data } = await supabase.from("system_templates").select("*").order("tipo");
    if (data) setTemplates(data as SystemTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Templates | Admin Gestor Msx";
    fetch_();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("system_templates").delete().eq("id", id);
    toast({ title: "Template excluído" });
    fetch_();
  };

  return (
    <div>
      <header className="rounded-lg border mb-3 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-foreground/70" />
                <h1 className="text-base font-semibold tracking-tight text-foreground">Templates Padrão</h1>
              </div>
              <p className="text-xs/6 text-muted-foreground">Mensagens padrão copiadas para novos usuários do sistema.</p>
            </div>
            <Button onClick={() => navigate("/role/admin/templates/novo")} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </div>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-foreground/70" />
            <CardTitle className="text-sm">Templates ({templates.length})</CardTitle>
          </div>
          <CardDescription>Modelos de mensagem disponíveis para todos os usuários.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum template cadastrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell><Badge variant="outline">{tipoLabels[t.tipo] || t.tipo}</Badge></TableCell>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{t.mensagem}</TableCell>
                      <TableCell><Badge variant={t.ativo ? "default" : "secondary"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/role/admin/templates/editar/${t.id}`)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
