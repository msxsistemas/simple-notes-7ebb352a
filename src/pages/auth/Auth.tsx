import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';
import { Eye, EyeOff, Mail, Lock, User as UserIcon, Phone, Gift, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { InlineError } from '@/components/ui/inline-error';
import { useSystemLogo } from '@/hooks/useSystemLogo';
import logoMsx from '@/assets/logo-msx.png';

export default function Auth() {
  const logoUrl = useSystemLogo();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedEmail] = useState(() => localStorage.getItem('savedEmail') || '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get referral code from URL
  const referralCode = searchParams.get('ref') || '';

  const processReferralIfNeeded = async (u: User) => {
    const ref = String(u.user_metadata?.referral_code ?? '').trim();
    if (!ref) return;

    const key = `referral_processed:${u.id}`;
    if (localStorage.getItem(key) === '1') return;

    try {
      const resp = await supabase.functions.invoke('process-signup-referral', { body: {} });
      if (resp.error) throw resp.error;
      if (resp.data?.success) {
        localStorage.setItem(key, '1');
      }
    } catch (err) {
      // Não bloquear o fluxo de login por causa de referral
      console.warn('Falha ao processar referral pós-login:', err);
    }
  };

  useEffect(() => {
    document.title = isSignUp ? 'Cadastro | Gestor Msx' : 'Entrar | Gestor Msx';
  }, [isSignUp]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsRecovery(true);
      return;
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUser(user);
        await processReferralIfNeeded(user);
        const planParam = searchParams.get('plan');
        navigate(planParam ? `/ativar-plano?plan=${planParam}` : '/dashboard');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      } else if (session?.user && !isRecovery) {
        setUser(session.user);
        await processReferralIfNeeded(session.user);
        const planParam = searchParams.get('plan');
        navigate(planParam ? `/ativar-plano?plan=${planParam}` : '/dashboard');
      } else if (!session) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isRecovery]);

  // If there's a referral code, default to signup
  useEffect(() => {
    if (referralCode) {
      setIsSignUp(true);
    }
  }, [referralCode]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('signup-name') as string;
    const email = formData.get('signup-email') as string;
    const whatsapp = formData.get('signup-whatsapp') as string;
    const password = formData.get('signup-password') as string;
    const confirmPassword = formData.get('confirm-password') as string;
    const refCode = formData.get('referral-code') as string;

    if (password !== confirmPassword) {
      setAuthError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // Check IP limit before signup
      const ipCheck = await supabase.functions.invoke('check-registration-ip', {
        body: { action: 'check' },
      });
      if (ipCheck.data && !ipCheck.data.allowed) {
        setAuthError('Limite de cadastros atingido para este IP. Máximo de 2 contas permitidas.');
        setLoading(false);
        return;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: name.trim(),
            whatsapp: whatsapp?.trim() || null,
            referral_code: refCode?.trim() || null,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Tente fazer login.');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          toast.error('Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.');
        } else {
          toast.error(error.message);
        }
      } else {
        // Record IP after successful signup
        if (signUpData?.user?.id) {
          await supabase.functions.invoke('check-registration-ip', {
            body: { action: 'register', user_id: signUpData.user.id },
          }).catch(() => {}); // don't block signup
        }
        toast.success('Conta criada com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('signin-email') as string;
    const password = formData.get('signin-password') as string;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Email não confirmado. Verifique sua caixa de entrada.');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          toast.error('Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.');
        } else if (error.message.includes('User not found')) {
          toast.error('Usuário não encontrado.');
        } else {
          toast.error('Erro ao fazer login. Tente novamente.');
        }
      } else {
        localStorage.setItem('savedEmail', email);
        toast.success('Login realizado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetLoading(true);

    // resetEmail is validated by required attribute

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
        setResetDialogOpen(false);
        setResetEmail('');
      }
    } catch (error) {
      toast.error('Erro ao enviar email de recuperação');
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // newPassword is validated by required attribute

    if (newPassword.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setAuthError('As senhas não coincidem');
      setLoading(false);
      return;
    }
    setAuthError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes('New password should be different from the old password')) {
          errorMessage = 'A nova senha deve ser diferente da senha anterior';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        }
        toast.error(errorMessage);
      } else {
        toast.success('Senha atualizada com sucesso!');
        setIsRecovery(false);
        setNewPassword('');
        setConfirmNewPassword('');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  // Password recovery form
  if (isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden shadow-lg">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Redefinir Senha</h1>
              <p className="text-muted-foreground text-sm mt-1">Digite sua nova senha abaixo</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-secondary border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme sua nova senha"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-secondary border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <InlineError message={authError} />
              <Button 
                type="submit" 
                className="w-full h-12 text-base bg-gradient-to-r from-[hsl(280,70%,50%)] to-[hsl(199,89%,48%)] hover:from-[hsl(280,70%,45%)] hover:to-[hsl(199,89%,43%)] text-white border-0" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    Atualizar Senha
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background relative">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12" style={{ background: 'linear-gradient(160deg, hsl(var(--background)) 0%, hsl(220 25% 14%) 50%, hsl(220 30% 10%) 100%)' }}>
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-primary/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-primary/5" />
        </div>

        <div className="relative z-10 w-full max-w-2xl text-center flex flex-col items-center px-6">
          <div className="w-96 h-64 -mb-2 drop-shadow-2xl">
            <img src={logoMsx} alt="Logo MSX" className="w-full h-full object-contain" />
          </div>

          <div className="flex items-center gap-10 text-base text-muted-foreground/70 mb-8">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Automação</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2.5">
              <Mail className="h-5 w-5 text-primary" />
              <span>Cobranças</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-primary" />
              <span>Segurança</span>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-5 w-full">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7 text-left hover:bg-white/[0.07] transition-colors">
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                <UserIcon className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-foreground/90">Gestão de Clientes</h4>
              <p className="text-sm text-muted-foreground/50 mt-2 leading-relaxed">Cadastre e organize todos os seus clientes</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7 text-left hover:bg-white/[0.07] transition-colors">
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-foreground/90">WhatsApp</h4>
              <p className="text-sm text-muted-foreground/50 mt-2 leading-relaxed">Envios automáticos e em massa</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7 text-left hover:bg-white/[0.07] transition-colors">
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-foreground/90">Renovações</h4>
              <p className="text-sm text-muted-foreground/50 mt-2 leading-relaxed">Renovação automática de serviços</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7 text-left hover:bg-white/[0.07] transition-colors">
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-foreground/90">Indicações</h4>
              <p className="text-sm text-muted-foreground/50 mt-2 leading-relaxed">Programa de indicações integrado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-md">

          <div className="bg-card border border-border rounded-3xl p-8 lg:p-10 shadow-2xl">
            {/* Logo inside modal on mobile */}
            <div className="lg:hidden flex justify-center -mt-2 -mb-1">
              <div className="w-48 h-28">
                <img src={logoMsx} alt="Logo MSX" className="w-full h-full object-contain" />
              </div>
            </div>
            {!isSignUp ? (
              // Login Form
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
                  <p className="text-muted-foreground text-sm">Acesse sua conta para continuar</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="signin-email"
                        type="email"
                        placeholder="seu@email.com"
                        defaultValue={savedEmail}
                        className="pl-11 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password" className="text-sm font-medium">Senha</Label>
                      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                        <DialogTrigger asChild>
                          <button type="button" className="text-xs text-primary hover:underline font-medium">
                            Esqueceu a senha?
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Recuperar senha</DialogTitle>
                            <DialogDescription>
                              Digite seu email para receber o link de recuperação.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handlePasswordReset} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="reset-email">Email</Label>
                              <Input
                                id="reset-email"
                                type="email"
                                placeholder="seu@email.com"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="h-12 rounded-xl"
                                required
                              />
                            </div>
                            <Button 
                              type="submit" 
                              className="w-full h-12 rounded-xl bg-gradient-to-r from-[hsl(280,70%,50%)] to-[hsl(199,89%,48%)] hover:from-[hsl(280,70%,45%)] hover:to-[hsl(199,89%,43%)] text-white border-0" 
                              disabled={resetLoading}
                            >
                              {resetLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                'Enviar link'
                              )}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Sua senha"
                        className="pl-11 pr-11 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary/50 transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>


                  <Button
                    type="submit" 
                    className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-[hsl(280,70%,50%)] to-[hsl(199,89%,48%)] hover:from-[hsl(280,70%,45%)] hover:to-[hsl(199,89%,43%)] text-white border-0 font-medium shadow-lg shadow-[hsl(280,70%,50%)]/20" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Separator */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-4 text-muted-foreground font-medium">OU</span>
                  </div>
                </div>

                {/* Create account link */}
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">
                    Ainda não tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Criar conta gratuita
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              // Signup Form
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Cadastrar</h2>
                  <p className="text-muted-foreground text-sm">Preencha seus dados para começar</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        name="signup-name"
                        type="text"
                        placeholder="Seu nome"
                        className="pl-10 h-12 bg-secondary border-border"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        name="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-12 bg-secondary border-border"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-whatsapp">WhatsApp (opcional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-whatsapp"
                        name="signup-whatsapp"
                        type="tel"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        className="pl-10 h-12 bg-secondary border-border"
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length > 11) value = value.slice(0, 11);
                          if (value.length > 7) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                          } else if (value.length > 2) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                          } else if (value.length > 0) {
                            value = `(${value}`;
                          }
                          e.target.value = value;
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 pr-10 h-12 bg-secondary border-border"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        name="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirme sua senha"
                        className="pl-10 pr-10 h-12 bg-secondary border-border"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referral-code">Código de indicação (opcional)</Label>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="referral-code"
                        name="referral-code"
                        type="text"
                        placeholder="REF_XXXXXX"
                        defaultValue={referralCode}
                        className="pl-10 h-12 bg-secondary border-border"
                      />
                    </div>
                  </div>

                  <InlineError message={authError} />

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base bg-gradient-to-r from-[hsl(280,70%,50%)] to-[hsl(199,89%,48%)] hover:from-[hsl(280,70%,45%)] hover:to-[hsl(199,89%,43%)] text-white border-0" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        Criar conta
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Separator */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-4 text-muted-foreground">OU</span>
                  </div>
                </div>

                {/* Login link */}
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">
                    Já tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="text-primary hover:underline font-medium"
                    >
                      Fazer login
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        {/* Footer */}
        <div className="text-center py-4 flex-shrink-0 space-y-1.5">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/50">
            <a href="/termos-de-servico" className="hover:text-muted-foreground transition-colors">Termos de Serviço</a>
            <span>•</span>
            <a href="/politica-de-privacidade" className="hover:text-muted-foreground transition-colors">Política de Privacidade</a>
          </div>
          <p className="text-xs text-muted-foreground/50">
            2026© Todos os direitos reservados Gestor MSX
          </p>
        </div>
      </div>
    </div>
  );
}
