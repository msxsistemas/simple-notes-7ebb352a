import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Star, Crown, ArrowRight } from 'lucide-react';

interface SystemPlan {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  intervalo: string;
  destaque: boolean;
  recursos: any;
  ordem: number;
}

export default function RenovarAcesso() {
  const [plans, setPlans] = useState<SystemPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useCurrentUser();
  const { subscription, daysLeft, isTrial, isActive } = useSubscription(userId);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Renovar Acesso | Gestor MSX';
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('system_plans')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getIntervalLabel = (intervalo: string) => {
    const labels: Record<string, string> = {
      mensal: '/mês',
      trimestral: '/trimestre',
      semestral: '/semestre',
      anual: '/ano',
    };
    return labels[intervalo] || `/${intervalo}`;
  };

  const getFeatures = (p: SystemPlan) => {
    const f: string[] = [];
    if (p.recursos && Array.isArray(p.recursos)) {
      p.recursos.forEach((r: any) => {
        if (typeof r === 'string') f.push(r);
        else if (r?.nome) f.push(r.nome);
      });
    }
    return f;
  };

  const getStatusBadge = () => {
    if (!subscription) return null;
    if (subscription.status === 'trial') {
      return (
        <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
          Trial {daysLeft !== null && daysLeft > 0 ? `• ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}` : '• Expirado'}
        </Badge>
      );
    }
    if (subscription.status === 'ativa') {
      return (
        <Badge variant="outline" className="border-success/50 bg-success/10 text-success">
          Ativo {daysLeft !== null ? `• ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}` : ''}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
        Expirado
      </Badge>
    );
  };

  const getExpirationDate = () => {
    if (!subscription?.expira_em) return null;
    return new Date(subscription.expira_em).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando planos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Current plan status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Seu Plano Atual</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusBadge()}
                {getExpirationDate() && (
                  <span className="text-xs text-muted-foreground">
                    Vence em {getExpirationDate()}
                  </span>
                )}
              </div>
            </div>
          </div>
          {(isTrial || (!isActive)) && (
            <span className="text-sm text-muted-foreground">
              Escolha um plano abaixo para continuar usando o sistema
            </span>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Escolha seu plano</h1>
        <p className="text-muted-foreground text-sm mt-1">Selecione o plano ideal para o seu negócio</p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all hover:shadow-lg ${
                plan.destaque
                  ? 'border-primary shadow-md shadow-primary/10 scale-[1.02]'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              {plan.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-md">
                    <Star className="h-3 w-3 mr-1" />
                    Mais popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{plan.nome}</CardTitle>
                {plan.descricao && (
                  <CardDescription className="text-sm">{plan.descricao}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="text-center">
                  <span className="text-4xl font-bold text-foreground">
                    {formatCurrency(plan.valor)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {getIntervalLabel(plan.intervalo)}
                  </span>
                </div>

                {getFeatures(plan).length > 0 && (
                  <ul className="space-y-2.5">
                    {getFeatures(plan).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className={`w-full h-11 ${
                    plan.destaque ? 'bg-primary hover:bg-primary/90 shadow-md' : ''
                  }`}
                  variant={plan.destaque ? 'default' : 'outline'}
                  onClick={() => navigate(`/ativar-plano?plan=${plan.id}`)}
                >
                  {plan.valor === 0 ? 'Ativar grátis' : 'Escolher plano'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
