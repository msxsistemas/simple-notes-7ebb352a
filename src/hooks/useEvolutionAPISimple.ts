import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { logPainel } from '@/utils/logger';

interface EvolutionSession {
  status: 'connecting' | 'connected' | 'disconnected';
  qrCode?: string;
  phoneNumber?: string;
  profileName?: string;
  profilePicture?: string;
}

export const useEvolutionAPISimple = () => {
  const { userId } = useCurrentUser();
  const [session, setSession] = useState<EvolutionSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const failCountRef = useRef(0);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, []);

  // Carregar sessão do banco de dados ao montar - apenas uma vez quando userId estiver disponível
  useEffect(() => {
    // Se já carregou, não carrega novamente
    if (hasLoadedRef.current) return;

    // Função para carregar do banco
    const loadSessionFromDB = async (uid: string) => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar sessão do banco:', error);
        } else if (data && data.status === 'connected') {
          setSession({
            status: 'connected',
            phoneNumber: data.phone_number || undefined,
            profileName: data.device_name || undefined,
          });
        }
      } catch (e) {
        console.error('Erro ao carregar sessão:', e);
      } finally {
        setHydrated(true);
        hasLoadedRef.current = true;
      }
    };

    // Se tem userId, carrega do banco
    if (userId) {
      loadSessionFromDB(userId);
    } else {
      // Verificar diretamente se há usuário logado
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          loadSessionFromDB(user.id);
        } else {
          setHydrated(true);
          hasLoadedRef.current = true;
        }
      });
    }
  }, [userId]);

  const callEvolutionAPI = useCallback(async (action: string, extraData?: any) => {
    const { data, error } = await supabase.functions.invoke('evolution-api', {
      body: { action, ...extraData },
    });

    if (error) {
      console.error('Evolution API error:', error);
      throw new Error(error.message || 'Erro ao comunicar com EVO API');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }, []);

  // Salvar sessão no banco de dados quando mudar
  useEffect(() => {
    if (!userId || !hydrated || savingRef.current) return;

    const saveSessionToDB = async () => {
      savingRef.current = true;
      try {
        if (session?.status === 'connected') {
          // Upsert: inserir ou atualizar
          const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({
              user_id: userId,
              session_id: `user_${userId}`,
              status: 'connected',
              phone_number: session.phoneNumber || null,
              device_name: session.profileName || null,
              last_activity: new Date().toISOString(),
            }, {
              onConflict: 'session_id',
            });

          if (error) {
            console.error('Erro ao salvar sessão no banco:', error);
          }
        } else if (session === null) {
          // Remover sessão do banco
          await supabase
            .from('whatsapp_sessions')
            .delete()
            .eq('user_id', userId);
        }
      } catch (e) {
        console.error('Erro ao salvar sessão:', e);
      } finally {
        savingRef.current = false;
      }
    };

    saveSessionToDB();
  }, [userId, session, hydrated]);

  // Não faz polling automático de status - sessão só muda via ações do usuário

  const checkStatus = useCallback(async (showToast = true, updateConnecting = true) => {
    if (!userId) return null;

    if (updateConnecting) setConnecting(true);
    try {
      const data = await callEvolutionAPI('status');
      
      if (data.status === 'connected') {
        setSession({
          status: 'connected',
          phoneNumber: data.phoneNumber,
          profileName: data.profileName,
          profilePicture: data.profilePicture,
        });

        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        if (showToast) toast.success('WhatsApp conectado!');
      } else if (data.status === 'connecting') {
        // Preserve existing qrCode during polling - don't overwrite it
        setSession(prev => prev?.qrCode ? prev : { status: 'connecting' });
      } else {
        // If we're currently showing a QR code (connecting phase), don't clear it
        // The Evolution API may return "disconnected" while waiting for scan
        setSession(prev => {
          if (prev?.qrCode && statusIntervalRef.current) {
            // Keep QR code visible during polling
            return prev;
          }
          return null;
        });
        if (showToast) toast.info('WhatsApp desconectado');
      }

      return data.status;
    } catch (error) {
      console.error('Error checking status:', error);
      if (showToast) toast.error('Erro ao verificar status');
      return null;
    } finally {
      if (updateConnecting) setConnecting(false);
    }
  }, [userId, callEvolutionAPI]);

  const startStatusCheck = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }
    failCountRef.current = 0;

    const interval = setInterval(async () => {
      const status = await checkStatus(false, false);
      if (status === 'connected') {
        clearInterval(interval);
        statusIntervalRef.current = null;
        failCountRef.current = 0;
        toast.success('WhatsApp conectado com sucesso!');
        logPainel("WhatsApp conectado via EVO API", "success");
      } else {
        failCountRef.current += 1;
        // If stuck in connecting for 90s (30 polls * 3s), warn user
        if (failCountRef.current >= 30) {
          clearInterval(interval);
          statusIntervalRef.current = null;
          failCountRef.current = 0;
          toast.error('QR Code expirou. Clique em "Novo QR" para tentar novamente.');
          setSession(prev => prev?.qrCode ? { status: 'connecting' } : null);
        }
      }
    }, 3000);

    statusIntervalRef.current = interval;

    // Stop after 2 minutes
    setTimeout(() => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    }, 120000);
  }, [checkStatus]);

  const connect = useCallback(async () => {
    if (!userId) {
      toast.error('Você precisa estar logado');
      return;
    }

    setConnecting(true);
    try {
      const data = await callEvolutionAPI('connect');
      
      if (data.status === 'connected') {
        setSession({
          status: 'connected',
          phoneNumber: data.phoneNumber,
          profileName: data.profileName,
        });
        toast.success('WhatsApp já está conectado!');
      } else if (data.status === 'connecting' && data.qrCode) {
        setSession({
          status: 'connecting',
          qrCode: data.qrCode,
        });
        toast.success('QR Code gerado! Escaneie com seu WhatsApp');
        startStatusCheck();
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error: any) {
      console.error('Error connecting:', error);
      toast.error(error.message || 'Erro ao conectar');
    } finally {
      setConnecting(false);
    }
  }, [userId, callEvolutionAPI, startStatusCheck]);

  const disconnect = useCallback(async () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    try {
      await callEvolutionAPI('disconnect');
      setSession(null);
      toast.success('WhatsApp desconectado com sucesso!');
      logPainel("WhatsApp desconectado", "warning");
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      setSession(null);
      toast.success('WhatsApp desconectado');
    }
  }, [callEvolutionAPI]);

  // Função para normalizar número de telefone com código do país
  const normalizePhoneNumber = (phone: string): string => {
    // Remove tudo que não é dígito
    const digitsOnly = phone.replace(/\D/g, '');
    // Se não começar com 55, adiciona
    if (!digitsOnly.startsWith('55') && digitsOnly.length >= 10) {
      return '55' + digitsOnly;
    }
    return digitsOnly;
  };

  const sendMessage = useCallback(async (phone: string, message: string) => {
    if (!userId) {
      throw new Error('Você precisa estar logado');
    }

    // Normalizar número antes de enviar
    const normalizedPhone = normalizePhoneNumber(phone);

    setLoading(true);
    try {
      const data = await callEvolutionAPI('sendMessage', { phone: normalizedPhone, message });
      
      if (data.success) {
        toast.success('Mensagem enviada com sucesso!');
        return data.data;
      } else {
        if (data.connectionLost) {
          setSession(null);
        }
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [userId, callEvolutionAPI]);

  return {
    session,
    loading,
    connecting,
    hydrated,
    connect,
    disconnect,
    checkStatus,
    sendMessage,
    isConnected: session?.status === 'connected',
  };
};
