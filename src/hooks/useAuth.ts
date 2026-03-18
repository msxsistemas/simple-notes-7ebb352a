import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logPainel } from "@/utils/logger";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (_event === 'SIGNED_IN') {
        logPainel("Login realizado", "success");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Erro ao sair",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Clear sensitive data from localStorage on logout
        localStorage.removeItem('whatsapp_session_data');
        localStorage.removeItem('whatsapp_session');
        localStorage.removeItem('whatsapp_messages');
        localStorage.removeItem('auth_token');
        // Clear any Evolution API session data
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('evolution_session_') || key.startsWith('evolution_config_')) {
            localStorage.removeItem(key);
          }
        });

        logPainel("Logout realizado", "info");
        toast({
          title: "Logout realizado",
          description: "Você foi desconectado com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
}