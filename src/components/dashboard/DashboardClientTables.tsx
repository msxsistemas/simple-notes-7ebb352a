import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { replaceMessageVariables } from "@/utils/message-variables";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nome: string;
  usuario?: string | null;
  data_vencimento?: string | null;
  plano?: string | null;
  whatsapp: string;
}

interface Plano {
  id: string;
  nome: string;
}

type NotificationType = "vencido" | "vence_hoje" | "proximo_vencer";

interface ClientTableProps {
  title: string;
  subtitle: string;
  clientes: Cliente[];
  planosMap: Map<string, Plano>;
  headerColor: "red" | "green" | "yellow";
  notificationType: NotificationType;
  loading?: boolean;
  onNotify: (cliente: Cliente, type: NotificationType) => Promise<void>;
}

function ClientTable({ title, subtitle, clientes, planosMap, headerColor, notificationType, loading, onNotify }: ClientTableProps) {
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const headerStyles = {
    red: "bg-destructive",
    green: "bg-success",
    yellow: "bg-warning",
  };

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.usuario && c.usuario.toLowerCase().includes(search.toLowerCase()))
  );

  const limit = parseInt(perPage);
  const totalPages = Math.ceil(filtered.length / limit);
  const start = (currentPage - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const getStatus = (dateStr?: string | null) => {
    if (!dateStr) return { label: "-", color: "bg-muted text-muted-foreground" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const venc = new Date(dateStr);
    venc.setHours(0, 0, 0, 0);

    if (venc < today) {
      return { label: "Vencido", color: "bg-destructive text-destructive-foreground" };
    }
    return { label: "Ativo", color: "bg-success text-success-foreground" };
  };

  const getPlanoNome = (planoId?: string | null) => {
    if (!planoId) return "-";
    const plano = planosMap.get(planoId);
    return plano?.nome || "-";
  };

  const openWhatsApp = (phone: string) => {
    const formatted = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${formatted}`, "_blank");
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <div className={`${headerStyles[headerColor]} p-4`}>
          <div className="h-6 bg-white/20 rounded w-64 animate-pulse" />
        </div>
        <div className="bg-card p-4">
          <div className="h-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (clientes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className={`${headerStyles[headerColor]} p-4`}>
        <h3 className="font-semibold text-primary-foreground">{title}</h3>
        <p className="text-sm text-primary-foreground/80">{subtitle}</p>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 flex items-center justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mostrar</span>
          <Select value={perPage} onValueChange={(v) => { setPerPage(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entradas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Buscar:</span>
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-40 h-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Cliente:</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Usuário:</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Vencimento:</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status:</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plano:</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Ações:</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((cliente) => {
              const status = getStatus(cliente.data_vencimento);
              return (
                <tr key={cliente.id} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3">
                    <span className="text-primary font-medium">{cliente.nome}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-primary">{cliente.usuario || "-"}</span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-3 py-1 rounded-full border border-border text-sm">
                      {formatDate(cliente.data_vencimento)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-3 py-1 rounded border border-primary text-primary text-xs">
                      {getPlanoNome(cliente.plano)}
                    </span>
                  </td>
                  <td className="p-3">
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-primary hover:bg-primary/90"
                      title="Notificar vencimento"
                      disabled={sendingId === cliente.id}
                      onClick={async () => {
                        setSendingId(cliente.id);
                        await onNotify(cliente, notificationType);
                        setSendingId(null);
                      }}
                    >
                      {sendingId === cliente.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-card p-4 flex items-center justify-between border-t border-border">
        <span className="text-sm text-muted-foreground">
          Mostrando {start + 1} a {Math.min(start + limit, filtered.length)} de {filtered.length} entradas
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Anterior
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            return (
              <Button
                key={page}
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={`w-8 border-border ${
                  currentPage === page 
                    ? "bg-muted text-foreground hover:bg-muted/80" 
                    : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {page}
              </Button>
            );
          })}
          {totalPages > 5 && <span className="px-2 text-muted-foreground">...</span>}
          {totalPages > 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              className={`w-8 border-border ${
                currentPage === totalPages 
                  ? "bg-muted text-foreground hover:bg-muted/80" 
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {totalPages}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClientTables() {
  const { userId } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [vencidos, setVencidos] = useState<Cliente[]>([]);
  const [vencendoHoje, setVencendoHoje] = useState<Cliente[]>([]);
  const [proximoVencer, setProximoVencer] = useState<Cliente[]>([]);
  const [planosMap, setPlanosMap] = useState<Map<string, Plano>>(new Map());
  const [mensagensPadroes, setMensagensPadroes] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      carregarDados();
      // Check WhatsApp status once
      supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => setWhatsappConnected(data?.status === 'connected'));
    }
  }, [userId]);

  const carregarDados = async () => {
    try {
      const [clientesRes, planosRes, mensagensRes] = await Promise.all([
        supabase.from("clientes").select("*").eq("user_id", userId),
        supabase.from("planos").select("*").eq("user_id", userId),
        supabase.from("mensagens_padroes").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      if (clientesRes.error) throw clientesRes.error;
      if (planosRes.error) throw planosRes.error;

      const clientes = clientesRes.data || [];
      const planos = planosRes.data || [];

      setPlanosMap(new Map(planos.map((p) => [p.id, p])));
      setMensagensPadroes(mensagensRes.data);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const tresDias = new Date(hoje);
      tresDias.setDate(tresDias.getDate() + 3);

      const vencidosList: Cliente[] = [];
      const vencendoHojeList: Cliente[] = [];
      const proximoVencerList: Cliente[] = [];

      clientes.forEach((cliente) => {
        if (!cliente.data_vencimento) return;

        const dataVenc = new Date(cliente.data_vencimento);
        dataVenc.setHours(0, 0, 0, 0);

        if (dataVenc < hoje) {
          vencidosList.push(cliente);
        } else if (dataVenc.getTime() === hoje.getTime()) {
          vencendoHojeList.push(cliente);
        } else if (dataVenc > hoje && dataVenc <= tresDias) {
          proximoVencerList.push(cliente);
        }
      });

      setVencidos(vencidosList);
      setVencendoHoje(vencendoHojeList);
      setProximoVencer(proximoVencerList);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const processarMensagem = (mensagem: string, cliente: Cliente) => {
    const plano = cliente.plano ? planosMap.get(cliente.plano) : null;
    const planoNome = plano?.nome || "";

    return replaceMessageVariables(
      mensagem,
      {
        nome: cliente.nome,
        usuario: cliente.usuario || undefined,
        data_vencimento: cliente.data_vencimento || undefined,
        whatsapp: cliente.whatsapp,
        plano: planoNome,
      },
      {}
    );
  };

  const handleNotify = async (cliente: Cliente, type: NotificationType) => {
    if (!whatsappConnected) {
      toast.error("WhatsApp não está conectado. Vá em Parear WhatsApp para conectar.");
      return;
    }

    // Buscar mensagem da tabela mensagens_padroes
    const mensagemKey: Record<NotificationType, string> = {
      vencido: "vencido",
      vence_hoje: "vence_hoje",
      proximo_vencer: "proximo_vencer",
    };

    const key = mensagemKey[type];
    const mensagem = mensagensPadroes?.[key];

    if (!mensagem) {
      toast.error(`Mensagem "${key}" não configurada. Configure em Gerenciar Mensagens.`);
      return;
    }

    const mensagemProcessada = processarMensagem(mensagem, cliente);

    try {
      // Inserir na fila de mensagens
      const { error } = await supabase.from("whatsapp_messages").insert({
        user_id: userId,
        phone: cliente.whatsapp,
        message: mensagemProcessada,
        session_id: `user_${userId}`,
        status: "pending",
        scheduled_for: new Date(Date.now() + 5000).toISOString(), // 5 segundos
      });

      if (error) throw error;

      toast.success(`Notificação enviada para ${cliente.nome}!`);
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast.error("Erro ao enviar notificação");
    }
  };

  return (
    <section className="space-y-6">
      <ClientTable
        title="Meus Clientes Com Plano Vencido"
        subtitle="Informe aos seus clientes sobre o vencimento"
        clientes={vencidos}
        planosMap={planosMap}
        headerColor="red"
        notificationType="vencido"
        loading={loading}
        onNotify={handleNotify}
      />

      <ClientTable
        title="Meus Clientes - Vencendo Hoje"
        subtitle="Informe aos seus clientes sobre o vencimento"
        clientes={vencendoHoje}
        planosMap={planosMap}
        headerColor="green"
        notificationType="vence_hoje"
        loading={loading}
        onNotify={handleNotify}
      />

      <ClientTable
        title="Meus Clientes - Próximo Do Vencimento"
        subtitle="Serão mostrados os clientes que tem fatura de acordo com os dias configurados."
        clientes={proximoVencer}
        planosMap={planosMap}
        headerColor="yellow"
        notificationType="proximo_vencer"
        loading={loading}
        onNotify={handleNotify}
      />
    </section>
  );
}
