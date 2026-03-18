import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Cupom {
  id: string;
  user_id: string;
  codigo: string;
  desconto: number;
  tipo_desconto: "percentual" | "fixo";
  limite_uso: number | null;
  usos_atuais: number;
  validade: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CupomInsert {
  codigo: string;
  desconto: number;
  tipo_desconto: "percentual" | "fixo";
  limite_uso?: number | null;
  validade?: string | null;
  ativo?: boolean;
}

export function useCupons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cupons = [], isLoading, error } = useQuery({
    queryKey: ["cupons"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("cupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Cupom[];
    },
  });

  const createCupom = useMutation({
    mutationFn: async (cupom: CupomInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("cupons")
        .insert({ ...cupom, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cupons"] });
      toast({ title: "Cupom criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar cupom", description: error.message, variant: "destructive" });
    },
  });

  const updateCupom = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cupom> & { id: string }) => {
      const { data, error } = await supabase
        .from("cupons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cupons"] });
      toast({ title: "Cupom atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar cupom", description: error.message, variant: "destructive" });
    },
  });

  const deleteCupom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cupons"] });
      toast({ title: "Cupom excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir cupom", description: error.message, variant: "destructive" });
    },
  });

  return {
    cupons,
    isLoading,
    error,
    createCupom,
    updateCupom,
    deleteCupom,
  };
}
