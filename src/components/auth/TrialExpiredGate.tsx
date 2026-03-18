import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';

interface TrialExpiredGateProps {
  daysLeft: number | null;
  isTrial: boolean;
}

export default function TrialExpiredGate({ daysLeft, isTrial }: TrialExpiredGateProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/30 bg-card">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {isTrial ? 'Período de teste encerrado' : 'Assinatura expirada'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            {isTrial
              ? 'Seu período de teste gratuito de 7 dias expirou. Para continuar utilizando o sistema, escolha um plano.'
              : 'Sua assinatura expirou. Renove seu plano para continuar utilizando o sistema.'
            }
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
            <Clock className="h-4 w-4" />
            <span>Seus dados estão seguros e serão mantidos.</span>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full h-12 text-base bg-primary hover:bg-primary/90"
              onClick={() => navigate('/planos-disponiveis')}
            >
              Ver planos disponíveis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={async () => {
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.signOut();
                navigate('/auth');
              }}
            >
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
