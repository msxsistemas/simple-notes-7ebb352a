import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { CountryCodeSelect } from "@/components/ui/country-code-select";

interface NotifConfig {
  hora_notificacoes: string;
  dias_gerar_fatura: number;
  dias_proximo_vencer: number;
  valor_taxa_pagamento: number;
  api_chatbot: string;
  quantidade_mensagens: number;
  dias_apos_vencimento: number;
  whatsapp_pagamentos: string;
  descontar_saldo_fatura: boolean;
  notif_bem_vindo: boolean;
  notif_fatura_criada: boolean;
  notif_vencendo_hoje: boolean;
  notif_confirmacao_pagamento: boolean;
  notif_aniversario: boolean;
  notif_indicacao: boolean;
}

const defaultConfig: NotifConfig = {
  hora_notificacoes: "08:00",
  dias_gerar_fatura: 3,
  dias_proximo_vencer: 0,
  valor_taxa_pagamento: 0,
  api_chatbot: "",
  quantidade_mensagens: 7,
  dias_apos_vencimento: 2,
  whatsapp_pagamentos: "",
  descontar_saldo_fatura: true,
  notif_bem_vindo: true,
  notif_fatura_criada: true,
  notif_vencendo_hoje: true,
  notif_confirmacao_pagamento: true,
  notif_aniversario: true,
  notif_indicacao: true,
};

export default function ConfiguracoesNotificacoes() {
  const { userId } = useCurrentUser();
  const [config, setConfig] = useState<NotifConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState("55");

  useEffect(() => {
    document.title = "Configurações de Notificações | Gestor MSX";
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("notificacoes_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          hora_notificacoes: (data.hora_notificacoes || "08:00").length === 5 ? data.hora_notificacoes : data.hora_notificacoes + ":00",
          dias_gerar_fatura: data.dias_gerar_fatura,
          dias_proximo_vencer: data.dias_proximo_vencer,
          valor_taxa_pagamento: Number(data.valor_taxa_pagamento),
          api_chatbot: data.api_chatbot || "",
          quantidade_mensagens: data.quantidade_mensagens,
          dias_apos_vencimento: data.dias_apos_vencimento,
          whatsapp_pagamentos: data.whatsapp_pagamentos || "",
          descontar_saldo_fatura: data.descontar_saldo_fatura,
          notif_bem_vindo: data.notif_bem_vindo,
          notif_fatura_criada: data.notif_fatura_criada,
          notif_vencendo_hoje: data.notif_vencendo_hoje,
          notif_confirmacao_pagamento: data.notif_confirmacao_pagamento,
          notif_aniversario: data.notif_aniversario,
          notif_indicacao: data.notif_indicacao,
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      const payload = { ...config, user_id: userId, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase
        .from("notificacoes_config")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("notificacoes_config")
          .update(payload)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notificacoes_config")
          .insert([payload]);
        if (error) throw error;
      }
      toast.success("Configurações salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const roundTo15 = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const rounded = Math.round(m / 15) * 15;
    const finalH = rounded === 60 ? (h + 1) % 24 : h;
    const finalM = rounded === 60 ? 0 : rounded;
    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
  };

  const update = <K extends keyof NotifConfig>(key: K, value: NotifConfig[K]) =>
    setConfig((prev) => ({
      ...prev,
      [key]: key === 'hora_notificacoes' && typeof value === 'string' ? roundTo15(value) : value,
    }));

  const toggleItems: { key: keyof NotifConfig; label: string }[] = [
    { key: "descontar_saldo_fatura", label: "Descontar Saldo de Cliente na Fatura" },
    { key: "notif_bem_vindo", label: "Notificação de Bem Vindo" },
    { key: "notif_fatura_criada", label: "Notificação de Fatura Criada" },
    { key: "notif_vencendo_hoje", label: "Notificação de Clientes Vencendo Hoje" },
    { key: "notif_confirmacao_pagamento", label: "Notificação de Confirmação do Pagamento" },
    { key: "notif_aniversario", label: "Notificação de Aniversário" },
    { key: "notif_indicacao", label: "Notificação de Indicação" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações de Notificações</h1>
        <p className="text-muted-foreground mt-1">Gerencie horários, limites e ativação de notificações automáticas.</p>
      </div>

        <form onSubmit={handleSave} className="space-y-6">
        {/* Configurações gerais */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configurações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hora">Hora para gerar as notificações:</Label>
                <Input id="hora" type="time" required step="900" value={config.hora_notificacoes} onChange={(e) => update("hora_notificacoes", e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Formato: HH:MM (ex: 08:00, 21:00)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dias_fatura">Dias para gerar a fatura antes do vencimento:</Label>
                <Input id="dias_fatura" type="number" required min={0} max={30} value={config.dias_gerar_fatura} onChange={(e) => update("dias_gerar_fatura", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dias_prox">
                  Dias para enviar notificação próximo do vencimento:
                  {config.dias_proximo_vencer === 0 && (
                    <span className="ml-2 text-xs text-destructive">Coloque 0 para desativar! → Desativado</span>
                  )}
                </Label>
                <Input id="dias_prox" type="number" required min={0} max={30} value={config.dias_proximo_vencer} onChange={(e) => update("dias_proximo_vencer", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qtd_msg">Quantidade de mensagens a serem enviadas por vez:</Label>
                <Input id="qtd_msg" type="number" required min={1} max={100} value={config.quantidade_mensagens} onChange={(e) => update("quantidade_mensagens", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dias_apos">Dias para enviar notificação após o vencimento:</Label>
                <Input id="dias_apos" type="number" required min={0} max={30} value={config.dias_apos_vencimento} onChange={(e) => update("dias_apos_vencimento", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_pag">WhatsApp para receber notificação de pagamentos online:</Label>
                <div className="flex">
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                  <Input id="whatsapp_pag" type="text" className="rounded-l-none" placeholder="11999999999" value={config.whatsapp_pagamentos.replace(new RegExp(`^${countryCode}`), '')} onChange={(e) => update("whatsapp_pagamentos", countryCode + e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Toggles de notificações */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Ativar / Desativar Notificações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {toggleItems.map((item) => (
              <div key={item.key} className="rounded-md border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{item.label}:</span>
                  <Badge variant={config[item.key] ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                    {config[item.key] ? "Ativado" : "Desativado"}
                  </Badge>
                </div>
                <Switch
                  checked={config[item.key] as boolean}
                  onCheckedChange={(v) => update(item.key, v as any)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3 pt-2">
          <Button type="button" variant="destructive" onClick={() => setConfig(defaultConfig)}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
        </form>
    </div>
  );
}
