import { useEffect, useState } from "react";
import { useTemplatesCobranca } from "@/hooks/useDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import type { TemplateCobranca } from "@/types/database";

export default function TemplatesCobranca() {
  const [templates, setTemplates] = useState<TemplateCobranca[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateCobranca | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    mensagem: "",
    incluir_cartao: false,
    incluir_chave_pix: false,
    chave_pix: ""
  });

  const { buscar, criar, atualizar, deletar } = useTemplatesCobranca();

  useEffect(() => {
    document.title = "Templates de Cobrança | Gestor Tech Play";
    const d = document.querySelector('meta[name="description"]') || document.createElement('meta');
    d.setAttribute('name', 'description');
    d.setAttribute('content', 'Gerencie os templates de mensagens de cobrança.');
    if (!d.parentElement) document.head.appendChild(d);
    
    carregarTemplates();
  }, []);

  const carregarTemplates = async () => {
    const data = await buscar();
    setTemplates(data || []);
  };

  const handleOpenDialog = (template?: TemplateCobranca) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        nome: template.nome,
        mensagem: template.mensagem,
        incluir_cartao: template.incluir_cartao,
        incluir_chave_pix: template.incluir_chave_pix,
        chave_pix: template.chave_pix || ""
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        nome: "",
        mensagem: "",
        incluir_cartao: false,
        incluir_chave_pix: false,
        chave_pix: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTemplate?.id) {
        await atualizar(editingTemplate.id, formData);
        toast.success("Template atualizado com sucesso!");
      } else {
        await criar(formData);
        toast.success("Template criado com sucesso!");
      }
      await carregarTemplates();
      setDialogOpen(false);
    } catch (error) {
      console.error("Erro ao salvar template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este template?")) return;
    
    setLoading(true);
    try {
      await deletar(id);
      toast.success("Template deletado com sucesso!");
      await carregarTemplates();
    } catch (error) {
      console.error("Erro ao deletar template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicar = async (template: TemplateCobranca) => {
    setLoading(true);
    try {
      await criar({
        nome: `${template.nome} (Cópia)`,
        mensagem: template.mensagem,
        incluir_cartao: template.incluir_cartao,
        incluir_chave_pix: template.incluir_chave_pix,
        chave_pix: template.chave_pix || ""
      });
      toast.success("Template duplicado com sucesso!");
      await carregarTemplates();
    } catch (error) {
      console.error("Erro ao duplicar template:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Templates de Cobrança
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Template" : "Novo Template"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSalvar} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Template *</Label>
                <Input
                  id="nome"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Confirmação de Pagamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  required
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  className="min-h-[200px]"
                  placeholder="Digite a mensagem do template..."
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{nome}"}, {"{plano}"}, {"{valor}"}, {"{data_vencimento}"}, {"{usuario}"}, {"{senha}"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="incluir_cartao"
                    checked={formData.incluir_cartao}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, incluir_cartao: checked as boolean })
                    }
                  />
                  <Label htmlFor="incluir_cartao" className="cursor-pointer">
                    Incluir link de pagamento por cartão
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="incluir_chave_pix"
                    checked={formData.incluir_chave_pix}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, incluir_chave_pix: checked as boolean })
                    }
                  />
                  <Label htmlFor="incluir_chave_pix" className="cursor-pointer">
                    Incluir chave PIX
                  </Label>
                </div>

                {formData.incluir_chave_pix && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="chave_pix">Chave PIX</Label>
                    <Input
                      id="chave_pix"
                      value={formData.chave_pix}
                      onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                      placeholder="Digite a chave PIX"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates de mensagens</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="mobile-scroll-x px-3 sm:px-0">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Mídia</TableHead>
                  <TableHead className="hidden md:table-cell">Padrão</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum template encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.nome}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="destructive">NÃO</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Checkbox disabled />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(template)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicar(template)}
                            title="Duplicar"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => template.id && handleDeletar(template.id)}
                            title="Deletar"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações sobre Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Variáveis disponíveis:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{nome}"}</code> - Nome do cliente</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{plano}"}</code> - Nome do plano</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{valor}"}</code> - Valor da cobrança</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{data_vencimento}"}</code> - Data de vencimento</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{usuario}"}</code> - Usuário de acesso</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{"{senha}"}</code> - Senha de acesso</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
