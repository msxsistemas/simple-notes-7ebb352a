import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  User, Building2, Mail, Save, Shield, Calendar, CreditCard,
  LogOut, Lock, KeyRound, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { InlineError } from "@/components/ui/inline-error";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Perfil() {
  const { userId, user } = useCurrentUser();
  const { profile, loading, updateProfile } = useProfile(userId);
  const { subscription, daysLeft, isTrial, isActive } = useSubscription(userId);
  const { signOut } = useAuth();
  const { toast } = useToast();

  // Personal info
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Company info
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [enderecoEmpresa, setEnderecoEmpresa] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Password
  const [_currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNomeCompleto(profile.nome_completo || '');
      setNomeEmpresa(profile.nome_empresa || '');
      setTelefone(profile.telefone || '');
    }
  }, [profile]);

  const getInitials = () => {
    if (nomeCompleto) {
      const parts = nomeCompleto.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return nomeCompleto.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getStatusBadge = () => {
    if (isTrial) return <Badge variant="outline" className="border-amber-400/30 text-amber-400">Trial</Badge>;
    if (isActive) return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">Ativo</Badge>;
    return <Badge variant="destructive">Expirado</Badge>;
  };

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    await updateProfile({ nome_completo: nomeCompleto, telefone });
    setSavingPersonal(false);
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    await updateProfile({ nome_empresa: nomeEmpresa });
    setSavingCompany(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da senha não corresponde.');
      return;
    }
    setPasswordError(null);
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Senha atualizada', description: 'Sua senha foi alterada com sucesso.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Não foi possível atualizar a senha.', variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais, empresa e segurança.</p>
      </div>

      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/30 to-primary/10" />
        <CardContent className="relative pt-0 pb-6 px-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold truncate">{nomeCompleto || 'Seu Nome'}</h2>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2 pb-1">
              {getStatusBadge()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pessoal" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="pessoal" className="text-xs sm:text-sm">
            <User className="h-4 w-4 mr-1.5 hidden sm:inline-block" />Pessoal
          </TabsTrigger>
          <TabsTrigger value="empresa" className="text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1.5 hidden sm:inline-block" />Empresa
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="text-xs sm:text-sm">
            <Lock className="h-4 w-4 mr-1.5 hidden sm:inline-block" />Segurança
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="text-xs sm:text-sm">
            <CreditCard className="h-4 w-4 mr-1.5 hidden sm:inline-block" />Plano
          </TabsTrigger>
        </TabsList>

        {/* Pessoal Tab */}
        <TabsContent value="pessoal">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>Dados exibidos no seu perfil e no sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input id="nome" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Seu nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
                <Input value={user?.email || ''} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
              </div>
              <Separator />
              <Button onClick={handleSavePersonal} disabled={savingPersonal} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />{savingPersonal ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Empresa Tab */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Informações da Empresa
              </CardTitle>
              <CardDescription>Dados da sua empresa exibidos no sistema e cobranças.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Nome da Empresa</Label>
                <Input id="empresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Nome da sua empresa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ / CPF</Label>
                <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                <p className="text-xs text-muted-foreground">Usado em faturas e cobranças.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={enderecoEmpresa} onChange={(e) => setEnderecoEmpresa(e.target.value)} placeholder="Endereço comercial" />
              </div>
              <Separator />
              <Button onClick={handleSaveCompany} disabled={savingCompany} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />{savingCompany ? 'Salvando...' : 'Salvar Empresa'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança Tab */}
        <TabsContent value="seguranca" className="space-y-4">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Alterar Senha
              </CardTitle>
              <CardDescription>Mantenha sua conta segura com uma senha forte.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
              <InlineError message={passwordError} />
              <Separator />
              <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword || !confirmPassword} className="w-full sm:w-auto">
                <Lock className="h-4 w-4 mr-2" />{savingPassword ? 'Atualizando...' : 'Atualizar Senha'}
              </Button>
            </CardContent>
          </Card>

          {/* 2FA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Autenticação de Dois Fatores (2FA)
              </CardTitle>
              <CardDescription>Adicione uma camada extra de segurança à sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Verificação por Email</p>
                  <p className="text-xs text-muted-foreground">Um código será enviado ao seu email ao fazer login.</p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium">App Autenticador (TOTP)</p>
                  <p className="text-xs text-muted-foreground">Use Google Authenticator ou similar.</p>
                </div>
                <Switch disabled />
              </div>
              <p className="text-xs text-muted-foreground">
                🚧 Em breve — A autenticação de dois fatores estará disponível em uma atualização futura.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assinatura Tab */}
        <TabsContent value="assinatura">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Assinatura
              </CardTitle>
              <CardDescription>Informações sobre seu plano atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm capitalize">{subscription?.status || 'Sem plano'}</span>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {subscription?.inicio ? format(new Date(subscription.inicio), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                    </span>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Expira em</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {subscription?.expira_em
                        ? `${format(new Date(subscription.expira_em), "dd/MM/yyyy", { locale: ptBR })} (${daysLeft ?? 0} dias)`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <p className="text-sm text-muted-foreground">
                Membro desde{' '}
                {user?.created_at ? format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/planos-disponiveis'} >
                  Alterar Plano
                </Button>
                <Button variant="destructive" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sair da conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
