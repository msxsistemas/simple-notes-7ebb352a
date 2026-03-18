import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePlanos } from "@/hooks/useDatabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Power, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Plano } from "@/types/database";

const PER_PAGE = 10;

const formatCurrencyBRL = (value: string) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const number = Number(digits) / 100;
  if (isNaN(number)) return "R$ 0,00";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function ClientesPlanos() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    tipo: "meses",
    quantidade: "",
    descricao: "",
    valor_indicacao: "0",
    indicacao_recorrente: "desativado",
    tipo_painel: ""
  });
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  
  const { criar, atualizar, buscar, deletar } = usePlanos();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Clientes - Planos | Gestor Tech Play";
    const carregar = async () => {
      setLoadingPlanos(true);
      const data = await buscar();
      setPlanos(data || []);
      setLoadingPlanos(false);
    };
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.nome.trim() || !formData.valor.trim()) return;
    
    setLoading(true);
    try {
      if (editingPlano) {
        const atualizado = await atualizar(editingPlano.id!, formData);
        if (atualizado) {
          setPlanos((prev) => 
            prev.map((p) => (p.id === editingPlano.id ? atualizado : p))
          );
          toast({ title: "Sucesso", description: "Plano atualizado com sucesso!", duration: 3000 });
        }
      } else {
        const novo = await criar(formData);
        if (novo) {
          setPlanos((prev) => [novo, ...prev]);
          toast({ title: "Sucesso", description: "Plano cadastrado com sucesso!", duration: 3000 });
        }
      }
      
      setIsDialogOpen(false);
      setEditingPlano(null);
      setFormData({
        nome: "",
        valor: "",
        tipo: "meses",
        quantidade: "",
        descricao: "",
        valor_indicacao: "0",
        indicacao_recorrente: "desativado",
        tipo_painel: ""
      });
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plano: Plano) => {
    setEditingPlano(plano);
    setFormData({
      nome: plano.nome || "",
      valor: plano.valor ? (plano.valor.toString().trim().startsWith("R$") ? plano.valor : formatCurrencyBRL(plano.valor.toString())) : "",
      tipo: plano.tipo || "meses",
      quantidade: plano.quantidade || "",
      descricao: plano.descricao || "",
      valor_indicacao: "0",
      indicacao_recorrente: "desativado",
      tipo_painel: ""
    });
    setIsDialogOpen(true);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingPlano(null);
    setFormData({
      nome: "",
      valor: "",
      tipo: "meses",
      quantidade: "",
      descricao: "",
      valor_indicacao: "0",
      indicacao_recorrente: "desativado",
      tipo_painel: ""
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deletar(id);
      setPlanos((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Erro ao excluir plano:", error);
    }
  };

  const [desativarTarget, setDesativarTarget] = useState<Plano | null>(null);

  const handleToggleAtivo = async (plano: Plano) => {
    const isActive = (plano as any).ativo !== false;
    
    // Se está ativo e vai desativar, pede confirmação
    if (isActive) {
      setDesativarTarget(plano);
      return;
    }
    
    // Se está inativo, ativa direto sem confirmação
    await executarToggle(plano);
  };

  const executarToggle = async (plano: Plano) => {
    const isActive = (plano as any).ativo !== false;
    try {
      const atualizado = await atualizar(plano.id!, { ativo: !isActive } as any);
      if (atualizado) {
        setPlanos((prev) => prev.map((p) => (p.id === plano.id ? atualizado : p)));
      }
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  const confirmarDesativar = async () => {
    if (!desativarTarget) return;
    await executarToggle(desativarTarget);
    setDesativarTarget(null);
  };

  const filteredPlanos = useMemo(() => {
    return planos.filter((p) => {
      const matchesSearch = p.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "todos" || 
        (statusFilter === "ativo" && (p as any).ativo !== false) || 
        (statusFilter === "inativo" && (p as any).ativo === false);
      return matchesSearch && matchesStatus;
    });
  }, [planos, searchTerm, statusFilter]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlanos.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPlanos = filteredPlanos.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const getPeriodo = (plano: Plano) => {
    const qtd = plano.quantidade || "1";
    const tipo = plano.tipo === 'dias' ? 'Dia(s)' : 'Mês(es)';
    return `${qtd} ${tipo}`;
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Meus Planos</h1>
          <p className="text-sm text-muted-foreground">Lista com todos os seus planos</p>
        </div>
        <Button 
          onClick={() => navigate("/planos/cadastro")}
          className="bg-primary hover:bg-primary/90"
        >
          Adicionar Plano +
        </Button>
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
          <div className="space-y-2">
            <Label className="text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={() => { setSearchTerm(""); setStatusFilter("todos"); }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Record count */}
      <div className="text-right text-sm text-muted-foreground">
        Mostrando {((currentPage - 1) * PER_PAGE) + 1}–{Math.min(currentPage * PER_PAGE, filteredPlanos.length)} de {filteredPlanos.length} registros.
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPlanos ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground animate-pulse">Carregando planos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedPlanos.length ? (
              paginatedPlanos.map((p, index) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {filteredPlanos.length - ((currentPage - 1) * PER_PAGE + index)}
                  </TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {typeof p.valor === "string" && p.valor.trim().startsWith("R$") ? p.valor : `R$ ${p.valor}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{getPeriodo(p)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={(p as any).ativo !== false 
                        ? "border-success/50 bg-success/10 text-success" 
                        : "border-warning/50 bg-warning/10 text-warning"
                      }
                    >
                      {(p as any).ativo !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/planos/editar/${p.id}`)}
                        className="h-8 w-8 text-primary hover:text-primary/80"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleAtivo(p)}
                        className="h-8 w-8 text-warning hover:text-warning/80"
                        title={(p as any).ativo !== false ? "Desativar" : "Ativar"}
                      >
                        <Power className="h-4 w-4" />
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
                            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o plano "{p.nome}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id!)} className="bg-destructive hover:bg-destructive/90">
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
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum plano encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {((currentPage - 1) * PER_PAGE) + 1}–{Math.min(currentPage * PER_PAGE, filteredPlanos.length)} de {filteredPlanos.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlano ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do plano</Label>
              <Input
                placeholder="Nome do seu plano"
                value={formData.nome}
                onChange={(e) => handleInputChange("nome", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={formData.valor}
                  onChange={(e) => handleInputChange("valor", formatCurrencyBRL(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => handleInputChange("quantidade", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meses">Meses</SelectItem>
                  <SelectItem value="dias">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => handleInputChange("descricao", e.target.value)}
                placeholder="Descrição do plano"
                className="min-h-[80px] resize-none"
              />
            </div>
            
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Desativar Confirmation Dialog */}
      <AlertDialog open={!!desativarTarget} onOpenChange={() => setDesativarTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o plano "{desativarTarget?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDesativar} className="bg-warning hover:bg-warning/90 text-warning-foreground">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
