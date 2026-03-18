import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, ArrowLeft, CreditCard, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import QRCodeSVG from 'react-qr-code';

interface SystemPlan {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  intervalo: string;
  limite_clientes: number | null;
  limite_mensagens: number | null;
  limite_whatsapp_sessions: number | null;
  limite_paineis: number | null;
  recursos: any;
}

interface PaymentData {
  pix_qr_code?: string;
  pix_copia_cola?: string;
  payment_url?: string;
  gateway_charge_id?: string;
  installment_id?: string;
  gateway?: string;
  status?: string;
}

export default function AtivarPlano() {
  const [plan, setPlan] = useState<SystemPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'paid' | 'error'>('idle');
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const pixReceivedRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');

  useEffect(() => {
    document.title = 'Ativar Plano | Gestor MSX';
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!planId) {
      navigate('/renovar-acesso');
      return;
    }
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('system_plans')
        .select('*')
        .eq('id', planId!)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Plano não encontrado');
        navigate('/planos-disponiveis');
        return;
      }
      setPlan(data);
    } catch (error) {
      console.error('Erro ao carregar plano:', error);
        toast.error('Erro ao carregar plano');
      navigate('/renovar-acesso');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!plan || !userId) return;
    setActivating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'activate', plan_id: plan.id }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Erro ao ativar plano');

      if (result.payment) {
        console.log('Payment data received:', JSON.stringify(result.payment));
        setPaymentData(result.payment);
        setPaymentStatus('pending');
        startPaymentPolling(result.payment.gateway_charge_id);
        // If Ciabra, always start polling for PIX data
        if (result.payment.installment_id) {
          setLoadingPix(true);
          startPixPolling(result.payment.installment_id);
        }
      } else if (result.activated) {
        // Direct activation (free plan or no gateway)
        setPaymentStatus('paid');
        toast.success('Plano ativado com sucesso!');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao ativar plano');
      setPaymentStatus('error');
    } finally {
      setActivating(false);
    }
  };

  const startPaymentPolling = (chargeId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'check-payment', charge_id: chargeId }),
          }
        );

        const result = await resp.json();
        if (result.paid) {
          setPaymentStatus('paid');
          clearInterval(interval);
          toast.success('Pagamento confirmado! Plano ativado.');
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      } catch {}
    }, 5000);

    // Stop polling after 15 minutes
    setTimeout(() => clearInterval(interval), 15 * 60 * 1000);
  };

  const startPixPolling = (installmentId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const resp = await fetch(
          `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/activate-plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'get-pix', installment_id: installmentId }),
          }
        );

        const result = await resp.json();
        if (result.pix_copia_cola && !pixReceivedRef.current) {
          pixReceivedRef.current = true;
          setPaymentData(prev => prev ? {
            ...prev,
            pix_copia_cola: result.pix_copia_cola,
            pix_qr_code: result.pix_qr_code,
          } : prev);
          setLoadingPix(false);
          clearInterval(interval);
        }
      } catch {}
    }, 4000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setLoadingPix(false);
    }, 5 * 60 * 1000);
  };

  const copyPixCode = () => {
    if (paymentData?.pix_copia_cola) {
      navigator.clipboard.writeText(paymentData.pix_copia_cola);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getIntervalLabel = (intervalo: string) => {
    const labels: Record<string, string> = { mensal: '/mês', trimestral: '/trimestre', semestral: '/semestre', anual: '/ano' };
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando plano...</p>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="space-y-6">
        {paymentStatus === 'paid' ? (
          <Card className="border-green-500/30">
            <CardContent className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Plano ativado!</h2>
              <p className="text-muted-foreground">Redirecionando para o painel...</p>
            </CardContent>
          </Card>
        ) : paymentStatus === 'pending' && paymentData ? (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-4 py-1.5 text-sm font-medium mb-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pagamento pendente
              </div>
              <h1 className="text-2xl font-bold text-foreground">Escaneie o QR Code para pagar</h1>
              <p className="text-muted-foreground text-sm">
                Ou copie o código PIX abaixo
              </p>
            </div>

            <Card className="border-primary/10 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 text-center border-b border-border/50">
                <p className="text-sm text-muted-foreground">Plano selecionado</p>
                <h2 className="text-xl font-bold text-foreground">{plan.nome}</h2>
                <p className="text-2xl font-bold text-primary mt-1">
                  {formatCurrency(plan.valor)}
                  <span className="text-sm font-normal text-muted-foreground">{getIntervalLabel(plan.intervalo)}</span>
                </p>
              </div>

              <CardContent className="p-6 space-y-6">
                {!paymentData.pix_copia_cola && !paymentData.pix_qr_code ? (
                  <div className="flex flex-col items-center gap-4 py-8 min-h-[280px] justify-center">
                    <div className="w-48 h-48 rounded-2xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {loadingPix ? 'Gerando QR Code PIX...' : 'Aguardando dados do PIX...'}
                    </p>
                  </div>
                ) : paymentData.pix_qr_code ? (
                  <div className="flex justify-center py-4">
                    <div className="bg-white p-5 rounded-2xl shadow-lg ring-1 ring-black/5">
                      <img
                        src={`data:image/png;base64,${paymentData.pix_qr_code}`}
                        alt="QR Code PIX"
                        className="w-52 h-52"
                      />
                    </div>
                  </div>
                ) : paymentData.pix_copia_cola ? (
                  <div className="flex justify-center py-4">
                    <div className="bg-white p-5 rounded-2xl shadow-lg ring-1 ring-black/5">
                      <QRCodeSVG value={paymentData.pix_copia_cola} size={208} />
                    </div>
                  </div>
                ) : null}

                {paymentData.pix_copia_cola && (
                  <div className="space-y-3">
                    <div className="bg-muted/60 rounded-xl p-4 border border-border/50">
                      <code className="text-sm break-all text-muted-foreground leading-relaxed block overflow-hidden max-h-[3.25rem]">
                        {paymentData.pix_copia_cola}
                      </code>
                    </div>
                    <Button
                      className="w-full"
                      onClick={copyPixCode}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Copiado!
                        </>
                      ) : (
                        'PIX Copia e Cola'
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2.5 text-sm text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-medium">Aguardando confirmação do pagamento...</span>
                </div>
              </CardContent>
            </Card>

            <Button variant="ghost" className="w-full" onClick={() => navigate('/renovar-acesso')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar aos planos
            </Button>
          </div>
        ) : paymentStatus === 'error' ? (
          <Card className="border-destructive/30">
            <CardContent className="text-center py-12 space-y-4">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">Erro no pagamento</h2>
              <p className="text-muted-foreground">Ocorreu um erro ao processar o pagamento. Tente novamente.</p>
              <Button onClick={() => setPaymentStatus('idle')}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">Confirmar ativação</h1>
              <p className="text-muted-foreground">Revise os detalhes do plano antes de ativar</p>
            </div>

            <Card className="border-primary/20">
              <CardHeader className="text-center">
                <Badge variant="secondary" className="w-fit mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  Plano selecionado
                </Badge>
                <CardTitle className="text-xl">{plan.nome}</CardTitle>
                {plan.descricao && <CardDescription>{plan.descricao}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <span className="text-4xl font-bold text-foreground">
                    {formatCurrency(plan.valor)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {getIntervalLabel(plan.intervalo)}
                  </span>
                </div>

                <ul className="space-y-3">
                  {getFeatures(plan).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 shadow-lg"
                  onClick={handleActivate}
                  disabled={activating}
                >
                  {activating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : plan.valor === 0 ? (
                    'Ativar plano gratuito'
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Pagar e ativar plano
                    </>
                  )}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate('/renovar-acesso')}>
                  Escolher outro plano
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
    </div>
  );
}
