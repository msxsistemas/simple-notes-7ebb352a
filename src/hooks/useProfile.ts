import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  nome_completo: string | null;
  nome_empresa: string | null;
  telefone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create profile if doesn't exist (for existing users)
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ user_id: userId, nome_completo: '', nome_empresa: '' })
          .select()
          .single();
        if (!insertError) setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateProfile = async (updates: Partial<Pick<Profile, 'nome_completo' | 'nome_empresa' | 'telefone' | 'avatar_url'>>) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas.' });
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      toast({ title: 'Erro', description: 'Não foi possível atualizar o perfil.', variant: 'destructive' });
    }
  };

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, loading, updateProfile, refresh: fetchProfile };
}
