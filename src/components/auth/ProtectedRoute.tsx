import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import TrialExpiredGate from './TrialExpiredGate';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { loading: subLoading, isTrialExpired, daysLeft, isTrial } = useSubscription(user?.id ?? null);

  if (authLoading || subLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Bloquear acesso de admins ao painel de usuário comum
  if (isAdmin) {
    return <Navigate to="/role/admin/dashboard" replace />;
  }

  if (isTrialExpired) {
    return <TrialExpiredGate daysLeft={daysLeft} isTrial={isTrial} />;
  }

  return (
    <>
      {children ? <>{children}</> : <Outlet />}
    </>
  );
}

export default ProtectedRoute;
