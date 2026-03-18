import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string;
  inicio: string;
  expira_em: string | null;
}

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Check if user is admin — admins are always active
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminRole) {
        setIsAdmin(true);
        setIsTrialExpired(false);
        setDaysLeft(null);
        // Still fetch subscription for display but never block
        const { data } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setSubscription(data);
        setLoading(false);
        return;
      }

      // Fetch existing subscription
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubscription(data);
        evaluateStatus(data);
      } else {
        // No subscription — create trial
        await createTrial(userId);
      }
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createTrial = async (uid: string) => {
    // Get trial days from system_config
    let trialDays = 7;
    try {
      const { data: config } = await supabase
        .from('system_config')
        .select('trial_dias')
        .limit(1)
        .maybeSingle();
      if (config?.trial_dias) trialDays = config.trial_dias;
    } catch {}

    const inicio = new Date();
    const expira = new Date(inicio);
    expira.setDate(expira.getDate() + trialDays);

    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: uid,
        status: 'trial',
        inicio: inicio.toISOString(),
        expira_em: expira.toISOString(),
        plan_id: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar trial:', error);
      return;
    }

    setSubscription(data);
    evaluateStatus(data);
  };

  const evaluateStatus = (sub: Subscription) => {
    const now = new Date();

    // Active paid plan
    if (sub.status === 'ativa') {
      setIsTrialExpired(false);
      if (sub.expira_em) {
        const diff = Math.ceil((new Date(sub.expira_em).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysLeft(diff);
      } else {
        setDaysLeft(null);
      }
      return;
    }

    // Trial
    if (sub.status === 'trial') {
      if (sub.expira_em) {
        const expDate = new Date(sub.expira_em);
        const diff = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysLeft(diff);
        setIsTrialExpired(diff <= 0);
      }
      return;
    }

    // Expired or cancelled
    if (['expirada', 'cancelada'].includes(sub.status)) {
      setIsTrialExpired(true);
      setDaysLeft(0);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    subscription,
    loading,
    isTrialExpired,
    daysLeft,
    isTrial: subscription?.status === 'trial',
    isActive: isAdmin || subscription?.status === 'ativa',
    isAdmin,
    refresh: checkSubscription,
  };
}
