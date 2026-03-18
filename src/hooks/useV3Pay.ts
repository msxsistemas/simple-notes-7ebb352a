import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export function useV3Pay() {
  const { user } = useCurrentUser();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    checkConfig();
  }, [user?.id]);

  const checkConfig = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('v3pay_config' as any)
      .select('is_configured')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsConfigured(!!(data as any)?.is_configured);
  };

  const configureV3Pay = async (apiToken: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/v3pay-integration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "configure", apiToken }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || "Erro ao configurar V3Pay");
      }

      setIsConfigured(true);
      toast.success("V3Pay configurado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao configurar V3Pay");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { isConfigured, loading, configureV3Pay, checkConfig };
}
