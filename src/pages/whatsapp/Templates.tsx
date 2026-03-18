import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Copy, Trash2, Loader2 } from "lucide-react";
import { useTemplatesMensagens, TemplateMensagem } from "@/hooks/useTemplatesMensagens";

export default function Templates() {
  const navigate = useNavigate();
  const { 
    templates, 
    loading, 
    deleteTemplate, 
    duplicateTemplate, 
    restoreDefaults 
  } = useTemplatesMensagens();
  
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Templates | Tech Play";
  }, []);

  const handleEdit = (template: TemplateMensagem) => {
    navigate(`/whatsapp/templates/editar/${template.id}`);
  };

  const handleCopy = async (template: TemplateMensagem) => {
    await duplicateTemplate(template);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
  };

  const handleRestaurarPadrao = async () => {
    await restoreDefaults();
  };

  const filteredTemplates = templates.filter((t) =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando templates...</p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus templates de mensagens</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                Limpar Templates
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todos os templates</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja apagar todos os templates? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestaurarPadrao} className="bg-destructive hover:bg-destructive/90">
                  Apagar Todos
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => navigate("/whatsapp/templates/cadastro")} className="bg-primary hover:bg-primary/90">
            Novo Template +
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Busca</Label>
            <Input
              placeholder=""
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={() => setSearchTerm("")}
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Record count */}
      <div className="text-right text-sm text-muted-foreground">
        Mostrando {filteredTemplates.length} de {templates.length} registros.
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length ? (
              filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.nome}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        className="h-8 w-8 text-primary hover:text-primary/80"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(template)}
                        className="h-8 w-8 text-primary hover:text-primary/80"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o template "{template.nome}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(template.id)} className="bg-destructive hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Nenhum template encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
