import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AfiliadoRede {
  id: string;
  user_id: string;
  afiliado_user_id: string | null;
  afiliado_nome: string | null;
  afiliado_email: string | null;
  cliente_id: string | null;
  pai_id: string | null;
  nivel: number;
  codigo_convite: string;
  comissao_tipo: string;
  comissao_valor: number;
  comissao_recorrente: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  filhos?: AfiliadoRede[];
}

export interface AfiliadosNiveisConfig {
  id: number;
  ativo: boolean;
  n1_tipo: string;
  n1_valor: number;
  n2_tipo: string;
  n2_valor: number;
  n3_tipo: string;
  n3_valor: number;
  updated_at: string;
}

export interface AfiliadoUserConfig {
  afiliados_liberado: boolean;
  comissao_tipo: string;
  comissao_valor: number;
  codigo_convite: string | null;
}

export function useAfiliados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch global config
  const { data: niveisConfig } = useQuery({
    queryKey: ["afiliados-niveis-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("afiliados_niveis_config")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as unknown as AfiliadosNiveisConfig;
    },
  });

  // Fetch user's affiliate config (includes invite code)
  const { data: userConfig } = useQuery({
    queryKey: ["afiliado-user-config"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("afiliados_usuarios_config")
        .select("afiliados_liberado, comissao_tipo, comissao_valor, codigo_convite")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AfiliadoUserConfig | null;
    },
  });

  // Fetch user's affiliate network
  const { data: rede = [], isLoading } = useQuery({
    queryKey: ["afiliados-rede"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("afiliados_rede")
        .select("*")
        .eq("user_id", user.id)
        .order("nivel", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any[]) as AfiliadoRede[];
    },
  });

  // Fetch withdrawal history
  const { data: saques = [] } = useQuery({
    queryKey: ["afiliados-saques"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("saques_indicacao")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch commissions from afiliados_comissoes
  const { data: comissoes = [] } = useQuery({
    queryKey: ["afiliados-comissoes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("afiliados_comissoes" as any)
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Count valid referrals (affiliates who have an active subscription)
  const { data: indicacoesValidas = 0 } = useQuery({
    queryKey: ["afiliados-indicacoes-validas", rede.map(a => a.afiliado_user_id).join(",")],
    queryFn: async () => {
      const afiliadoUserIds = rede
        .filter((a) => a.afiliado_user_id)
        .map((a) => a.afiliado_user_id!);
      if (afiliadoUserIds.length === 0) return 0;

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .in("user_id", afiliadoUserIds)
        .eq("status", "ativa");
      if (error) throw error;
      return data?.length || 0;
    },
    enabled: rede.length > 0,
  });

  // Compute financial stats
  const totalComissoes = comissoes.reduce((sum: number, c: any) => sum + Number(c.comissao_valor), 0);

  const resgatesPagos = saques
    .filter((s: any) => s.status === "pago")
    .reduce((sum: number, s: any) => sum + Number(s.valor), 0);

  const resgatePendente = saques
    .filter((s: any) => s.status === "pendente")
    .reduce((sum: number, s: any) => sum + Number(s.valor), 0);

  const saldoDisponivel = Math.max(0, totalComissoes - resgatesPagos - resgatePendente);

  // Request withdrawal
  const solicitarResgate = useMutation({
    mutationFn: async ({ valor, chavePix }: { valor: number; chavePix: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (valor < 100) throw new Error("Valor mínimo para saque é R$ 100,00");
      if (valor > saldoDisponivel) throw new Error("Saldo insuficiente");

      const { data, error } = await supabase
        .from("saques_indicacao")
        .insert({
          user_id: user.id,
          valor,
          chave_pix: chavePix,
          status: "pendente",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["afiliados-saques"] });
      toast({ title: "Resgate solicitado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Update affiliate commission
  const updateAfiliado = useMutation({
    mutationFn: async ({
      id, comissao_tipo, comissao_valor, comissao_recorrente, ativo,
    }: {
      id: string; comissao_tipo?: string; comissao_valor?: number; comissao_recorrente?: boolean; ativo?: boolean;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (comissao_tipo !== undefined) updates.comissao_tipo = comissao_tipo;
      if (comissao_valor !== undefined) updates.comissao_valor = comissao_valor;
      if (comissao_recorrente !== undefined) updates.comissao_recorrente = comissao_recorrente;
      if (ativo !== undefined) updates.ativo = ativo;

      const { data, error } = await supabase
        .from("afiliados_rede")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["afiliados-rede"] });
      toast({ title: "Afiliado atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete affiliate (removes from network only, not the user account)
  const removeAfiliado = useMutation({
    mutationFn: async (id: string) => {
      // First delete any N3 children that reference this affiliate as parent
      const { error: childError } = await supabase
        .from("afiliados_rede")
        .delete()
        .eq("pai_id", id);
      if (childError) throw childError;

      // Then delete the affiliate itself
      const { error } = await supabase
        .from("afiliados_rede")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["afiliados-rede"] });
      toast({ title: "Afiliado removido!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Build tree structure
  const redeN2 = rede.filter((a) => a.nivel === 2);
  const redeN3 = rede.filter((a) => a.nivel === 3);

  const tree = redeN2.map((n2) => ({
    ...n2,
    filhos: redeN3.filter((n3) => n3.pai_id === n2.id),
  }));

  return {
    rede,
    tree,
    redeN2,
    redeN3,
    niveisConfig,
    userConfig,
    isLoading,
    updateAfiliado,
    removeAfiliado,
    // Financial
    saldoDisponivel,
    indicacoesValidas,
    resgatesPagos,
    saques,
    solicitarResgate,
  };
}
