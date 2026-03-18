import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, LogIn, Lock, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function AdminLogin() {
  const [secretCode, setSecretCode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [codeError, setCodeError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (secretCode.length === 6) {
      verifyAdminCode(secretCode);
    }
  }, [secretCode]);

  const verifyAdminCode = async (code: string) => {
    setVerifyingCode(true);
    setCodeError("");
    try {
      const resp = await supabase.functions.invoke('verify-admin-code', {
        body: { code },
      });
      
      if (resp.data?.success) {
        setIsUnlocked(true);
        toast.success("Acesso liberado!");
      } else {
        setShakeError(true);
        setCodeError("Código incorreto. Tente novamente.");
        setTimeout(() => {
          setSecretCode("");
          setShakeError(false);
        }, 600);
      }
    } catch {
      setShakeError(true);
      setCodeError("Erro ao verificar código.");
      setTimeout(() => {
        setSecretCode("");
        setShakeError(false);
      }, 600);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Você não possui permissão de administrador.");
        return;
      }

      toast.success("Login administrativo realizado com sucesso!");
      navigate("/role/admin", { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Erro ao fazer login";
      if (/Invalid login/i.test(msg)) {
        toast.error("E-mail ou senha incorretos.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-xl">Área Restrita</CardTitle>
            <CardDescription>Digite o código de acesso para continuar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className={shakeError ? "animate-shake" : ""}>
              <InputOTP
                maxLength={6}
                value={secretCode}
                onChange={setSecretCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {codeError && (
              <p className="text-xs text-destructive font-medium text-center">{codeError}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              <KeyRound className="inline h-3 w-3 mr-1" />
              Insira o código de 6 dígitos para desbloquear.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">Painel Administrativo</CardTitle>
          <CardDescription>Faça login com sua conta de administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Entrando..."
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
