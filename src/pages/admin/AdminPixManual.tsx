import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Wallet, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

const pixKeyLabels: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave Aleatória",
};

const pixKeyPlaceholders: Record<PixKeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "seuemail@exemplo.com",
  telefone: "+5511999999999",
  aleatoria: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
};

function detectKeyType(key: string): PixKeyType {
  const clean = key.replace(/[\s.\-\/]/g, "");
  if (/^\d{11}$/.test(clean)) return "cpf";
  if (/^\d{14}$/.test(clean)) return "cnpj";
  if (key.includes("@")) return "email";
  if (/^\+?\d{10,13}$/.test(clean)) return "telefone";
  return "aleatoria";
}

function validatePixKey(key: string, type: PixKeyType): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "A chave PIX é obrigatória.";
  const clean = trimmed.replace(/[\s.\-\/]/g, "");
  switch (type) {
    case "cpf": if (!/^\d{11}$/.test(clean)) return "CPF deve conter 11 dígitos numéricos."; break;
    case "cnpj": if (!/^\d{14}$/.test(clean)) return "CNPJ deve conter 14 dígitos numéricos."; break;
    case "email": if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "E-mail inválido."; break;
    case "telefone": if (!/^\+?\d{10,13}$/.test(clean)) return "Telefone deve ter entre 10 e 13 dígitos."; break;
    case "aleatoria": if (trimmed.length < 10 || trimmed.length > 100) return "Chave aleatória deve ter entre 10 e 100 caracteres."; break;
  }
  return null;
}

export default function AdminPixManual() {
  const { toast } = useToast();
  const [pixManualEnabled, setPixManualEnabled] = useState(false);
  const [pixManualKey, setPixManualKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("aleatoria");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "PIX Manual | Admin Gateways";
  }, []);

  // Admin PIX Manual reads from system_config or a global config
  // For now, we use the same checkout_config approach but admin-scoped
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("checkout_config")
        .select("pix_manual_enabled, pix_manual_key")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPixManualEnabled(data.pix_manual_enabled);
        if (data.pix_manual_key) {
          setPixManualKey(data.pix_manual_key);
          setPixKeyType(detectKeyType(data.pix_manual_key));
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (pixManualKey.trim()) {
      setValidationError(validatePixKey(pixManualKey, pixKeyType));
    } else {
      setValidationError(null);
    }
  }, [pixManualKey, pixKeyType]);

  const handleCopyKey = async () => {
    if (!pixManualKey.trim()) return;
    await navigator.clipboard.writeText(pixManualKey.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (pixManualEnabled) {
      const err = validatePixKey(pixManualKey, pixKeyType);
      if (err) {
        setValidationError(err);
        toast({ title: "Erro de validação", description: err, variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("checkout_config").upsert(
        {
          user_id: user.id,
          pix_manual_enabled: pixManualEnabled,
          pix_manual_key: pixManualEnabled ? pixManualKey.trim() : null,
        },
        { onConflict: "user_id", ignoreDuplicates: false }
      );
      if (error) throw error;
      toast({ title: "Salvo com sucesso", description: "Configuração do PIX Manual atualizada." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="rounded-lg border mb-6 overflow-hidden shadow" aria-label="PIX Manual">
        <div className="px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-base font-semibold tracking-tight">PIX Manual</h1>
          </div>
          <p className="text-xs/6 opacity-90">Configure uma chave PIX para receber pagamentos diretamente, sem gateway.</p>
        </div>
      </header>

      <main className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-foreground/70" />
                <CardTitle className="text-sm">Status</CardTitle>
              </div>
              <Badge variant={pixManualEnabled ? "default" : "destructive"} className="font-semibold">
                {pixManualEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>
            <CardDescription>Ative para permitir que os clientes paguem via PIX manual.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Habilitar PIX Manual</span>
              <Switch checked={pixManualEnabled} onCheckedChange={setPixManualEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Chave PIX</CardTitle>
            <CardDescription>Selecione o tipo e insira a chave PIX.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pixManualEnabled ? (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Tipo da chave</Label>
                  <RadioGroup
                    value={pixKeyType}
                    onValueChange={(v) => setPixKeyType(v as PixKeyType)}
                    className="grid grid-cols-3 gap-1.5"
                  >
                    {(Object.keys(pixKeyLabels) as PixKeyType[]).map((type) => (
                      <div key={type} className="flex items-center space-x-1.5 rounded-md border px-2 py-1.5 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value={type} id={`admin-pix-type-${type}`} />
                        <Label htmlFor={`admin-pix-type-${type}`} className="text-xs cursor-pointer">
                          {pixKeyLabels[type]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{pixKeyLabels[pixKeyType]}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={pixKeyPlaceholders[pixKeyType]}
                      value={pixManualKey}
                      onChange={(e) => setPixManualKey(e.target.value)}
                      maxLength={100}
                      className={validationError ? "border-destructive" : ""}
                    />
                    {pixManualKey.trim() && (
                      <Button variant="outline" size="icon" onClick={handleCopyKey} title="Copiar chave">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <div className="h-5">
                    {validationError && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {validationError}
                      </p>
                    )}
                    {!validationError && pixManualKey.trim() && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Chave válida
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Wallet className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Ative o PIX Manual para configurar a chave.</p>
              </div>
            )}
            <div className="flex justify-center border-t pt-4 mt-2">
              <Button onClick={handleSave} disabled={loading || (pixManualEnabled && !!validationError)}>
                {loading ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}