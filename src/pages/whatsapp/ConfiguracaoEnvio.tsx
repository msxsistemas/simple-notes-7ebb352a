import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Timer,
  TimerOff,
  Layers,
  CirclePause,
  CalendarClock,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  Power,
} from "lucide-react";

interface EnvioConfig {
  tempoMinimo: string;
  tempoMaximo: string;
  limiteLote: string;
  pausaProlongada: string;
  limiteDiario: string;
  variarIntervalo: boolean;
  configuracoesAtivas: boolean;
}

const DEFAULT_CONFIG: EnvioConfig = {
  tempoMinimo: "10",
  tempoMaximo: "15",
  limiteLote: "10",
  pausaProlongada: "15",
  limiteDiario: "",
  variarIntervalo: true,
  configuracoesAtivas: true,
};

const MIN_TEMPO = 10;
const MIN_TEMPO_MAX = 15;

function ValidationWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function ConfiguracaoEnvio() {
  const { userId } = useCurrentUser();
  const [config, setConfig] = useState<EnvioConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyData = (data: any) => {
    setConfig({
      tempoMinimo: String(data.tempo_minimo),
      tempoMaximo: String(data.tempo_maximo),
      limiteLote: String(data.limite_lote),
      pausaProlongada: String(data.pausa_prolongada),
      limiteDiario: data.limite_diario != null ? String(data.limite_diario) : "",
      variarIntervalo: data.variar_intervalo,
      configuracoesAtivas: data.configuracoes_ativas,
    });
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("envio_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) applyData(data);
      setLoading(false);
    })();

    // Realtime subscription for cross-tab/device sync
    const channel = supabase
      .channel('envio_config_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'envio_config',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'tempo_minimo' in payload.new) {
            applyData(payload.new);
            toast.info('Configurações atualizadas em outro dispositivo');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const num = (v: string) => Number(v) || 0;

  const tempoMinimoWarn =
    config.tempoMinimo !== "" && num(config.tempoMinimo) < MIN_TEMPO
      ? `O valor tem de ser superior ou igual a ${MIN_TEMPO}.`
      : config.tempoMinimo !== "" && num(config.tempoMinimo) > 120
        ? "O valor máximo é 120 segundos."
        : null;

  const tempoMaximoWarn =
    config.tempoMaximo !== "" && num(config.tempoMaximo) < MIN_TEMPO_MAX
      ? `O valor tem de ser superior ou igual a ${MIN_TEMPO_MAX}.`
      : config.tempoMaximo !== "" && num(config.tempoMaximo) > 120
        ? "O valor máximo é 120 segundos."
        : config.tempoMaximo !== "" && config.tempoMinimo !== "" && num(config.tempoMaximo) < num(config.tempoMinimo)
          ? "Deve ser maior ou igual ao tempo mínimo."
          : null;

  const limiteLoteWarn =
    config.limiteLote !== "" && num(config.limiteLote) < 1
      ? "O valor mínimo é 1."
      : null;

  const pausaWarn =
    config.pausaProlongada !== "" && num(config.pausaProlongada) < 1
      ? "O valor mínimo é 1 segundo."
      : config.pausaProlongada !== "" && num(config.pausaProlongada) > 120
        ? "O valor máximo é 120 segundos."
        : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (config.configuracoesAtivas && (tempoMinimoWarn || tempoMaximoWarn || limiteLoteWarn || pausaWarn)) {
      toast.error("Corrija os erros de validação antes de salvar");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        tempo_minimo: num(config.tempoMinimo),
        tempo_maximo: num(config.tempoMaximo),
        limite_lote: num(config.limiteLote),
        pausa_prolongada: num(config.pausaProlongada),
        limite_diario: config.limiteDiario ? num(config.limiteDiario) : null,
        variar_intervalo: config.variarIntervalo,
        configuracoes_ativas: config.configuracoesAtivas,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("envio_config")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("envio_config")
          .update(payload)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("envio_config")
          .insert([payload]);
        if (error) throw error;
      }
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar configurações de envio:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setConfig(DEFAULT_CONFIG);
    if (userId) {
      const { data: existing } = await supabase
        .from("envio_config")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("envio_config")
          .update({
            tempo_minimo: 10,
            tempo_maximo: 15,
            limite_lote: 10,
            pausa_prolongada: 15,
            limite_diario: null,
            variar_intervalo: true,
            configuracoes_ativas: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
    }
    toast.success("Configurações restauradas ao padrão!");
  };

  const calcEstimatedTime = () => {
    const min = num(config.tempoMinimo);
    const max = num(config.tempoMaximo);
    const avgInterval = (min + max) / 2;
    const batches = Math.ceil(100 / (num(config.limiteLote) || 1));
    const pauses = batches - 1;
    const totalSeconds = 100 * avgInterval + pauses * num(config.pausaProlongada);
    const minutes = Math.round(totalSeconds / 60);
    return `~${minutes} minutos`;
  };

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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações de Envio</h1>
        <p className="text-muted-foreground mt-1">Configure os intervalos e limites para envio de mensagens pelo WhatsApp</p>
      </div>

      {/* Toggle Configurações Ativas */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
        <Switch
          checked={config.configuracoesAtivas}
          onCheckedChange={(v) => setConfig((c) => ({ ...c, configuracoesAtivas: v }))}
        />
        <div className="flex items-center gap-2">
          <Power className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Configurações Ativas</p>
            <p className="text-xs text-muted-foreground">
              Quando desativado, serão usados os valores padrão do sistema.
            </p>
          </div>
        </div>
      </div>

      <form id="config-envio-form" onSubmit={handleSave} className={!config.configuracoesAtivas ? "opacity-50 pointer-events-none space-y-4" : "space-y-4"}>
        {/* Intervalos de Envio */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Intervalos de Envio</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="h-4 w-4 text-primary" />
                Tempo Mínimo (segundos) <span className="text-destructive">*</span>
              </Label>
              <Input required type="number" min={MIN_TEMPO} max={120} value={config.tempoMinimo} onChange={(e) => setConfig((c) => ({ ...c, tempoMinimo: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Intervalo mínimo entre mensagens ({MIN_TEMPO}-120 segundos)</p>
              <ValidationWarning message={tempoMinimoWarn} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <TimerOff className="h-4 w-4 text-primary" />
                Tempo Máximo (segundos) <span className="text-destructive">*</span>
              </Label>
              <Input required type="number" min={MIN_TEMPO_MAX} max={120} value={config.tempoMaximo} onChange={(e) => setConfig((c) => ({ ...c, tempoMaximo: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Intervalo máximo entre mensagens ({MIN_TEMPO_MAX}-120 segundos)</p>
              <ValidationWarning message={tempoMaximoWarn} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-primary" />
                Limite de Mensagens por Lote <span className="text-destructive">*</span>
              </Label>
              <Input required type="number" min={1} value={config.limiteLote} onChange={(e) => setConfig((c) => ({ ...c, limiteLote: e.target.value }))} />
              <p className="text-xs text-muted-foreground">A cada X mensagens enviadas, o sistema irá pausar</p>
              <ValidationWarning message={limiteLoteWarn} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <CirclePause className="h-4 w-4 text-destructive" />
                Pausa Prolongada (segundos) <span className="text-destructive">*</span>
              </Label>
              <Input required type="number" min={1} max={120} value={config.pausaProlongada} onChange={(e) => setConfig((c) => ({ ...c, pausaProlongada: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Tempo de pausa após atingir o limite do lote (máx. 2 minutos)</p>
              <ValidationWarning message={pausaWarn} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Limite Diário de Mensagens
              </Label>
              <Input type="number" min={0} placeholder="Sem limite" value={config.limiteDiario} onChange={(e) => setConfig((c) => ({ ...c, limiteDiario: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Deixe vazio para não limitar (opcional)</p>
            </div>
          </div>
        </div>

        {/* Prévia de Tempo Estimado */}
        <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Prévia de Tempo Estimado
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{`${config.tempoMinimo || 0}s - ${config.tempoMaximo || 0}s`}</p>
              <p className="text-xs text-muted-foreground">Intervalo entre mensagens</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{config.limiteLote || 0} mensagens</p>
              <p className="text-xs text-muted-foreground">Antes da pausa</p>
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{config.pausaProlongada || 0}s</p>
              <p className="text-xs text-muted-foreground">Pausa prolongada</p>
            </div>
          </div>
          <div className="w-full h-1 bg-primary/20 rounded-full">
            <div className="h-full bg-primary rounded-full w-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-1" />
            Tempo estimado para 100 mensagens:{" "}
            <span className="text-primary font-semibold">{calcEstimatedTime()}</span>
          </p>
        </div>
      </form>

      {/* Botões */}
      <div className="flex justify-center gap-4">
        <Button type="submit" form="config-envio-form" disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Restaurar Padrão
        </Button>
      </div>
    </div>
  );
}
