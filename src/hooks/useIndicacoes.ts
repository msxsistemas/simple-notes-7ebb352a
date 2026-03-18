import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Indicacao {
  id: string;
  user_id: string;
  cliente_indicado_id: string | null;
  codigo_indicacao: string;
  bonus: number;
  status: "pendente" | "aprovado" | "pago";
  created_at: string;
  updated_at: string;
  indicado_nome?: string | null;
  indicado_email?: string | null;
  cliente?: {
    nome: string;
    whatsapp: string;
  };
}

export function useIndicacoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch indicações with client details
  const { data: indicacoes = [], isLoading } = useQuery({
    queryKey: ["indicacoes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("indicacoes")
        .select(`
          *,
          cliente:clientes!cliente_indicado_id (nome, whatsapp)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Indicacao[];
    },
  });

  // Fetch referred users from indicacoes table (system referrals)
  const { data: clientesIndicados = [] } = useQuery({
    queryKey: ["indicacoes-clientes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get indicacoes with linked client details
      const { data: inds, error: indError } = await supabase
        .from("indicacoes")
        .select("cliente_indicado_id, created_at")
        .eq("user_id", user.id)
        .not("cliente_indicado_id", "is", null);

      if (indError) throw indError;
      if (!inds?.length) return [];

      const clienteIds = inds.map(i => i.cliente_indicado_id).filter(Boolean) as string[];
      
      const { data: clientes, error: cError } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp, plano, created_at")
        .in("id", clienteIds);

      if (cError) throw cError;

      return (clientes || []).map(c => ({
        ...c,
        indicacao_created_at: inds.find(i => i.cliente_indicado_id === c.id)?.created_at || c.created_at,
      }));
    },
  });

  // Fetch paid withdrawals
  const { data: saquesPagos = [] } = useQuery({
    queryKey: ["saques-pagos"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("saques_indicacao")
        .select("valor")
        .eq("user_id", user.id)
        .eq("status", "pago");
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats - saldo = all approved/paid bonuses minus paid withdrawals
  const totalBonusGanho = indicacoes
    .filter((i) => i.status === "aprovado" || i.status === "pago")
    .reduce((acc, i) => acc + Number(i.bonus), 0);

  const totalSaquesPagos = saquesPagos.reduce((acc, s) => acc + Number(s.valor), 0);

  const stats = {
    totalIndicacoes: indicacoes.length,
    saldoDisponivel: totalBonusGanho - totalSaquesPagos,
    resgatesPagos: totalSaquesPagos,
  };

  const updateIndicacao = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("indicacoes")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicacoes"] });
      toast({ title: "Indicação atualizada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  return {
    indicacoes,
    clientesIndicados,
    stats,
    isLoading,
    updateIndicacao,
  };
}
