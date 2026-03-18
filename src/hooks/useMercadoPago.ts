import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export function useMercadoPago() {
  const { user } = useCurrentUser();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    checkConfig();
  }, [user?.id]);

  const checkConfig = async () => {
    if (!user?.id) return;
    setChecking(true);
    try {
      const { data } = await supabase
        .from('mercadopago_config')
        .select('is_configured')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsConfigured(!!(data as any)?.is_configured);
    } catch (e) {
      console.error('Erro ao verificar config MP:', e);
    } finally {
      setChecking(false);
    }
  };

  const configure = async (accessToken: string, publicKey?: string) => {
    if (!accessToken.trim()) {
      toast.error("Por favor, insira o Access Token do Mercado Pago");
      throw new Error("Access Token vazio");
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      const webhookUrl = `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/mercadopago-integration`;

      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/mercadopago-integration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "configure",
            accessToken: accessToken.trim(),
            publicKey: publicKey?.trim() || "",
            webhookUrl,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || "Erro ao configurar Mercado Pago");
      }

      setIsConfigured(true);
      toast.success("Mercado Pago configurado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao configurar Mercado Pago");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await supabase
        .from('mercadopago_config')
        .update({ is_configured: false } as any)
        .eq('user_id', user.id);
      setIsConfigured(false);
      toast.success("Mercado Pago desconectado");
    } catch (e: any) {
      toast.error("Erro ao desconectar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return { isConfigured, loading, checking, configure, disconnect, checkConfig };
}
