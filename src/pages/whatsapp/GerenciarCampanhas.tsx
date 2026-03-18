import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Play, Pause } from "lucide-react";
import { toast } from "sonner";

interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  destinatarios: string;
  status: "ativa" | "pausada" | "finalizada";
  enviadas: number;
  total: number;
  criada_em: string;
}

export default function GerenciarCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaCampanha, setNovaCampanha] = useState({
    nome: "",
    mensagem: "",
    destinatarios: "todos",
  });

  useEffect(() => {
    document.title = "Gerenciar Campanhas | Tech Play";
    setCampanhas([
      {
        id: "1",
        nome: "Promoção de Natal",
        mensagem: "Olá {nome_cliente}! Aproveite nossa promoção de Natal...",
        destinatarios: "todos",
        status: "ativa",
        enviadas: 150,
        total: 500,
        criada_em: "2026-01-15",
      },
      {
        id: "2",
        nome: "Aviso de Manutenção",
        mensagem: "Prezado cliente, informamos que haverá manutenção...",
        destinatarios: "ativos",
        status: "finalizada",
        enviadas: 300,
        total: 300,
        criada_em: "2026-01-10",
      },
    ]);
  }, []);

  const handleCriarCampanha = (e: React.FormEvent) => {
    e.preventDefault();

    const campanha: Campanha = {
      id: Date.now().toString(),
      nome: novaCampanha.nome,
      mensagem: novaCampanha.mensagem,
      destinatarios: novaCampanha.destinatarios,
      status: "pausada",
      enviadas: 0,
      total: 100,
      criada_em: new Date().toISOString().split("T")[0],
    };

    setCampanhas([campanha, ...campanhas]);
    setNovaCampanha({ nome: "", mensagem: "", destinatarios: "todos" });
    setDialogOpen(false);
    toast.success("Campanha criada com sucesso!");
  };

  const handleToggleStatus = (id: string) => {
    setCampanhas(campanhas.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === "ativa" ? "pausada" : "ativa" };
      }
      return c;
    }));
    toast.success("Status da campanha atualizado!");
  };

  const handleDelete = (id: string) => {
    setCampanhas(campanhas.filter(c => c.id !== id));
    toast.success("Campanha excluída!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativa":
        return <Badge className="bg-success text-success-foreground">Ativa</Badge>;
      case "pausada":
        return <Badge className="bg-warning text-warning-foreground">Pausada</Badge>;
      case "finalizada":
        return <Badge variant="secondary">Finalizada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gerenciar Campanhas</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie campanhas de envio em massa</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCriarCampanha} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input
                  required
                  value={novaCampanha.nome}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, nome: e.target.value })}
                  placeholder="Ex: Promoção de Verão"
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  required
                  value={novaCampanha.mensagem}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, mensagem: e.target.value })}
                  className="min-h-[100px]"
                  placeholder="Digite a mensagem da campanha..."
                />
              </div>
              <Button type="submit" className="w-full">
                Criar Campanha
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campanhas.map((campanha) => (
                  <TableRow key={campanha.id}>
                    <TableCell className="font-medium">{campanha.nome}</TableCell>
                    <TableCell>{getStatusBadge(campanha.status)}</TableCell>
                    <TableCell>
                      {campanha.enviadas}/{campanha.total} ({Math.round((campanha.enviadas / campanha.total) * 100)}%)
                    </TableCell>
                    <TableCell>{campanha.criada_em}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleToggleStatus(campanha.id)}
                          disabled={campanha.status === "finalizada"}
                        >
                          {campanha.status === "ativa" ? (
                            <Pause className="h-4 w-4 text-warning" />
                          ) : (
                            <Play className="h-4 w-4 text-success" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(campanha.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
