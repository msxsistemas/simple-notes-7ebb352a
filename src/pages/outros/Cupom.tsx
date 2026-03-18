import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ticket, Plus, Trash2, Pencil, Search, Loader2 } from "lucide-react";
import { useCupons, type CupomInsert } from "@/hooks/useCupons";

export default function Cupom() {
  const { cupons, isLoading, createCupom, updateCupom, deleteCupom } = useCupons();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo: "",
    desconto: "",
    tipo_desconto: "percentual" as "percentual" | "fixo",
    limite_uso: "",
    validade: "",
  });

  useEffect(() => {
    document.title = "Cupons | Tech Play";
  }, []);

  const filteredCupons = cupons.filter((c) =>
    c.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.codigo || !formData.desconto) return;

    const cupomData: CupomInsert = {
      codigo: formData.codigo.toUpperCase(),
      desconto: Number(formData.desconto),
      tipo_desconto: formData.tipo_desconto,
      limite_uso: formData.limite_uso ? Number(formData.limite_uso) : null,
      validade: formData.validade || null,
    };

    if (editingId) {
      await updateCupom.mutateAsync({ id: editingId, ...cupomData });
    } else {
      await createCupom.mutateAsync(cupomData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({ codigo: "", desconto: "", tipo_desconto: "percentual", limite_uso: "", validade: "" });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (cupom: typeof cupons[0]) => {
    setEditingId(cupom.id);
    setFormData({
      codigo: cupom.codigo,
      desconto: cupom.desconto.toString(),
      tipo_desconto: cupom.tipo_desconto as "percentual" | "fixo",
      limite_uso: cupom.limite_uso?.toString() || "",
      validade: cupom.validade ? cupom.validade.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCupom.mutate(id);
  };

  const toggleAtivo = (cupom: typeof cupons[0]) => {
    updateCupom.mutate({ id: cupom.id, ativo: !cupom.ativo });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando cupons...</p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Cupons de Desconto</h1>
            <p className="text-sm text-muted-foreground">Gerencie cupons promocionais</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Código do Cupom *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ex: PROMO20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desconto *</Label>
                  <Input
                    type="number"
                    value={formData.desconto}
                    onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.tipo_desconto === "percentual" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, tipo_desconto: "percentual" })}
                    >
                      %
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.tipo_desconto === "fixo" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, tipo_desconto: "fixo" })}
                    >
                      R$
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Limite de Usos</Label>
                  <Input
                    type="number"
                    value={formData.limite_uso}
                    onChange={(e) => setFormData({ ...formData, limite_uso: e.target.value })}
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={formData.validade}
                    onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={createCupom.isPending || updateCupom.isPending}
              >
                {(createCupom.isPending || updateCupom.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingId ? "Salvar Alterações" : "Criar Cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder=""
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredCupons.length} cupom(ns) encontrado(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cupom encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredCupons.map((cupom) => (
                  <TableRow key={cupom.id}>
                    <TableCell className="font-mono font-medium">{cupom.codigo}</TableCell>
                    <TableCell>
                      {cupom.tipo_desconto === "percentual"
                        ? `${cupom.desconto}%`
                        : `R$ ${Number(cupom.desconto).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {cupom.usos_atuais}
                      {cupom.limite_uso ? `/${cupom.limite_uso}` : ""}
                    </TableCell>
                    <TableCell>
                      {cupom.validade
                        ? new Date(cupom.validade).toLocaleDateString("pt-BR")
                        : "Sem validade"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cupom.ativo}
                          onCheckedChange={() => toggleAtivo(cupom)}
                        />
                        <Badge variant={cupom.ativo ? "default" : "secondary"} className="text-xs">
                          {cupom.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cupom)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cupom.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          disabled={deleteCupom.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
