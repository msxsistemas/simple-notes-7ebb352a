import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Notificacao {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  created_at: string;
}

export function useNotificacoes(userId: string | null) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const fetchNotificacoes = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotificacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = async (id: string) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId).eq('lida', false);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notificacoes').delete().eq('id', id);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => { fetchNotificacoes(); }, [fetchNotificacoes]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notificacoes-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${userId}` }, (payload) => {
        setNotificacoes(prev => [payload.new as Notificacao, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { notificacoes, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, refresh: fetchNotificacoes };
}
