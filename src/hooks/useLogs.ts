import { supabase } from "@/integrations/supabase/client";

type LogTipo = "info" | "success" | "warning" | "error";

export const useLogs = () => {
  const registrarLogPainel = async (acao: string, tipo: LogTipo = "info") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("logs_painel").insert({
        user_id: user.id,
        acao,
        tipo,
      });
    } catch (error) {
      console.error("Erro ao registrar log do painel:", error);
    }
  };

  return {
    registrarLogPainel,
  };
};
