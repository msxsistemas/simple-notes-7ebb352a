import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export const useWoovi = () => {
  const { user } = useCurrentUser();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkConfig = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('woovi_config' as any)
      .select('is_configured')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsConfigured(!!(data as any)?.is_configured);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    checkConfig();
  }, [user?.id, checkConfig]);

  const configureWoovi = async (appId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/woovi-integration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "configure", app_id: appId }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || !result.ok) {
        throw new Error(result.error || "Erro ao configurar Woovi");
      }

      setIsConfigured(true);
      toast.success("Woovi configurado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao configurar Woovi");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { isConfigured, loading, configureWoovi, checkConfig };
};
