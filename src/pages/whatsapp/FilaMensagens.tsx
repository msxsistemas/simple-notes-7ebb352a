import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEvolutionAPISimple } from "@/hooks/useEvolutionAPISimple";
import { format } from "date-fns";

interface Mensagem {
  id: string;
  cliente: string;
  whatsapp: string;
  mensagem: string;
  data_hora: string;
  scheduled_for?: string;
  status: "enviada" | "aguardando" | "erro" | "agendada";
}

export default function FilaMensagens() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'single' | 'enviadas' | 'todas'; id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useCurrentUser();
  const { sendMessage, isConnected, hydrated } = useEvolutionAPISimple();

  useEffect(() => {
    document.title = "Fila de Mensagens | Tech Play";
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadMensagens();
    }
  }, [user?.id]);

  // Keep queue UI in sync with background processor via realtime only
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`fila-mensagens-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Silently refresh without loading spinner
          loadMensagens(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);


  const loadMensagens = async (silent = false) => {
    if (!user?.id) return;
    
    if (!silent) setLoading(true);
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false });

      if (messagesError) {
        console.error("Erro ao carregar mensagens:", messagesError);
        toast.error("Erro ao carregar mensagens");
        return;
      }

      const { data: clientesData } = await supabase
        .from("clientes")
        .select("nome, whatsapp")
        .eq("user_id", user.id);

      const normalizePhone = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (!cleaned.startsWith('55') && cleaned.length >= 10) {
          return '55' + cleaned;
        }
        return cleaned;
      };

      const clientesMap = new Map(
        clientesData?.map(c => [normalizePhone(c.whatsapp), c.nome]) || []
      );

      if (messagesData) {
        setMensagens(messagesData.map(m => {
          const phoneClean = normalizePhone(m.phone);
          let status: "enviada" | "aguardando" | "erro" | "agendada" = 'aguardando';
          if (m.status === 'sent') status = 'enviada';
          else if (m.status === 'pending') status = 'aguardando';
          else if (m.status === 'scheduled') status = 'agendada';
          else if (m.status === 'failed') status = 'erro';
          
          return {
            id: m.id,
            cliente: clientesMap.get(phoneClean) || m.phone,
            whatsapp: m.phone,
            mensagem: m.message,
            data_hora: m.sent_at,
            scheduled_for: (m as any).scheduled_for,
            status
          };
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  const filteredMensagens = mensagens.filter(m => {
    if (filtro === "aguardando" && m.status !== "aguardando" && m.status !== "agendada") return false;
    if (filtro === "enviadas" && m.status !== "enviada") return false;
    if (filtro === "erro" && m.status !== "erro") return false;
    if (busca && !m.cliente.toLowerCase().includes(busca.toLowerCase()) && !m.whatsapp.includes(busca)) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredMensagens.length / parseInt(entriesPerPage)) || 1;
  const paginatedMensagens = filteredMensagens.slice(
    (currentPage - 1) * parseInt(entriesPerPage),
    currentPage * parseInt(entriesPerPage)
  );

  const counts = {
    todas: mensagens.length,
    aguardando: mensagens.filter(m => m.status === "aguardando" || m.status === "agendada").length,
    enviadas: mensagens.filter(m => m.status === "enviada").length,
    erro: mensagens.filter(m => m.status === "erro").length,
  };

  const handleForcarEnvio = async () => {
    if (!hydrated) {
      toast.info("Aguarde, verificando conexão...");
      return;
    }
    if (!isConnected) {
      toast.error("WhatsApp não está conectado. Conecte primeiro em 'Parear WhatsApp'");
      return;
    }

    const paraEnviar = mensagens.filter(m => m.status === "aguardando" || m.status === "agendada");
    if (paraEnviar.length === 0) {
      toast.info("Não há mensagens aguardando envio");
      return;
    }

    setActionLoading(true);
    
    const toastId = toast.loading(`Enviando 0/${paraEnviar.length} mensagens...`);

    let enviadas = 0;
    let erros = 0;

    try {
      for (let i = 0; i < paraEnviar.length; i++) {
        const msg = paraEnviar[i];
        
        toast.loading(`Enviando ${i + 1}/${paraEnviar.length} mensagens...`, { id: toastId });
        
        try {
          await sendMessage(msg.whatsapp, msg.mensagem);
          
          await supabase
            .from("whatsapp_messages")
            .update({ status: 'sent', scheduled_for: null } as any)
            .eq("id", msg.id);
          
          enviadas++;
        } catch (error) {
          console.error(`Erro ao enviar para ${msg.whatsapp}:`, error);
          
          await supabase
            .from("whatsapp_messages")
            .update({ status: 'failed', error_message: String(error), scheduled_for: null } as any)
            .eq("id", msg.id);
          
          erros++;
        }

        if (i < paraEnviar.length - 1) {
          const baseDelay = Math.floor(Math.random() * (25 - 17 + 1)) + 17;
          const variation = Math.floor(Math.random() * 10) + 1;
          const totalDelay = (baseDelay + variation) * 1000;
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      }

      toast.dismiss(toastId);
      
      if (erros === 0) {
        toast.success(`${enviadas} mensagens enviadas com sucesso!`);
      } else {
        toast.warning(`${enviadas} enviadas, ${erros} com erro`);
      }
    } catch (error) {
      console.error("Erro geral ao forçar envio:", error);
      toast.dismiss(toastId);
      toast.error("Erro ao processar envio de mensagens");
    } finally {
      setActionLoading(false);
      await loadMensagens();
    }
  };

  const handleExcluirEnviadas = async () => {
    setDeleteDialog({ type: 'enviadas' });
  };

  const handleExcluirTodas = async () => {
    setDeleteDialog({ type: 'todas' });
  };

  const confirmDelete = async () => {
    if (!deleteDialog || !user?.id) return;

    setActionLoading(true);
    try {
      if (deleteDialog.type === 'single' && deleteDialog.id) {
        await supabase
          .from("whatsapp_messages")
          .delete()
          .eq("id", deleteDialog.id)
          .eq("user_id", user.id);
        toast.success("Mensagem excluída!");
      } else if (deleteDialog.type === 'enviadas') {
        await supabase
          .from("whatsapp_messages")
          .delete()
          .eq("user_id", user.id)
          .eq("status", "sent");
        toast.success("Mensagens enviadas excluídas!");
      } else if (deleteDialog.type === 'todas') {
        await supabase
          .from("whatsapp_messages")
          .delete()
          .eq("user_id", user.id);
        toast.success("Todas as mensagens excluídas!");
      }
      
      await loadMensagens();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir mensagens");
    } finally {
      setActionLoading(false);
      setDeleteDialog(null);
    }
  };

  const handleReativarMensagens = async () => {
    if (!user?.id) return;

    const comErro = mensagens.filter(m => m.status === "erro");
    if (comErro.length === 0) {
      toast.info("Não há mensagens com erro para reativar");
      return;
    }

    setActionLoading(true);
    try {
      await supabase
        .from("whatsapp_messages")
        .update({ status: 'pending', error_message: null })
        .eq("user_id", user.id)
        .eq("status", "failed");

      toast.success(`${comErro.length} mensagens reativadas e colocadas na fila!`);
      await loadMensagens();
    } catch (error) {
      console.error("Erro ao reativar:", error);
      toast.error("Erro ao reativar mensagens");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({ type: 'single', id });
  };

  const handleResend = async (id: string) => {
    if (!isConnected) {
      toast.error("WhatsApp não está conectado");
      return;
    }

    const msg = mensagens.find(m => m.id === id);
    if (!msg) return;

    setActionLoading(true);
    try {
      await sendMessage(msg.whatsapp, msg.mensagem);
      
      await supabase
        .from("whatsapp_messages")
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq("id", id);

      toast.success("Mensagem reenviada com sucesso!");
      await loadMensagens();
    } catch (error) {
      console.error("Erro ao reenviar:", error);
      toast.error("Erro ao reenviar mensagem");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (msg: Mensagem) => {
    const { status } = msg;
    switch (status) {
      case "enviada":
        return <Badge variant="outline" className="border-success/50 bg-success/10 text-success">Enviada</Badge>;
      case "aguardando":
        return <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">Aguardando</Badge>;
      case "agendada":
        return <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">Agendada</Badge>;
      case "erro":
        return <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fila de Mensagens</h1>
          <p className="text-sm text-muted-foreground">Gerencie as mensagens WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleForcarEnvio} 
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Forçar Envio
          </Button>
          <Button 
            variant="outline"
            onClick={handleExcluirEnviadas} 
            disabled={actionLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir Enviadas
          </Button>
          <Button 
            variant="destructive"
            onClick={handleExcluirTodas} 
            disabled={actionLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir Todas
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-48"
          />
          {[
            { value: "todas", label: "Todas", count: counts.todas },
            { value: "aguardando", label: "Aguardando Envio", count: counts.aguardando },
            { value: "enviadas", label: "Mensagens Enviadas", count: counts.enviadas },
            { value: "erro", label: "Mensagens com Erro", count: counts.erro },
          ].map((f) => (
            <Button
              key={f.value}
              variant={filtro === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltro(f.value)}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
      </div>

      {/* Record count + Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="text-xs sm:text-sm">Mostrando {paginatedMensagens.length} de {filteredMensagens.length} registros.</span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-xs sm:text-sm whitespace-nowrap">Página {currentPage} de {totalPages}</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              {"<<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {"<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              {">>"}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMensagens.length ? (
                paginatedMensagens.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium">{msg.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{msg.whatsapp}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {msg.mensagem}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(msg.data_hora), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{getStatusBadge(msg)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(msg.status === "erro" || msg.status === "aguardando") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResend(msg.id)}
                            className="h-8 w-8 text-primary hover:text-primary/80"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(msg.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhuma mensagem encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === 'single' && "Tem certeza que deseja excluir esta mensagem?"}
              {deleteDialog?.type === 'enviadas' && "Tem certeza que deseja excluir todas as mensagens enviadas?"}
              {deleteDialog?.type === 'todas' && "Tem certeza que deseja excluir TODAS as mensagens? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
