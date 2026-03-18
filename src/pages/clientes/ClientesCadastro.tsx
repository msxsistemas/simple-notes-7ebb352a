// ClientesCadastro - Criação de novos clientes
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Home, User, Package, Key, Smartphone, DollarSign, Bell, Users, ChevronDown, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useClientes, usePlanos, useProdutos, useAplicativos } from "@/hooks/useDatabase";
import { format } from "date-fns";
import { replaceMessageVariables } from "@/utils/message-variables";
import { applyMacMask } from "@/utils/mac-mask";
import { CountryCodeSelect } from "@/components/ui/country-code-select";
import { CurrencyInput } from "@/components/ui/currency-input";

export default function ClientesCadastro() {
  const navigate = useNavigate();
  const { criar } = useClientes();
  const { buscar: buscarPlanos } = usePlanos();
  const { buscar: buscarProdutos } = useProdutos();
  const { buscar: buscarAplicativos } = useAplicativos();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [planos, setPlanos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aplicativos, setAplicativos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [acessosAdicionais, setAcessosAdicionais] = useState<Array<{
    tipo_painel: string;
    usuario: string;
    senha: string;
    dispositivo?: string;
  }>>([]);
  const [aplicativosAdicionais, setAplicativosAdicionais] = useState<Array<{
    app: string;
    dataVencApp: string;
    mac: string;
    key: string;
  }>>([]);
  const [countryCode, setCountryCode] = useState("55");

  const form = useForm({
    defaultValues: {
      nome: "",
      whatsapp: "",
      aniversario: "",
      produto: "",
      plano: "",
      telas: 1,
      fatura: "Pago",
      dataVenc: "",
      fixo: false,
      usuario: "",
      senha: "",
      mac: "",
      key: "",
      dispositivo: "",
      app: "",
      dataVencApp: "",
      desconto: "0,00",
      descontoRecorrente: false,
      ativarCobrancas: false,
      comoConheceu: "",
      indicador: "",
      observacao: "",
      lembretes: true,
      mensagem: "",
      tipoPainel: "",
    },
  });

  useEffect(() => {
    document.title = "Adicionar Cliente | Tech Play";
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoadingData(true);
    try {
      const [planosData, produtosData, aplicativosData] = await Promise.all([
        buscarPlanos(),
        buscarProdutos(),
        buscarAplicativos(),
      ]);
      const sortedPlanos = (planosData || []).filter((p: any) => p.ativo !== false).sort((a: any, b: any) => {
        const valA = parseFloat(String(a.valor || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
        const valB = parseFloat(String(b.valor || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
        return valA - valB;
      });
      setPlanos(sortedPlanos);
      setProdutos((produtosData || []).filter((p: any) => p.ativo !== false));
      setAplicativos((aplicativosData || []).filter((a: any) => a.ativo !== false));

      // Buscar clientes para lista de indicadores
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome');
      setClientes(clientesData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const formatWhatsAppNumber = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    return cleaned;
  };

  const onSubmit = form.handleSubmit(async (data) => {
    const errors: Record<string, string> = {};
    if (!data.nome || data.nome.trim() === '') errors.nome = "Campo obrigatório";
    if (!data.dataVenc) errors.dataVenc = "Campo obrigatório";
    if (!data.plano) errors.plano = "Campo obrigatório";
    if (!data.produto) errors.produto = "Campo obrigatório";
    if (!(data as any).tipoPainel) errors.tipoPainel = "Campo obrigatório";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrorField = Object.keys(errors)[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstErrorField}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    setFieldErrors({});

    const whatsappFormatado = formatWhatsAppNumber(data.whatsapp);

    setLoading(true);
    try {
      const clienteData = {
        nome: data.nome,
        whatsapp: whatsappFormatado,
        email: null,
        data_vencimento: data.dataVenc ? new Date(data.dataVenc + 'T23:59:59.999Z').toISOString() : null,
        fixo: data.fixo,
        usuario: data.usuario,
        senha: data.senha,
        produto: data.produto,
        plano: data.plano,
        app: data.app,
        data_venc_app: data.dataVencApp ? new Date(data.dataVencApp + 'T23:59:59.999Z').toISOString() : null,
        telas: data.telas,
        mac: data.mac,
        dispositivo: data.dispositivo,
        fatura: data.fatura,
        key: data.key,
        mensagem: data.mensagem,
        lembretes: data.lembretes,
        indicador: data.indicador,
        desconto: data.desconto,
        desconto_recorrente: data.descontoRecorrente,
        aniversario: data.aniversario,
        observacao: data.observacao,
        tipo_painel: (data as any).tipoPainel || null,
        acessos_adicionais: acessosAdicionais.length > 0 ? acessosAdicionais : [],
        aplicativos_adicionais: aplicativosAdicionais.length > 0 ? aplicativosAdicionais : [],
      };

      // Modo criação
      const novoCliente = await criar(clienteData);
      console.log("[ClientesCadastro] Cliente criado:", novoCliente?.id, novoCliente?.whatsapp);

      // Enviar mensagem de boas-vindas se configurado
      try {
        const { data: user } = await supabase.auth.getUser();
        console.log("[ClientesCadastro] User ID:", user?.user?.id, "WhatsApp:", novoCliente?.whatsapp);
        
        if (user?.user?.id && novoCliente?.whatsapp) {
          const { data: mensagensPadroes, error: mpError } = await supabase
            .from('mensagens_padroes')
            .select('bem_vindo, enviar_bem_vindo')
            .eq('user_id', user.user.id)
            .maybeSingle();

          console.log("[ClientesCadastro] enviar_bem_vindo:", mensagensPadroes?.enviar_bem_vindo, "has bem_vindo:", !!mensagensPadroes?.bem_vindo, "error:", mpError);

          if (mensagensPadroes?.enviar_bem_vindo && mensagensPadroes?.bem_vindo) {
              const plano = planos.find(p => String(p.id) === novoCliente.plano || p.nome === novoCliente.plano);
              const planoNome = plano?.nome || novoCliente.plano || '';
              const valorPlano = plano?.valor || '0,00';

              const mensagemFinal = replaceMessageVariables(
                mensagensPadroes.bem_vindo,
                {
                  nome: novoCliente.nome || '',
                  usuario: novoCliente.usuario || undefined,
                  senha: novoCliente.senha || undefined,
                  data_vencimento: novoCliente.data_vencimento || undefined,
                  whatsapp: novoCliente.whatsapp,
                  email: novoCliente.email || undefined,
                  plano: planoNome,
                  desconto: novoCliente.desconto || undefined,
                },
                {
                  valor_plano: valorPlano,
                }
              );

              // Check if welcome message already exists for this phone today
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const { data: existingWelcome } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('user_id', user.user.id)
                .eq('phone', novoCliente.whatsapp)
                .like('session_id', 'welcome_%')
                .in('status', ['scheduled', 'pending', 'sent'])
                .gte('created_at', todayStart.toISOString())
                .limit(1);

              if (existingWelcome && existingWelcome.length > 0) {
                console.log("[ClientesCadastro] Welcome message already exists, skipping");
              } else {
                const scheduledTime = new Date();
                scheduledTime.setSeconds(scheduledTime.getSeconds() + 10);

                const { error: insertError } = await supabase.from('whatsapp_messages').insert({
                  user_id: user.user.id,
                  phone: novoCliente.whatsapp,
                  message: mensagemFinal,
                  status: 'scheduled',
                  session_id: 'welcome_' + novoCliente.whatsapp.replace(/\D/g, ''),
                  sent_at: new Date().toISOString(),
                  scheduled_for: scheduledTime.toISOString(),
                } as any);

                console.log("[ClientesCadastro] Insert welcome message result - error:", insertError);

                if (!insertError) {
                  toast({
                    title: "Mensagem de boas-vindas",
                    description: "Mensagem agendada para envio em 10 segundos",
                  });
                }
          }
          }
        }
      } catch (welcomeError) {
        console.error("Erro ao enviar mensagem de boas-vindas:", welcomeError);
      }

      // Enviar mensagem de indicação ao indicador
      if (novoCliente?.indicador && novoCliente.whatsapp) {
        try {
          const { data: user } = await supabase.auth.getUser();
          if (user?.user?.id) {
            const { data: msgPadroes } = await supabase
              .from('mensagens_padroes')
              .select('indicacao_convite')
              .eq('user_id', user.user.id)
              .maybeSingle();

            if (msgPadroes?.indicacao_convite) {
              // Buscar dados do indicador
              const { data: indicadorData } = await supabase
                .from('clientes')
                .select('nome, whatsapp')
                .eq('id', novoCliente.indicador)
                .maybeSingle();

              if (indicadorData?.whatsapp) {
                const mensagemIndicacao = (msgPadroes.indicacao_convite as string)
                  .replace(/\{nome\}/g, indicadorData.nome || '')
                  .replace(/\{indicado\}/g, novoCliente.nome || '')
                  .replace(/\{br\}/g, '\n');

                const scheduledTime = new Date();
                scheduledTime.setSeconds(scheduledTime.getSeconds() + 15);

                await supabase.from('whatsapp_messages').insert({
                  user_id: user.user.id,
                  phone: indicadorData.whatsapp,
                  message: mensagemIndicacao,
                  status: 'scheduled',
                  session_id: 'indicacao_' + indicadorData.whatsapp.replace(/\D/g, ''),
                  sent_at: new Date().toISOString(),
                  scheduled_for: scheduledTime.toISOString(),
                } as any);

                console.log("[ClientesCadastro] Indicação notification scheduled for:", indicadorData.whatsapp);
              }
            }
          }
        } catch (indError) {
          console.error("Erro ao enviar mensagem de indicação:", indError);
        }
      }

      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso!",
      });
      
      navigate("/clientes");
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  });

  const SectionHeader = ({ icon: Icon, title, color }: { icon: any; title: string; color: string }) => (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-sm font-semibold ${color}`}>{title}</span>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Card do Formulário */}
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Cadastrar Novo Cliente</h2>

          <form onSubmit={onSubmit} className="space-y-3">
            
            {/* Seção: Dados Pessoais */}
            <SectionHeader icon={User} title="Dados Pessoais" color="text-primary" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2" data-field="nome">
                <Label className="text-sm font-medium">Nome <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Nome completo do cliente" 
                  className={`bg-background border-border ${fieldErrors.nome ? 'border-destructive' : ''}`}
                  {...form.register("nome", { onChange: () => setFieldErrors(prev => ({ ...prev, nome: '' })) })}
                />
                {fieldErrors.nome && <span className="text-xs text-destructive">{fieldErrors.nome}</span>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">WhatsApp <span className="text-destructive">*</span></Label>
                <div className="flex">
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                  <Input 
                    placeholder="11999999999" 
                    className="bg-background border-border rounded-l-none"
                    {...form.register("whatsapp")}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.startsWith(countryCode)) {
                        value = value.substring(countryCode.length);
                      }
                      form.setValue("whatsapp", value);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de Aniversário</Label>
                <Input 
                  type="date"
                  className="bg-background border-border [&::-webkit-calendar-picker-indicator]:hidden"
                  {...form.register("aniversario")}
                />
              </div>
            </div>

            {/* Seção: Plano e Produto */}
            <SectionHeader icon={Package} title="Plano e Produto" color="text-primary" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2" data-field="produto">
                <Label className="text-sm font-medium">Produto <span className="text-destructive">*</span></Label>
                <Select 
                  value={form.watch("produto")} 
                  onValueChange={(v) => { form.setValue("produto", v); setFieldErrors(prev => ({ ...prev, produto: '' })); }} 
                  disabled={loadingData}
                >
                  <SelectTrigger className={`bg-background border-border ${fieldErrors.produto ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.produto && <span className="text-xs text-destructive">{fieldErrors.produto}</span>}
              </div>

              <div className="space-y-2" data-field="plano">
                <Label className="text-sm font-medium">Plano <span className="text-destructive">*</span></Label>
                <Select 
                  value={form.watch("plano")} 
                  onValueChange={(v) => { form.setValue("plano", v); setFieldErrors(prev => ({ ...prev, plano: '' })); }} 
                  disabled={loadingData}
                >
                  <SelectTrigger className={`bg-background border-border ${fieldErrors.plano ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" className="max-h-[228px] overflow-y-auto">
                    {planos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome} – {typeof p.valor === "string" && p.valor.trim().startsWith("R$") ? p.valor.replace("R$", "").trim() : p.valor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.plano && <span className="text-xs text-destructive">{fieldErrors.plano}</span>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Quantidade de Telas</Label>
                <Input 
                  type="number"
                  min={1}
                  className="bg-background border-border"
                  {...form.register("telas", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status da Fatura</Label>
                <Select 
                  value={form.watch("fatura")} 
                  onValueChange={(v) => form.setValue("fatura", v)}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2" data-field="dataVenc">
                <Label className="text-sm font-medium">Data de Vencimento <span className="text-destructive">*</span></Label>
                <Input 
                  type="date"
                  className={`bg-background border-border [&::-webkit-calendar-picker-indicator]:hidden ${fieldErrors.dataVenc ? 'border-destructive' : ''}`}
                  {...form.register("dataVenc", { onChange: () => setFieldErrors(prev => ({ ...prev, dataVenc: '' })) })}
                />
                {fieldErrors.dataVenc && <span className="text-xs text-destructive">{fieldErrors.dataVenc}</span>}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Switch
                  checked={form.watch("fixo")}
                  onCheckedChange={(checked) => form.setValue("fixo", checked)}
                />
                <Label className="text-sm">Vencimento Fixo <span className="text-muted-foreground">(mesmo dia do mês)</span></Label>
              </div>
            </div>

            {/* Seção: Credenciais de Acesso */}
            <SectionHeader icon={Key} title="Credenciais de Acesso" color="text-primary" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2" data-field="tipoPainel">
                <Label className="text-sm font-medium">Tipo no Painel <span className="text-destructive">*</span></Label>
                <Select 
                  value={form.watch("tipoPainel") || ""} 
                  onValueChange={(v) => { form.setValue("tipoPainel" as any, v); setFieldErrors(prev => ({ ...prev, tipoPainel: '' })); }}
                >
                  <SelectTrigger className={`bg-background border-border ${fieldErrors.tipoPainel ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Selecione (IPTV ou P2P)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iptv">IPTV</SelectItem>
                    <SelectItem value="p2p">P2P</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.tipoPainel && <span className="text-xs text-destructive">{fieldErrors.tipoPainel}</span>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Dispositivo</Label>
                <Input 
                  placeholder="Ex: Smart TV, TV Box, Celular..." 
                  className="bg-background border-border"
                  {...form.register("dispositivo")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Usuário</Label>
                <Input 
                  placeholder="Nome de usuário no painel" 
                  className="bg-background border-border"
                  {...form.register("usuario")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Senha</Label>
                <Input 
                  placeholder="Senha de acesso" 
                  className="bg-background border-border"
                  {...form.register("senha")}
                />
              </div>

            </div>

            {/* Collapsible: Acessos Adicionais */}
            <Collapsible className="mt-3 rounded-lg border border-border/50 overflow-hidden">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/40 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-2">
                   <Key className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Acessos Adicionais</span>
                  <span className="text-xs text-muted-foreground">(Opcional)</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="p-4 bg-muted/20 space-y-4">
                {acessosAdicionais.map((acesso, index) => (
                  <div key={index} className="space-y-4 pt-4 border-t border-border/30 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Acesso {index + 2}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo no Painel</Label>
                        <Select
                          value={acesso.tipo_painel}
                          onValueChange={(value) => {
                            setAcessosAdicionais(prev => prev.map((a, i) => 
                              i === index ? { ...a, tipo_painel: value } : a
                            ));
                          }}
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IPTV">IPTV</SelectItem>
                            <SelectItem value="P2P">P2P</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Dispositivo</Label>
                        <Input 
                          placeholder="Ex: Smart TV, Celular, TV Box" 
                          className="bg-background border-border"
                          value={acesso.dispositivo || ""}
                          onChange={(e) => {
                            setAcessosAdicionais(prev => prev.map((a, i) => 
                              i === index ? { ...a, dispositivo: e.target.value } : a
                            ));
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Usuário</Label>
                        <Input 
                          placeholder="Nome de usuário no painel" 
                          className="bg-background border-border"
                          value={acesso.usuario}
                          onChange={(e) => {
                            setAcessosAdicionais(prev => prev.map((a, i) => 
                              i === index ? { ...a, usuario: e.target.value } : a
                            ));
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Senha</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Senha de acesso" 
                            className="bg-background border-border flex-1"
                            value={acesso.senha}
                            onChange={(e) => {
                              setAcessosAdicionais(prev => prev.map((a, i) => 
                                i === index ? { ...a, senha: e.target.value } : a
                              ));
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                              setAcessosAdicionais(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => {
                    setAcessosAdicionais(prev => [...prev, {
                      tipo_painel: "",
                      usuario: "",
                      senha: "",
                      dispositivo: "",
                    }]);
                  }}
                >
                  + Adicionar Acesso
                </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <SectionHeader icon={Smartphone} title="Aplicativo" color="text-primary" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Aplicativo</Label>
                <Select 
                  value={form.watch("app")} 
                  onValueChange={(v) => form.setValue("app", v)} 
                  disabled={loadingData}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione o aplicativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {aplicativos.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Vencimento do App</Label>
                <Input 
                  type="date"
                  className="bg-background border-border [&::-webkit-calendar-picker-indicator]:hidden"
                  {...form.register("dataVencApp")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">MAC Address</Label>
                <Input 
                  placeholder="Ex: 00:1A:2B:3C:4D:5E"
                  className="bg-background border-border"
                  maxLength={17}
                  value={form.watch("mac")}
                  onChange={(e) => {
                    form.setValue("mac", applyMacMask(e.target.value));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Key / OTP</Label>
                <Input 
                  placeholder="Chave de ativação ou OTP" 
                  className="bg-background border-border"
                  {...form.register("key")}
                />
              </div>

            </div>

            {/* Collapsible: Aplicativos Adicionais */}
            <Collapsible className="mt-3 rounded-lg border border-border/50 overflow-hidden">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/40 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-2">
                   <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Aplicativos Adicionais</span>
                  <span className="text-xs text-muted-foreground">(Opcional)</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="p-4 bg-muted/20 space-y-4">
                {aplicativosAdicionais.map((appItem, index) => (
                  <div key={index} className="space-y-4 pt-4 border-t border-border/30 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Aplicativo {index + 2}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Aplicativo</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={appItem.app} 
                            onValueChange={(v) => {
                              setAplicativosAdicionais(prev => prev.map((a, i) => 
                                i === index ? { ...a, app: v } : a
                              ));
                            }}
                            disabled={loadingData}
                          >
                            <SelectTrigger className="bg-background border-border flex-1">
                              <SelectValue placeholder="Selecione o aplicativo" />
                            </SelectTrigger>
                            <SelectContent>
                              {aplicativos.map((a) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="w-10 shrink-0" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Vencimento do App</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="date"
                            className="bg-background border-border [&::-webkit-calendar-picker-indicator]:hidden flex-1"
                            value={appItem.dataVencApp}
                            onChange={(e) => {
                              setAplicativosAdicionais(prev => prev.map((a, i) => 
                                i === index ? { ...a, dataVencApp: e.target.value } : a
                              ));
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                              setAplicativosAdicionais(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">MAC Address</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Ex: 00:1A:2B:3C:4D:5E"
                            className="bg-background border-border flex-1"
                            maxLength={17}
                            value={appItem.mac}
                            onChange={(e) => {
                              const val = applyMacMask(e.target.value);
                              setAplicativosAdicionais(prev => prev.map((a, i) => 
                                i === index ? { ...a, mac: val } : a
                              ));
                            }}
                          />
                          <div className="w-10 shrink-0" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Key / OTP</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Chave de ativação ou OTP" 
                            className="bg-background border-border flex-1"
                            value={appItem.key}
                            onChange={(e) => {
                              setAplicativosAdicionais(prev => prev.map((a, i) => 
                                i === index ? { ...a, key: e.target.value } : a
                              ));
                            }}
                          />
                          <div className="w-10 shrink-0" />
                        </div>
                      </div>

                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => {
                    setAplicativosAdicionais(prev => [...prev, {
                      app: "",
                      dataVencApp: "",
                      mac: "",
                      key: ""
                    }]);
                  }}
                >
                  + Adicionar Aplicativo
                </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Campos Financeiro (sem header) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Desconto (R$)</Label>
                <CurrencyInput
                  value={parseFloat((form.watch("desconto") || "0").replace(",", ".")) || 0}
                  onValueChange={(val) => form.setValue("desconto", val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                  className="bg-background border-border"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Switch
                  checked={form.watch("descontoRecorrente")}
                  onCheckedChange={(checked) => form.setValue("descontoRecorrente", checked)}
                />
                <Label className="text-sm">Desconto Recorrente</Label>
              </div>
            </div>

            {/* Seção: Captação e Observações */}
            <SectionHeader icon={Users} title="Captação e Observações" color="text-primary" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Como conheceu?</Label>
                <Select 
                  value={form.watch("comoConheceu")} 
                  onValueChange={(v) => form.setValue("comoConheceu", v)}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Cliente Indicador</Label>
                <Select 
                  value={form.watch("indicador")} 
                  onValueChange={(v) => form.setValue("indicador", v)}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione o indicador" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Observações</Label>
                <Textarea 
                  placeholder="Anotações internas sobre o cliente..." 
                  className="bg-background border-border min-h-[100px]"
                  {...form.register("observacao")}
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/clientes")}
                className="border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/90"
              >
                {loading ? "Salvando..." : "Salvar Cliente"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
