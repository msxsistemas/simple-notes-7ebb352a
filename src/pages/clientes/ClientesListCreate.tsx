
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useClientes, usePlanos, useProdutos, useAplicativos, useTemplatesCobranca } from "@/hooks/useDatabase";
import { useTemplatesMensagens } from "@/hooks/useTemplatesMensagens";
import { replaceMessageVariables } from "@/utils/message-variables";
import { useEvolutionAPISimple } from "@/hooks/useEvolutionAPISimple";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash, Plus, Send, RefreshCw, Power, Bell, Loader2, ChevronLeft, ChevronRight, FileText, Download, Upload, Eye, Copy } from "lucide-react";
import { format } from "date-fns";
import type { Cliente } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/ui/inline-error";
import { CountryCodeSelect } from "@/components/ui/country-code-select";
import ImportClientesDialog from "@/components/clientes/ImportClientesDialog";
import ImportSigmaDialog from "@/components/clientes/ImportSigmaDialog";

export default function ClientesListCreate() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSigmaOpen, setImportSigmaOpen] = useState(false);
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Estados para dados dos selects
  const [planos, setPlanos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aplicativos, setAplicativos] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [countryCode, setCountryCode] = useState("55");
  
  const { criar, buscar, editar, deletar } = useClientes();
  const { buscar: buscarPlanos } = usePlanos();
  const { buscar: buscarProdutos } = useProdutos();
  const { buscar: buscarAplicativos } = useAplicativos();
  const { buscar: buscarTemplates } = useTemplatesCobranca();
  const { templates: templatesUsuario } = useTemplatesMensagens();
  const { sendMessage, session: whatsappSession, loading: sendingMessage } = useEvolutionAPISimple();
  const { dismiss, toast } = useToast();
  const [successMessage, setSuccessMessage] = useState("");
  const [clienteFormError, setClienteFormError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);
  
  // Estados para renovação
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [clienteParaRenovar, setClienteParaRenovar] = useState<Cliente | null>(null);
  const [isRenovando, setIsRenovando] = useState(false);
  
   // Estados para templates de cobrança
   const [templates, setTemplates] = useState<any[]>([]);
  
  // Estados para WhatsApp e toggle
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [clienteParaWhatsapp, setClienteParaWhatsapp] = useState<Cliente | null>(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>("");
  const [whatsappMensagem, setWhatsappMensagem] = useState<string>("");
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [clienteParaToggle, setClienteParaToggle] = useState<Cliente | null>(null);
  const [notificandoId, setNotificandoId] = useState<string | null>(null);
  const [templatesVencimento, setTemplatesVencimento] = useState<any[]>([]);

  // Combinar templates de cobrança + templates do usuário
  const allTemplates = useMemo(() => {
    const cobranca = templates.map(t => ({ ...t, _source: 'cobranca' }));
    const usuario = templatesUsuario.map(t => ({ ...t, _source: 'usuario' }));
    return [...cobranca, ...usuario];
  }, [templates, templatesUsuario]);

  const getProdutoNome = (produtoId: string) => {
    if (!produtoId) return 'N/A';
    const produto = produtos.find(p => String(p.id) === produtoId);
    return produto?.nome || produtoId;
  };

  const getPlanoNome = (planoId: string) => {
    if (!planoId) return 'N/A';
    const plano = planos.find(p => String(p.id) === planoId);
    return plano?.nome || planoId;
  };

  const getAplicativoNome = (appId: string) => {
    if (!appId) return 'N/A';
    const app = aplicativos.find(a => String(a.id) === appId);
    return app?.nome || appId;
  };

  // Função para determinar o status do cliente
  const getClienteStatus = (cliente: Cliente) => {
    if ((cliente as any).ativo === false) {
      return { status: 'Inativo', variant: 'secondary' as const, bgColor: 'bg-muted', venceHoje: false };
    }

    if (!cliente.data_vencimento) {
      return { status: 'Sem data', variant: 'secondary' as const, bgColor: 'bg-muted', venceHoje: false };
    }

    const dataVencimento = new Date(cliente.data_vencimento);
    const hoje = new Date();

    // Verificar se vence hoje (comparar apenas data, sem hora)
    const isHoje =
      dataVencimento.getDate() === hoje.getDate() &&
      dataVencimento.getMonth() === hoje.getMonth() &&
      dataVencimento.getFullYear() === hoje.getFullYear();

    if (isHoje) {
      return { status: 'Ativo', variant: 'outline' as const, bgColor: 'bg-yellow-500/20', venceHoje: true };
    }

    if (dataVencimento < hoje) {
      return { status: 'Vencido', variant: 'destructive' as const, bgColor: 'bg-destructive', venceHoje: false };
    }

    return { status: 'Ativo', variant: 'default' as const, bgColor: 'bg-muted', venceHoje: false };
  };

  // Contagem de clientes por produto/servidor com ID para filtragem
  const produtosContagem = useMemo(() => {
    const contagem: Record<string, { nome: string; id: string; count: number }> = {};
    clientes.forEach(cliente => {
      if (cliente.produto) {
        const nome = getProdutoNome(cliente.produto);
        if (!contagem[cliente.produto]) {
          contagem[cliente.produto] = { nome, id: cliente.produto, count: 0 };
        }
        contagem[cliente.produto].count += 1;
      }
    });
    return Object.values(contagem);
  }, [clientes, produtos]);

  // Função para filtrar por servidor ao clicar no badge
  const handleFiltrarPorServidor = (produtoId: string) => {
    const currentValue = filtros.watch("produto");
    if (currentValue === produtoId) {
      // Se já está filtrado por esse servidor, remove o filtro
      filtros.setValue("produto", "");
    } else {
      filtros.setValue("produto", produtoId);
    }
  };

  // Função para abrir diálogo de renovação
  const handleRenovarPlano = async (cliente: Cliente) => {
    if (!cliente || !cliente.id) return;
    setClienteParaRenovar(cliente);
    setRenovarDialogOpen(true);
  };

  // Função para executar renovação
  const executarRenovacao = async (incluirIntegracao: boolean) => {
    if (!clienteParaRenovar || !clienteParaRenovar.id) return;
    setIsRenovando(true);
    
    try {
      // Buscar dados do plano para calcular nova data de vencimento
      const plano = planos.find(p => String(p.id) === clienteParaRenovar.plano || p.nome === clienteParaRenovar.plano);
      if (!plano) {
        toast({
          title: "Erro",
          description: "Plano não encontrado",
          variant: "destructive",
        });
        setIsRenovando(false);
        return;
      }

      // Calcular nova data de vencimento
      const dataAtualVencimento = clienteParaRenovar.data_vencimento 
        ? new Date(clienteParaRenovar.data_vencimento) 
        : new Date();
      
      const hoje = new Date();
      const baseData = dataAtualVencimento > hoje ? dataAtualVencimento : hoje;
      
      let novaDataVencimento = new Date(baseData);
      const qtd = parseInt(String(plano.quantidade || 0)) || 0;
      
      if (plano.tipo === "dias") {
        novaDataVencimento.setDate(novaDataVencimento.getDate() + qtd);
      } else if (plano.tipo === "meses") {
        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + qtd);
      } else if (plano.tipo === "anos") {
        novaDataVencimento.setFullYear(novaDataVencimento.getFullYear() + qtd);
      }

      const year = novaDataVencimento.getFullYear();
      const month = String(novaDataVencimento.getMonth() + 1).padStart(2, '0');
      const day = String(novaDataVencimento.getDate()).padStart(2, '0');
      const dataVencimentoBrasilia = `${year}-${month}-${day}T23:59:59-03:00`;

      const updateData: any = { 
        data_vencimento: dataVencimentoBrasilia
      };
      
      if (incluirIntegracao && clienteParaRenovar.data_venc_app) {
        updateData.data_venc_app = `${year}-${month}-${day}T23:59:59-03:00`;
      }

      const { error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', clienteParaRenovar.id);

      if (error) {
        console.error('Erro ao renovar plano:', error);
        toast({
          title: "Erro",
          description: "Erro ao renovar plano",
          variant: "destructive",
        });
        setIsRenovando(false);
        return;
      }

      // Renovar no painel do servidor se o produto tiver integração configurada
      let painelRenovado = false;
      let painelEmProcessamento = false;
      let painelFalhou = false;
      // Buscar produto por ID ou por nome (o campo cliente.produto pode conter qualquer um)
      const produto = produtos.find(p => String(p.id) === clienteParaRenovar.produto || p.nome === clienteParaRenovar.produto);
      console.log(`🔍 Produto encontrado para renovação:`, produto ? `${produto.nome} (provedor: ${produto.provedor_iptv}, painel_id: ${produto.painel_id})` : `NENHUM (cliente.produto: ${clienteParaRenovar.produto})`);
      if (produto?.provedor_iptv && clienteParaRenovar.usuario) {
        try {
          // Usar painel_id específico do produto, ou buscar pelo provedor
          let painel: any = null;
          if ((produto as any).painel_id) {
            const { data } = await supabase
              .from('paineis_integracao')
              .select('id, nome, provedor')
              .eq('id', (produto as any).painel_id)
              .single();
            painel = data;
          }
          if (!painel) {
            const { data: paineis } = await supabase
              .from('paineis_integracao')
              .select('id, nome, provedor')
              .eq('provedor', produto.provedor_iptv);
            painel = paineis?.[0];
          }
          if (painel) {
            // Mapear duração do plano para o formato do painel
            let durationIn = 'months';
            let duration = qtd;
            if (plano.tipo === 'dias') durationIn = 'days';
            else if (plano.tipo === 'meses') durationIn = 'months';
            else if (plano.tipo === 'anos') durationIn = 'years';

            // ── SIGMA: renovação direta pelo navegador (bypassa Cloudflare) ──
            if (painel.provedor === 'sigma') {
              try {
                const { sigmaLogin, fetchSigmaCustomers, renewSigmaCustomer } = await import('@/utils/sigma-api');
                
                // 1. Buscar credenciais do painel (resolvendo Vault se necessário)
                const painelData = await supabase
                  .from('paineis_integracao')
                  .select('url, usuario, senha')
                  .eq('id', painel.id)
                  .single();
                
                if (!painelData.data) throw new Error('Painel não encontrado');
                let { url: painelUrl, usuario: painelUsuario, senha: painelSenha } = painelData.data;
                
                // Resolver credenciais do Vault se necessário
                const currentUserId = (await supabase.auth.getUser()).data.user?.id;
                if (currentUserId && (painelUsuario === 'vault' || painelSenha === 'vault')) {
                  const [uRes, sRes] = await Promise.all([
                    painelUsuario === 'vault' 
                      ? supabase.rpc('get_gateway_secret', { p_user_id: currentUserId, p_gateway: 'painel', p_secret_name: `usuario_${painel.id}` })
                      : { data: painelUsuario },
                    painelSenha === 'vault'
                      ? supabase.rpc('get_gateway_secret', { p_user_id: currentUserId, p_gateway: 'painel', p_secret_name: `senha_${painel.id}` })
                      : { data: painelSenha },
                  ]);
                  if (uRes.data) painelUsuario = uRes.data;
                  if (sRes.data) painelSenha = sRes.data;
                }
                
                const token = await sigmaLogin(painelUrl, painelUsuario, painelSenha);
                
                // 2. Buscar cliente por username
                const result = await fetchSigmaCustomers(painelUrl, token, 1, clienteParaRenovar.usuario, 5);
                const found = result.data.find((c: any) => c.username === clienteParaRenovar.usuario);
                if (!found) throw new Error(`Cliente "${clienteParaRenovar.usuario}" não encontrado no painel`);
                
                // 3. Renovar
                const renewed = await renewSigmaCustomer(painelUrl, token, found.id, found.package_id, found.connections || 1);
                console.log('✅ Sigma renovado:', renewed);
                painelRenovado = true;
                
                // Usar a data real retornada pelo painel
                const painelExpDate = renewed?.expires_at_tz || renewed?.expires_at;
                if (painelExpDate) {
                  const painelDate = new Date(painelExpDate);
                  if (!isNaN(painelDate.getTime())) {
                    novaDataVencimento = painelDate;
                    const pYear = painelDate.getFullYear();
                    const pMonth = String(painelDate.getMonth() + 1).padStart(2, '0');
                    const pDay = String(painelDate.getDate()).padStart(2, '0');
                    const painelDataFormatada = `${pYear}-${pMonth}-${pDay}T23:59:59-03:00`;
                    // Atualizar no banco com a data real do painel
                    await supabase.from('clientes').update({ data_vencimento: painelDataFormatada } as any).eq('id', clienteParaRenovar.id);
                    console.log(`📅 Data atualizada com a do painel: ${pDay}/${pMonth}/${pYear}`);
                  }
                }
                
                // 4. Renovar acessos adicionais
                const acessos = (clienteParaRenovar as any).acessos_adicionais;
                if (Array.isArray(acessos) && acessos.length > 0) {
                  for (const acesso of acessos) {
                    if (!acesso.usuario) continue;
                    try {
                      console.log(`🔄 Renovando acesso adicional Sigma: ${acesso.usuario}`);
                      const adicResult = await fetchSigmaCustomers(painelUrl, token, 1, acesso.usuario, 5);
                      const adicFound = adicResult.data.find((c: any) => c.username === acesso.usuario);
                      if (adicFound) {
                        await renewSigmaCustomer(painelUrl, token, adicFound.id, adicFound.package_id, adicFound.connections || 1);
                        console.log(`✅ Acesso adicional ${acesso.usuario} renovado`);
                      } else {
                        console.warn(`⚠️ Acesso adicional ${acesso.usuario} não encontrado no painel`);
                      }
                    } catch (adicErr) {
                      console.error(`❌ Erro ao renovar acesso adicional ${acesso.usuario}:`, adicErr);
                    }
                  }
                }
              } catch (sigmaErr: any) {
                painelFalhou = true;
                console.error('Erro Sigma:', sigmaErr);
                toast({
                  title: "Aviso",
                  description: `Plano renovado localmente, mas falha no painel Sigma: ${sigmaErr.message}`,
                  variant: "destructive",
                });
              }
            } else {
              // ── Outros provedores: via edge function ──
              const providerFunctionMap: Record<string, string> = {
                'mundogf': 'mundogf-renew',
                'unitv': 'universal-panel',
                'uniplay': 'universal-panel',
                'koffice-api': 'koffice-renew',
                'koffice-v2': 'koffice-renew',
                'playfast': 'playfast-renew',
              };
              const functionName = providerFunctionMap[painel.provedor] || 'playfast-renew';

              const { data: renewResult, error: renewError } = await supabase.functions.invoke(functionName, {
                body: {
                  action: functionName === 'universal-panel' ? 'renew' : 'renew_by_username',
                  panelId: painel.id,
                  username: clienteParaRenovar.usuario,
                  clientUsername: clienteParaRenovar.usuario,
                  duration,
                  durationIn,
                  clienteScreens: (clienteParaRenovar as any).telas || 1,
                  tipoPainel: (clienteParaRenovar as any).tipo_painel || null,
                  userId: (await supabase.auth.getUser()).data.user?.id,
                },
              });
              console.log(`📡 Resultado renovação ${functionName}:`, renewResult, renewError);

              if (renewResult?.success) {
                if (renewResult?.async) {
                  painelEmProcessamento = true;
                  toast({
                    title: "Renovação no painel",
                    description: "A renovação no painel foi iniciada em segundo plano. Verifique os logs para acompanhar.",
                  });
                } else {
                  painelRenovado = true;
                  // Usar a data real retornada pelo painel se disponível
                  const painelExpDate = renewResult?.exp_date || renewResult?.expires_at || renewResult?.data?.expires_at_tz || renewResult?.data?.expires_at;
                  if (painelExpDate) {
                    const painelDate = new Date(painelExpDate);
                    if (!isNaN(painelDate.getTime())) {
                      novaDataVencimento = painelDate;
                      const pYear = painelDate.getFullYear();
                      const pMonth = String(painelDate.getMonth() + 1).padStart(2, '0');
                      const pDay = String(painelDate.getDate()).padStart(2, '0');
                      const painelDataFormatada = `${pYear}-${pMonth}-${pDay}T23:59:59-03:00`;
                      await supabase.from('clientes').update({ data_vencimento: painelDataFormatada } as any).eq('id', clienteParaRenovar.id);
                      console.log(`📅 Data atualizada com a do painel: ${pDay}/${pMonth}/${pYear}`);
                    }
                  }
                }
              } else {
                painelFalhou = true;
                console.warn('Renovação no painel falhou:', renewResult?.error);
                toast({
                  title: "Aviso",
                  description: `Plano renovado localmente, mas falha no painel: ${renewResult?.error || 'Erro desconhecido'}`,
                  variant: "destructive",
                });
              }

              // ── Renovar acessos adicionais ──
              const acessos = (clienteParaRenovar as any).acessos_adicionais;
              if (Array.isArray(acessos) && acessos.length > 0 && painelRenovado) {
                for (const acesso of acessos) {
                  if (!acesso.usuario) continue;
                  try {
                    console.log(`🔄 Renovando acesso adicional: ${acesso.usuario}`);
                    const { data: adicResult } = await supabase.functions.invoke(functionName, {
                      body: {
                        action: functionName === 'universal-panel' ? 'renew' : 'renew_by_username',
                        panelId: painel.id,
                        username: acesso.usuario,
                        clientUsername: acesso.usuario,
                        duration,
                        durationIn,
                        tipoPainel: acesso.tipo_painel || (clienteParaRenovar as any).tipo_painel || null,
                        userId: (await supabase.auth.getUser()).data.user?.id,
                      },
                    });
                    if (adicResult?.success) {
                      console.log(`✅ Acesso adicional ${acesso.usuario} renovado`);
                    } else {
                      console.warn(`⚠️ Acesso adicional ${acesso.usuario} falhou:`, adicResult?.error);
                    }
                  } catch (adicErr) {
                    console.error(`❌ Erro ao renovar acesso adicional ${acesso.usuario}:`, adicErr);
                  }
                }
              }
            }
          }
        } catch (err) {
          painelFalhou = true;
          console.error('Erro ao renovar no painel:', err);
        }
      }

      await carregarClientes();
      
      const mensagem = painelRenovado 
        ? `Plano renovado até ${novaDataVencimento.toLocaleDateString('pt-BR')} (painel atualizado ✅)`
        : painelEmProcessamento
          ? `Plano renovado até ${novaDataVencimento.toLocaleDateString('pt-BR')} (painel em processamento ⏳)`
          : painelFalhou
            ? `Plano renovado até ${novaDataVencimento.toLocaleDateString('pt-BR')} (falhou no painel)`
            : `Plano renovado até ${novaDataVencimento.toLocaleDateString('pt-BR')}`;
      
      toast({
        title: painelFalhou ? "Atenção" : "Sucesso",
        description: mensagem,
        variant: painelFalhou ? "destructive" : undefined,
      });

      // Enviar mensagem de confirmação de pagamento via WhatsApp
      try {
        const { data: mensagensPadroes } = await supabase
          .from('mensagens_padroes')
          .select('confirmacao_pagamento')
          .maybeSingle();

        const templateMsg = mensagensPadroes?.confirmacao_pagamento;
        if (templateMsg && clienteParaRenovar.whatsapp) {
          // Buscar valor do plano
          let valorPlano = '';
          if (plano?.valor) {
            valorPlano = `R$ ${parseFloat(plano.valor).toFixed(2).replace('.', ',')}`;
          }

          const finalYear = novaDataVencimento.getFullYear();
          const finalMonth = String(novaDataVencimento.getMonth() + 1).padStart(2, '0');
          const finalDay = String(novaDataVencimento.getDate()).padStart(2, '0');

          const clienteAtualizado = {
            ...clienteParaRenovar,
            data_vencimento: `${finalYear}-${finalMonth}-${finalDay}T23:59:59-03:00`,
          };

          const msgFinal = replaceMessageVariables(templateMsg, clienteAtualizado, {
            valor_plano: valorPlano,
          });

          await sendMessage(clienteParaRenovar.whatsapp, msgFinal);
          console.log('✅ Mensagem de confirmação enviada');
        }
      } catch (whatsErr) {
        console.warn('⚠️ Erro ao enviar confirmação WhatsApp:', whatsErr);
      }

      setRenovarDialogOpen(false);
      setClienteParaRenovar(null);
      setIsRenovando(false);

    } catch (error) {
      console.error('Erro ao renovar plano:', error);
      toast({
        title: "Erro",
        description: "Erro ao renovar plano",
        variant: "destructive",
      });
      setIsRenovando(false);
    }
  };

  // Funções para editar e deletar
  const handleEditCliente = (cliente: Cliente) => {
    if (!cliente || !cliente.id) return;
    // Navegar para a página de edição com o ID do cliente
    navigate(`/clientes/editar/${cliente.id}`);
  };

  const handleDeleteCliente = (clienteId: string) => {
    if (!clienteId) return;
    const target = clientes.find(c => c && c.id === clienteId) || null;
    setDeleteTarget(target);
  };

  const confirmDeleteCliente = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deletar(deleteTarget.id);
      setClientes(prev => prev.filter(c => c.id !== deleteTarget.id));
    } catch (error) {
      console.error("Erro ao deletar cliente:", error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetModal = () => {
    setEditingCliente(null);
    setIsEditing(false);
    form.reset({
      nome: "",
      whatsapp: "",
      email: "",
      dataVenc: "",
      fixo: false,
      usuario: "",
      senha: "",
      produto: "",
      plano: "",
      app: "",
      dataVencApp: "",
      telas: 1,
      mac: "",
      dispositivo: "",
      fatura: "Pago",
      key: "",
      mensagem: "",
      lembretes: false,
      indicador: "",
      desconto: "0,00",
      descontoRecorrente: false,
      aniversario: "",
      observacao: "",
    });
  };

  // Função para gerar fatura
  const [gerandoFaturaId, setGerandoFaturaId] = useState<string | null>(null);
  const handleGerarFatura = async (cliente: Cliente) => {
    if (!cliente.whatsapp || !cliente.nome) {
      toast({ title: "Erro", description: "Cliente sem dados obrigatórios", variant: "destructive" });
      return;
    }

    setGerandoFaturaId(cliente.id!);
    try {
      const plano = planos.find(p => String(p.id) === String(cliente.plano));
      const planoNome = plano?.nome || cliente.plano || "Plano";
      const valorPlanoRaw = plano?.valor ?? "0";
      const valorPlanoStr = typeof valorPlanoRaw === "string" ? valorPlanoRaw.replace(/\u00A0/g, " ") : String(valorPlanoRaw);
      // normaliza "R$ 25,00" -> "25.00"
      const valorPlano = (() => {
        let cleaned = valorPlanoStr.trim().replace(/[^0-9,.-]/g, "");
        if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
        else if (cleaned.includes(",") && !cleaned.includes(".")) cleaned = cleaned.replace(",", ".");
        return cleaned || "0";
      })();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
        return;
      }

      // Excluir faturas pendentes anteriores deste cliente
      if (cliente.id) {
        await supabase
          .from('faturas')
          .delete()
          .eq('cliente_id', cliente.id)
          .eq('status', 'pendente');
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-fatura`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "create",
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            cliente_whatsapp: cliente.whatsapp,
            plano_nome: planoNome,
            valor: valorPlano,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || result.error) {
        throw new Error(result.error || "Erro ao gerar fatura");
      }

      const novaFaturaUrl = result.fatura?.id ? `https://gestormsx.pro/fatura/${result.fatura.id}` : null;

      toast({ 
        title: "Fatura gerada!", 
        description: `Fatura criada para ${cliente.nome}`,
        action: novaFaturaUrl ? (
          <button 
            onClick={() => window.open(novaFaturaUrl, '_blank')} 
            className="text-xs underline font-medium"
          >
            Abrir fatura
          </button>
        ) : undefined,
      });

      // Show WhatsApp notification status
      if (result.whatsapp_sent) {
        toast({
          title: "📱 WhatsApp enviado!",
          description: `Mensagem de fatura enviada para ${cliente.nome}`,
        });
      } else {
        toast({
          title: "⚠️ WhatsApp não enviado",
          description: "Verifique se o WhatsApp está conectado em 'Parear WhatsApp'",
          variant: "destructive",
        });
      }
      
      // Mensagem de fatura criada é enviada automaticamente pela Edge Function generate-fatura
      // Não enviar novamente aqui para evitar duplicação
    } catch (error: any) {
      console.error("Erro ao gerar fatura:", error);
      toast({ title: "Erro", description: error.message || "Erro ao gerar fatura", variant: "destructive" });
    } finally {
      setGerandoFaturaId(null);
    }
  };

  const handleEnviarWhatsApp = (cliente: Cliente) => {
    if (!cliente || !cliente.whatsapp) return;
    setClienteParaWhatsapp(cliente);
    setWhatsappTemplate("");
    setWhatsappMensagem("");
    setWhatsappDialogOpen(true);
  };

  // Função para obter mensagem final do template
  const getMensagemDoTemplate = (templateId: string): string => {
    if (!templateId || !clienteParaWhatsapp) return "";

    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return "";

    const normalize = (s: any) => String(s ?? '').trim().toLowerCase();
    const sanitizeNumber = (val: any) => {
      if (val === null || val === undefined) return 0;
      const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const findPlano = () => {
      const cliVal = clienteParaWhatsapp.plano;
      let p = planos.find(pl => String(pl.id) === String(cliVal));
      if (p) return p;
      p = planos.find(pl => normalize(pl.nome) === normalize(cliVal));
      if (p) return p;
      p = planos.find(pl => normalize(pl.nome).includes(normalize(cliVal)) || normalize(cliVal).includes(normalize(pl.nome)));
      return p;
    };

    const plano = findPlano();
    const planoNome = plano?.nome || clienteParaWhatsapp.plano || "";
    const valorPlano = sanitizeNumber(plano?.valor);
    const desconto = sanitizeNumber(clienteParaWhatsapp.desconto);
    const total = Math.max(0, valorPlano - desconto);
    const f2 = (n: number) => n.toFixed(2);

    return replaceMessageVariables(
      template.mensagem || "",
      {
        nome: clienteParaWhatsapp.nome,
        usuario: clienteParaWhatsapp.usuario || undefined,
        senha: clienteParaWhatsapp.senha || undefined,
        data_vencimento: clienteParaWhatsapp.data_vencimento || undefined,
        whatsapp: clienteParaWhatsapp.whatsapp,
        email: clienteParaWhatsapp.email || undefined,
        plano: planoNome,
        desconto: f2(desconto),
        observacao: clienteParaWhatsapp.observacao || undefined,
        app: (clienteParaWhatsapp as any).app || undefined,
        dispositivo: (clienteParaWhatsapp as any).dispositivo || undefined,
        telas: (clienteParaWhatsapp as any).telas || undefined,
        mac: (clienteParaWhatsapp as any).mac || undefined,
      },
      {
        valor_plano: f2(valorPlano),
        total: f2(total),
      }
    );
  };

  // Função para confirmar envio de WhatsApp
  const confirmarEnvioWhatsApp = async () => {
    // Validar: deve ter template OU mensagem, não ambos
    const temTemplate = !!whatsappTemplate;
    const temMensagem = !!whatsappMensagem.trim();

    if (temTemplate && temMensagem) {
      toast({
        title: "Erro",
        description: "Escolha apenas template OU digite uma mensagem, não ambos",
        variant: "destructive",
      });
      return;
    }

    if (!temTemplate && !temMensagem) {
      toast({
        title: "Erro",
        description: "Escolha um template ou digite uma mensagem",
        variant: "destructive",
      });
      return;
    }

    if (!clienteParaWhatsapp?.whatsapp) {
      toast({
        title: "Erro",
        description: "Cliente sem número de WhatsApp",
        variant: "destructive",
      });
      return;
    }

    // Determinar mensagem final
    const mensagemFinal = temTemplate 
      ? getMensagemDoTemplate(whatsappTemplate) 
      : whatsappMensagem;

    if (!mensagemFinal.trim()) {
      toast({
        title: "Erro",
        description: "Mensagem vazia",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendMessage(clienteParaWhatsapp.whatsapp, mensagemFinal);
      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso!",
      });
      setWhatsappDialogOpen(false);
      setClienteParaWhatsapp(null);
      setWhatsappTemplate("");
      setWhatsappMensagem("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive",
      });
    }
  };

  // Função para abrir diálogo de toggle ativo/inativo
  const handleToggleAtivo = async (cliente: Cliente) => {
    if (!cliente || !cliente.id) return;
    
    const isActive = (cliente as any).ativo !== false;
    
    // Se está ativo e vai desativar, pede confirmação
    if (isActive) {
      setClienteParaToggle(cliente);
      setToggleDialogOpen(true);
      return;
    }
    
    // Se está inativo, ativa direto sem confirmação
    await executarToggleCliente(cliente);
  };

  // Função para executar o toggle diretamente
  const executarToggleCliente = async (cliente: Cliente) => {
    if (!cliente?.id) return;
    
    try {
      const novoStatus = !(cliente as any).ativo;
      
      const { error } = await supabase
        .from('clientes')
        .update({ ativo: novoStatus })
        .eq('id', cliente.id);

      if (error) {
        console.error('Erro ao alterar status:', error);
        toast({
          title: "Erro",
          description: "Erro ao alterar status do cliente",
          variant: "destructive",
        });
        return;
      }

      // Atualizar lista local
      setClientes(prev => prev.map(c => 
        c.id === cliente.id 
          ? { ...c, ativo: novoStatus } as any
          : c
      ));

      toast({
        title: "Sucesso",
        description: `Cliente ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
      });

    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do cliente",
        variant: "destructive",
      });
    }
  };

  // Função para confirmar toggle ativo/inativo (desativar)
  const confirmarToggleAtivo = async () => {
    if (!clienteParaToggle?.id) return;
    await executarToggleCliente(clienteParaToggle);
    setToggleDialogOpen(false);
    setClienteParaToggle(null);
  };

  // Função para notificar vencimento do cliente
  const handleNotificarVencimento = async (cliente: Cliente) => {
    if (!cliente || !cliente.id) return;
    
    setNotificandoId(cliente.id);

    try {
      // Determinar tipo de notificação com base no status
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      let tipoNotificacao = "proximo_vencer";
      if (cliente.data_vencimento) {
        const dataVenc = new Date(cliente.data_vencimento);
        dataVenc.setHours(0, 0, 0, 0);
        
        if (dataVenc < hoje) {
          tipoNotificacao = "vencido";
        } else if (dataVenc.getTime() === hoje.getTime()) {
          tipoNotificacao = "vence_hoje";
        }
      }

      // Buscar mensagem da tabela mensagens_padroes
      const { data: mensagensData } = await supabase
        .from("mensagens_padroes")
        .select("*")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      const mensagemKey: Record<string, string> = {
        vencido: "vencido",
        vence_hoje: "vence_hoje",
        proximo_vencer: "proximo_vencer",
      };

      const key = mensagemKey[tipoNotificacao];
      const mensagemTemplate = mensagensData?.[key as keyof typeof mensagensData] as string | null;

      if (!mensagemTemplate) {
        toast({
          title: "Erro",
          description: `Mensagem "${key}" não configurada. Configure em Gerenciar Mensagens.`,
          variant: "destructive",
        });
        setNotificandoId(null);
        return;
      }

      // Processar mensagem com variáveis usando função centralizada
      const plano = planos.find(p => String(p.id) === String(cliente.plano));
      const planoNome = plano?.nome || getPlanoNome(cliente.plano || '') || "";
      const valorPlano = plano?.valor || "0,00";

      const mensagemProcessada = replaceMessageVariables(
        mensagemTemplate,
        {
          nome: cliente.nome,
          usuario: cliente.usuario || undefined,
          senha: cliente.senha || undefined,
          data_vencimento: cliente.data_vencimento || undefined,
          whatsapp: cliente.whatsapp,
          email: cliente.email || undefined,
          plano: planoNome,
          desconto: cliente.desconto || undefined,
          observacao: cliente.observacao || undefined,
          app: (cliente as any).app || undefined,
          dispositivo: (cliente as any).dispositivo || undefined,
          telas: (cliente as any).telas || undefined,
          mac: (cliente as any).mac || undefined,
        },
        {
          valor_plano: valorPlano,
        }
      );

      // Obter user_id atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        setNotificandoId(null);
        return;
      }

      // Inserir na fila de mensagens
      const { error } = await supabase.from("whatsapp_messages").insert({
        user_id: user.id,
        phone: cliente.whatsapp,
        message: mensagemProcessada,
        session_id: `user_${user.id}`,
        status: "pending",
        scheduled_for: new Date(Date.now() + 5000).toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Notificação enviada para ${cliente.nome}!`,
      });
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar notificação de vencimento",
        variant: "destructive",
      });
    } finally {
      setNotificandoId(null);
    }
  };

  useEffect(() => {
    document.title = "Clientes - Listar/Criar | Gestor Tech Play";
    carregarClientes();
    carregarDadosSelects();
  }, []);

  const carregarClientes = async () => {
    setLoadingClientes(true);
    try {
      const data = await buscar();
      const clientesValidos = (data || []).filter(cliente => cliente && cliente.id);
      setClientes(clientesValidos);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  };

  const carregarDadosSelects = async () => {
    setLoadingData(true);
    try {
      const [planosData, produtosData, aplicativosData, templatesData] = await Promise.all([
        buscarPlanos(),
        buscarProdutos(),
        buscarAplicativos(),
        buscarTemplates(),
      ]);
      setPlanos((planosData || []).filter((p: any) => p.ativo !== false));
      setProdutos((produtosData || []).filter((p: any) => p.ativo !== false));
      setAplicativos((aplicativosData || []).filter((a: any) => a.ativo !== false));
      setTemplates(templatesData || []);
    } catch (error) {
      console.error("Erro ao carregar dados dos selects:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Filtros
  const filtros = useForm({
    defaultValues: {
      dataInicial: "",
      dataFinal: "",
      status: "",
      plano: "",
      produto: "",
      search: "",
      captacao: "",
    },
  });

  // Lista de indicadores únicos para o filtro de captação
  const indicadoresUnicos = useMemo(() => {
    const indicadores = new Set<string>();
    clientes.forEach(cliente => {
      if (cliente.indicador && cliente.indicador.trim() !== '') {
        indicadores.add(cliente.indicador.trim());
      }
    });
    return Array.from(indicadores).sort();
  }, [clientes]);

  const handleBuscar = () => {
    // Filtros são aplicados automaticamente via useMemo
  };

  // Clientes filtrados
  const filtrosValues = filtros.watch();
  
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((cliente) => {
      if (!cliente || !cliente.id) return false;

      if (filtrosValues.search) {
        const searchTerm = filtrosValues.search.toLowerCase();
        const matches = 
          cliente.nome?.toLowerCase().includes(searchTerm) ||
          cliente.whatsapp?.toLowerCase().includes(searchTerm) ||
          cliente.email?.toLowerCase().includes(searchTerm) ||
          cliente.usuario?.toLowerCase().includes(searchTerm);
        if (!matches) return false;
      }

      if (filtrosValues.dataInicial && cliente.data_vencimento) {
        const dataVenc = new Date(cliente.data_vencimento);
        const dataInicial = new Date(filtrosValues.dataInicial);
        if (dataVenc < dataInicial) return false;
      }

      if (filtrosValues.dataFinal && cliente.data_vencimento) {
        const dataVenc = new Date(cliente.data_vencimento);
        const dataFinal = new Date(filtrosValues.dataFinal);
        if (dataVenc > dataFinal) return false;
      }

      if (filtrosValues.status && filtrosValues.status !== "todos") {
        const isInactive = (cliente as any).ativo === false;

        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);

        const dataVenc = cliente.data_vencimento ? new Date(cliente.data_vencimento) : null;

        switch (filtrosValues.status) {
          case "inativo":
            if (!isInactive) return false;
            break;
          case "ativo":
            if (isInactive) return false;
            if (!dataVenc || dataVenc < inicioHoje) return false;
            break;
          case "vencido":
            if (isInactive) return false;
            if (!dataVenc || dataVenc >= inicioHoje) return false;
            break;
        }
      }

      if (filtrosValues.plano && filtrosValues.plano !== "todos") {
        if (cliente.plano !== filtrosValues.plano) return false;
      }

      if (filtrosValues.produto && filtrosValues.produto !== "todos") {
        if (cliente.produto !== filtrosValues.produto) return false;
      }

      if (filtrosValues.captacao && filtrosValues.captacao !== "todos") {
        if (cliente.indicador !== filtrosValues.captacao) return false;
      }

      return true;
    });
  }, [clientes, filtrosValues.search, filtrosValues.dataInicial, filtrosValues.dataFinal, filtrosValues.status, filtrosValues.plano, filtrosValues.produto, filtrosValues.captacao]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filtrosValues.search, filtrosValues.dataInicial, filtrosValues.dataFinal, filtrosValues.status, filtrosValues.plano, filtrosValues.produto, filtrosValues.captacao]);

  const totalPages = Math.ceil(clientesFiltrados.filter(c => c && c.id).length / itemsPerPage);
  const clientesPaginados = useMemo(() => {
    const valid = clientesFiltrados.filter(c => c && c.id);
    // Ordenar por data de vencimento mais próxima primeiro
    valid.sort((a, b) => {
      const dateA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : Infinity;
      const dateB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : Infinity;
      return dateA - dateB;
    });
    const start = (currentPage - 1) * itemsPerPage;
    return valid.slice(start, start + itemsPerPage);
  }, [clientesFiltrados, currentPage, itemsPerPage]);

  const form = useForm({
    defaultValues: {
      nome: "",
      whatsapp: "",
      email: "",
      dataVenc: "",
      fixo: false,
      usuario: "",
      senha: "",
      produto: "",
      plano: "",
      app: "",
      dataVencApp: "",
      telas: 1,
      mac: "",
      dispositivo: "",
      fatura: "Pago",
      key: "",
      mensagem: "",
      lembretes: false,
      indicador: "",
      desconto: "0,00",
      descontoRecorrente: false,
      aniversario: "",
      observacao: "",
    },
  });

  // Função para formatar o número de WhatsApp com +55
  const formatWhatsAppNumber = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    return cleaned;
  };

  const onSubmitNovoCliente = form.handleSubmit(async (data) => {
    dismiss();
    
    const camposFaltantes: string[] = [];
    if (!data.nome || data.nome.trim() === '') camposFaltantes.push("Nome");
    if (!data.dataVenc) camposFaltantes.push("Data de Vencimento");
    if (!data.plano) camposFaltantes.push("Plano");

    if (camposFaltantes.length > 0) {
      setClienteFormError(`Preencha os campos: ${camposFaltantes.join(", ")}`);
      return;
    }
    setClienteFormError(null);

    // Formatar o número de WhatsApp com +55
    const whatsappFormatado = formatWhatsAppNumber(data.whatsapp);
    
    setLoading(true);
    try {
      if (isEditing && editingCliente) {
        const clienteAtualizado = await editar(editingCliente.id, {
          nome: data.nome,
          whatsapp: whatsappFormatado,
          email: data.email,
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
          observacao: data.observacao
        });
        setClientes(prev => prev.map(c => c.id === editingCliente.id ? clienteAtualizado : c));
        setSuccessMessage("Cliente atualizado");
        setShowSuccessDialog(true);
      } else {
        const novoCliente = await criar({
          nome: data.nome,
          whatsapp: whatsappFormatado,
          email: data.email,
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
          observacao: data.observacao
        });
        setClientes(prev => [novoCliente, ...prev]);
        
        // Enviar mensagem de boas-vindas se o cliente tiver WhatsApp
        if (novoCliente.whatsapp) {
          try {
            // Buscar mensagem de boas-vindas
            const { data: user } = await supabase.auth.getUser();
            if (user?.user?.id) {
              const { data: mensagensPadroes } = await supabase
                .from('mensagens_padroes')
                .select('bem_vindo, enviar_bem_vindo')
                .eq('user_id', user.user.id)
                .maybeSingle();
              
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

                if (!existingWelcome || existingWelcome.length === 0) {
                  const scheduledTime = new Date();
                  scheduledTime.setSeconds(scheduledTime.getSeconds() + 30);
                  
                  await supabase.from('whatsapp_messages').insert({
                    user_id: user.user.id,
                    phone: novoCliente.whatsapp,
                    message: mensagemFinal,
                    status: 'scheduled',
                    session_id: 'welcome_' + novoCliente.whatsapp.replace(/\D/g, ''),
                    sent_at: new Date().toISOString(),
                    scheduled_for: scheduledTime.toISOString(),
                  } as any);
                  
                  toast({
                    title: "Mensagem de boas-vindas",
                    description: "Mensagem agendada para envio em 30 segundos",
                  });
                }
                
                toast({
                  title: "Mensagem de boas-vindas",
                  description: "Mensagem agendada para envio em 30 segundos",
                });
              }
            }
          } catch (welcomeError) {
            console.error("Erro ao enviar mensagem de boas-vindas:", welcomeError);
          }
        }

        // Enviar mensagem de indicação ao indicador
        if (novoCliente?.indicador && novoCliente.whatsapp) {
          try {
            const { data: userAuth } = await supabase.auth.getUser();
            if (userAuth?.user?.id) {
              const { data: msgPadroes } = await supabase
                .from('mensagens_padroes')
                .select('indicacao_convite')
                .eq('user_id', userAuth.user.id)
                .maybeSingle();

              if (msgPadroes?.indicacao_convite) {
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
                    user_id: userAuth.user.id,
                    phone: indicadorData.whatsapp,
                    message: mensagemIndicacao,
                    status: 'scheduled',
                    session_id: 'indicacao_' + indicadorData.whatsapp.replace(/\D/g, ''),
                    sent_at: new Date().toISOString(),
                    scheduled_for: scheduledTime.toISOString(),
                  } as any);
                }
              }
            }
          } catch (indError) {
            console.error("Erro ao enviar mensagem de indicação:", indError);
          }
        }
        
        setSuccessMessage("Cliente criado");
        setShowSuccessDialog(true);
      }
      resetModal();
      setOpen(false);
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
    } finally {
      setLoading(false);
    }
  });

  const handleExportarClientes = () => {
    const dados = clientesFiltrados.map(c => ({
      nome: c.nome || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      data_vencimento: c.data_vencimento ? format(new Date(c.data_vencimento), 'dd/MM/yyyy') : '',
      usuario: c.usuario || '',
      senha: c.senha || '',
      produto: getProdutoNome(c.produto || ''),
      plano: getPlanoNome(c.plano || ''),
      app: getAplicativoNome(c.app || ''),
      telas: c.telas || 1,
      mac: c.mac || '',
      dispositivo: c.dispositivo || '',
      fatura: c.fatura || '',
      indicador: c.indicador || '',
      desconto: c.desconto || '',
      observacao: c.observacao || '',
      status: (c as any).ativo !== false ? 'Ativo' : 'Inativo',
    }));

    const headers = Object.keys(dados[0] || {});
    const csv = [
      headers.join(';'),
      ...dados.map(row => headers.map(h => `"${String((row as any)[h]).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado!", description: `${dados.length} clientes exportados com sucesso.` });
  };

  const handleImportarClientes = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          toast({ title: "Erro", description: "Arquivo vazio ou sem dados", variant: "destructive" });
          return;
        }
        if (lines.length - 1 > 1000) {
          toast({ title: "Erro", description: "A planilha deve ter no máximo 1.000 clientes", variant: "destructive" });
          return;
        }

        const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
        const nomeIdx = headers.findIndex(h => h.toLowerCase() === 'nome');
        const whatsappIdx = headers.findIndex(h => h.toLowerCase() === 'whatsapp');
        const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
        const usuarioIdx = headers.findIndex(h => h.toLowerCase().includes('usuario') || h.toLowerCase().includes('usuário'));
        const senhaIdx = headers.findIndex(h => h.toLowerCase() === 'senha');
        const observacaoIdx = headers.findIndex(h => h.toLowerCase().includes('observa'));
        const aniversarioIdx = headers.findIndex(h => h.toLowerCase().includes('nascimento') || h.toLowerCase().includes('aniversario') || h.toLowerCase().includes('aniversário'));
        const dataVencimentoIdx = headers.findIndex(h => h.toLowerCase().includes('vencimento'));
        const macIdx = headers.findIndex(h => h.toLowerCase() === 'mac');
        const dispositivoIdx = headers.findIndex(h => h.toLowerCase().includes('dispositivo'));

        if (nomeIdx === -1 || whatsappIdx === -1) {
          toast({ title: "Erro", description: "Arquivo deve conter colunas 'nome' e 'whatsapp'", variant: "destructive" });
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let importados = 0;
        let erros = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          const nome = values[nomeIdx];
          const whatsapp = values[whatsappIdx];

          if (!nome || !whatsapp) { erros++; continue; }

          const clienteData: Record<string, unknown> = {
            nome,
            whatsapp,
            email: emailIdx >= 0 ? values[emailIdx] || '' : '',
            usuario: usuarioIdx >= 0 ? values[usuarioIdx] || '' : '',
            senha: senhaIdx >= 0 ? values[senhaIdx] || '' : '',
            observacao: observacaoIdx >= 0 ? values[observacaoIdx] || '' : '',
            user_id: user.id,
          };

          if (aniversarioIdx >= 0 && values[aniversarioIdx]) {
            clienteData.aniversario = values[aniversarioIdx];
          }
          if (dataVencimentoIdx >= 0 && values[dataVencimentoIdx]) {
            clienteData.data_vencimento = values[dataVencimentoIdx];
          }
          if (macIdx >= 0 && values[macIdx]) {
            clienteData.mac = values[macIdx];
          }
          if (dispositivoIdx >= 0 && values[dispositivoIdx]) {
            clienteData.dispositivo = values[dispositivoIdx];
          }

          const { error } = await supabase.from('clientes').insert(clienteData as any);

          if (error) { erros++; } else { importados++; }
        }

        toast({
          title: "Importação concluída",
          description: `${importados} clientes importados${erros > 0 ? `, ${erros} erros` : ''}.`,
        });

        carregarClientes();
      } catch (err) {
        console.error("Erro ao importar:", err);
        toast({ title: "Erro", description: "Erro ao processar arquivo", variant: "destructive" });
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Meus Clientes</h1>
          <p className="text-sm text-muted-foreground">Lista com todos os seus clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportarClientes}>
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Importar
          </Button>
          <input
            id="import-csv"
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleImportarClientes}
          />
          <Button 
            onClick={() => navigate("/clientes/cadastro")}
            className="bg-primary hover:bg-primary/90"
          >
            Adicionar Cliente +
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        {/* Linha 1: Busca, Servidor, Planos, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Busca</Label>
            <Input 
              placeholder="" 
              {...filtros.register("search")}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Servidor</Label>
            <Select onValueChange={(v) => filtros.setValue("produto", v)} disabled={loadingData}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {produtos.map((produto) => (
                  <SelectItem key={produto.id} value={String(produto.id)}>
                    {produto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Planos</Label>
            <Select onValueChange={(v) => filtros.setValue("plano", v)} disabled={loadingData}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {planos.map((plano) => (
                  <SelectItem key={plano.id} value={String(plano.id)}>
                    {plano.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Status</Label>
            <Select onValueChange={(v) => filtros.setValue("status", v)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 2: Data Vencimento Inicial, Data Vencimento Final, Captação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Data Vencimento Inicial</Label>
            <Input 
              type="date"
              placeholder="dd/mm/aaaa"
              {...filtros.register("dataInicial")}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Data Vencimento Final</Label>
            <Input 
              type="date"
              placeholder="dd/mm/aaaa"
              {...filtros.register("dataFinal")}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Captação</Label>
            <Select onValueChange={(v) => filtros.setValue("captacao", v)} value={filtrosValues.captacao || "todos"}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Indicação">Indicação</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button 
              variant="outline"
              onClick={() => filtros.reset({
                dataInicial: "",
                dataFinal: "",
                status: "",
                plano: "",
                produto: "",
                search: "",
                captacao: "",
              })}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Badges de Servidores com Contagem - Clicáveis */}
      {produtosContagem.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {produtosContagem.map((produto) => {
            const isActive = filtrosValues.produto === produto.id;
            return (
              <Badge 
                key={produto.id} 
                variant="outline" 
                className={`px-3 py-1 cursor-pointer transition-colors ${
                  isActive 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card border-border text-foreground hover:bg-muted"
                }`}
                onClick={() => handleFiltrarPorServidor(produto.id)}
              >
                {produto.nome} ({produto.count})
              </Badge>
            );
          })}
        </div>
      )}

      {/* Record count */}
      <div className="text-right text-sm text-muted-foreground">
        Mostrando {Math.min(clientesPaginados.length, itemsPerPage)} de {clientesFiltrados.filter(c => c && c.id).length} registros (Página {currentPage} de {totalPages || 1}).
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto mobile-scroll-x">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-medium">Nome do Cliente:</TableHead>
              <TableHead className="font-medium">Usuário:</TableHead>
              <TableHead className="font-medium">Vencimento:</TableHead>
              <TableHead className="font-medium">Status:</TableHead>
              <TableHead className="font-medium">Plano:</TableHead>
              <TableHead className="font-medium">Servidor:</TableHead>
              <TableHead className="font-medium text-right">Ações:</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingClientes ? (
              <TableRow>
               <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground animate-pulse">Carregando clientes...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : clientesPaginados.length === 0 ? (
              <TableRow>
                 <TableCell colSpan={7} className="text-center py-8">
                   <span className="text-muted-foreground">Nenhum cliente encontrado</span>
                 </TableCell>
              </TableRow>
            ) : (
              clientesPaginados
                .map((cliente, index) => {
                  const { status, venceHoje } = getClienteStatus(cliente);
                  const formattedPhone = cliente.whatsapp ? `+${cliente.whatsapp}` : '-';
                  return (
                    <TableRow 
                      key={cliente.id} 
                      className="hover:bg-muted/20"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{cliente.nome.split(' ').slice(0, 2).join(' ')}</span>
                          <div className="flex items-center gap-1">
                            {cliente.whatsapp && (
                              <svg 
                                viewBox="0 0 24 24" 
                                className="h-3.5 w-3.5 text-success fill-current"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            )}
                            <span className="text-xs text-muted-foreground">{formattedPhone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{cliente.usuario || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {cliente.data_vencimento 
                          ? format(new Date(cliente.data_vencimento), "dd/MM/yyyy")
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={status === 'Inativo'
                            ? 'bg-transparent border-warning text-warning'
                            : status === 'Vencido' 
                            ? 'bg-transparent border-destructive text-destructive' 
                            : venceHoje
                            ? 'bg-transparent border-yellow-500 text-yellow-500'
                            : status === 'Ativo'
                            ? 'bg-transparent border-success text-success'
                            : 'bg-transparent border-muted-foreground text-muted-foreground'
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getPlanoNome(cliente.plano)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-card border-border">
                          {getProdutoNome(cliente.produto)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewCliente(cliente);
                            }}
                            title="Ver dados do cliente"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCliente(cliente);
                            }}
                            title="Editar cliente"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenovarPlano(cliente);
                            }}
                            title="Renovar plano"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificarVencimento(cliente);
                            }}
                            disabled={notificandoId === cliente.id}
                            title="Notificar vencimento"
                          >
                            {notificandoId === cliente.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnviarWhatsApp(cliente);
                            }}
                            title="Enviar WhatsApp"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-accent-foreground hover:text-accent-foreground/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGerarFatura(cliente);
                            }}
                            disabled={gerandoFaturaId === cliente.id}
                            title="Gerar fatura"
                          >
                            {gerandoFaturaId === cliente.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-warning hover:text-warning/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAtivo(cliente);
                            }}
                            title={(cliente as any).ativo === false ? "Ativar cliente" : "Desativar cliente"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCliente(cliente.id!);
                            }}
                            title="Excluir cliente"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 px-2 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm text-muted-foreground">Itens:</span>
              <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-2.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 3) {
                page = i + 1;
              } else if (currentPage <= 2) {
                page = i + 1;
              } else if (currentPage >= totalPages - 1) {
                page = totalPages - 2 + i;
              } else {
                page = currentPage - 1 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2.5" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmitNovoCliente} className="space-y-6">
            {/* Bloco 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome <span className="text-destructive">*</span></Label>
                <Input id="nome" placeholder="Nome" {...form.register("nome")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Whatsapp</Label>
                <div className="flex">
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                  <Input 
                    id="whatsapp" 
                    placeholder="83999999999" 
                    className="rounded-l-none"
                    {...form.register("whatsapp")}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.startsWith(countryCode) && value.length > 11) {
                        value = value.substring(countryCode.length);
                      }
                      form.setValue("whatsapp", value);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Digite apenas DDD + número (ex: 83999999999)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="email opcional" type="email" {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataVenc">Data vencimento <span className="text-destructive">*</span></Label>
                <Input id="dataVenc" type="date" {...form.register("dataVenc")} required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox id="fixo" checked={form.watch("fixo")} onCheckedChange={(v) => form.setValue("fixo", Boolean(v))} />
                <div className="space-y-1">
                  <Label htmlFor="fixo">Data de vencimento fixa</Label>
                  <p className="text-xs text-muted-foreground">
                    mesmo o cliente estando vencido a data será renovada no mesmo dia dos próximos meses
                    <br />
                    <span className="text-primary">Essa opção só é válida para planos mensais</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Bloco 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usuario">Usuário</Label>
                <Input id="usuario" placeholder="usuario opcional" {...form.register("usuario")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" placeholder="senha opcional" type="password" {...form.register("senha")} />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={form.watch("produto")} onValueChange={(v) => form.setValue("produto", v)} disabled={loadingData}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingData ? "Carregando produtos..." : "Selecione um produto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.length === 0 && !loadingData ? (
                      <SelectItem value="no-products" disabled>
                        Nenhum produto cadastrado
                      </SelectItem>
                    ) : (
                      produtos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano <span className="text-destructive">*</span></Label>
                <Select value={form.watch("plano")} onValueChange={(v) => form.setValue("plano", v)} disabled={loadingData} required>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingData ? "Carregando planos..." : "Selecione um plano"} />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.length === 0 && !loadingData ? (
                      <SelectItem value="no-plans" disabled>
                        Nenhum plano cadastrado
                      </SelectItem>
                    ) : (
                      planos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aplicativo</Label>
                <Select value={form.watch("app")} onValueChange={(v) => form.setValue("app", v)} disabled={loadingData}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingData ? "Carregando aplicativos..." : "Selecione um aplicativo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {aplicativos.length === 0 && !loadingData ? (
                      <SelectItem value="no-apps" disabled>
                        Nenhum aplicativo cadastrado
                      </SelectItem>
                    ) : (
                      aplicativos.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataVencApp">Data vencimento app</Label>
                <Input id="dataVencApp" type="date" {...form.register("dataVencApp")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telas">Telas</Label>
                <Input id="telas" type="number" min={1} {...form.register("telas", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mac">Mac</Label>
                <Input id="mac" placeholder="Mac opcional" {...form.register("mac")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispositivo">Dispositivos</Label>
                <Input id="dispositivo" placeholder="Dispositivo opcional" {...form.register("dispositivo")} />
              </div>
              <div className="space-y-2">
                <Label>Fatura</Label>
                <Select defaultValue="Pago" onValueChange={(v) => form.setValue("fatura", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bloco 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key ou otp</Label>
                <Input id="key" placeholder="Key ou otp opcional" {...form.register("key")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Input id="mensagem" placeholder="Se deseja enviar uma mensagem" {...form.register("mensagem")} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Checkbox id="lembretes" checked={form.watch("lembretes")} onCheckedChange={(v) => form.setValue("lembretes", Boolean(v))} />
                <Label htmlFor="lembretes">Ativar lembretes</Label>
              </div>
              <div className="space-y-2">
                <Label>Cliente indicador</Label>
                <Select value={form.watch("indicador")} onValueChange={(v) => form.setValue("indicador", v)} disabled={loadingClientes}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingClientes ? "Carregando clientes..." : "Selecione o indicador"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desconto">Desconto</Label>
                <Input id="desconto" placeholder="R$ 0,00" {...form.register("desconto")} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Checkbox id="descontoRecorrente" checked={form.watch("descontoRecorrente")} onCheckedChange={(v) => form.setValue("descontoRecorrente", Boolean(v))} />
                <Label htmlFor="descontoRecorrente">Desconto recorrente</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aniversario">Aniversário</Label>
                <Input id="aniversario" type="date" {...form.register("aniversario")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea id="observacao" placeholder="Observação opcional" {...form.register("observacao")} />
              </div>
            </div>

            <InlineError message={clienteFormError} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetModal}>Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={loading} className="bg-primary">
                {loading ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Sucesso */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground text-center">
          <div className="flex flex-col items-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full border-2 border-success flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Sucesso</h2>
            <p className="text-muted-foreground">{successMessage}</p>
            <Button onClick={() => setShowSuccessDialog(false)} className="px-8">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar Exclusão do Cliente */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border hover:bg-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCliente} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar Renovação do Plano */}
      <AlertDialog open={renovarDialogOpen} onOpenChange={setRenovarDialogOpen}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar plano</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Confirma a renovação do plano do cliente "{clienteParaRenovar?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              className="border-border hover:bg-muted"
              onClick={() => {
                setRenovarDialogOpen(false);
                setClienteParaRenovar(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              onClick={() => executarRenovacao(true)}
              className="bg-primary hover:bg-primary/90"
              disabled={isRenovando}
            >
              {isRenovando ? "Renovando..." : "Renovar Plano"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Modal de WhatsApp com templates */}
      <Dialog open={whatsappDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setWhatsappDialogOpen(false);
          setClienteParaWhatsapp(null);
          setWhatsappTemplate("");
          setWhatsappMensagem("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enviando para: <span className="font-medium text-foreground">{clienteParaWhatsapp?.nome}</span>
            </div>

            <div className="space-y-2">
              <Label>Escolha um template (opcional)</Label>
              <Select 
                value={whatsappTemplate} 
                onValueChange={(value) => {
                  setWhatsappTemplate(value);
                }}
                disabled={!!whatsappMensagem.trim()}
              >
                <SelectTrigger className={whatsappMensagem.trim() ? "opacity-50" : ""}>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {allTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whatsappMensagem.trim() && (
                <p className="text-xs text-muted-foreground">Limpe a mensagem para escolher outro template</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Digite sua mensagem ou selecione um template acima..."
                value={whatsappMensagem}
                onChange={(e) => {
                  setWhatsappMensagem(e.target.value);
                  // Limpar template se digitar mensagem
                  if (e.target.value.trim()) setWhatsappTemplate("");
                }}
                className="min-h-[120px] resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setWhatsappDialogOpen(false);
                  setClienteParaWhatsapp(null);
                  setWhatsappTemplate("");
                  setWhatsappMensagem("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarEnvioWhatsApp}
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                disabled={sendingMessage || (!whatsappTemplate && !whatsappMensagem.trim())}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingMessage ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar ativar/desativar cliente */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(clienteParaToggle as any)?.ativo === false ? "Ativar" : "Desativar"} cliente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Deseja {(clienteParaToggle as any)?.ativo === false ? "ativar" : "desativar"} o cliente "{clienteParaToggle?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-border hover:bg-muted"
              onClick={() => {
                setToggleDialogOpen(false);
                setClienteParaToggle(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarToggleAtivo}
              className={(clienteParaToggle as any)?.ativo === false 
                ? "bg-success hover:bg-success/90 text-success-foreground" 
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }
            >
              {(clienteParaToggle as any)?.ativo === false ? "Ativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Ver Dados do Cliente */}
      <Dialog open={!!viewCliente} onOpenChange={(open) => !open && setViewCliente(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Dados do Cliente</DialogTitle>
          </DialogHeader>
          {viewCliente && (() => {
            const copyToClipboard = (text: string, label: string) => {
              navigator.clipboard.writeText(text);
              toast({ title: "Copiado!", description: `${label} copiado para a área de transferência` });
            };

            const CopyableField = ({ label, value }: { label: string; value: string }) => (
              <div>
                <span className="text-muted-foreground block">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{value || '-'}</span>
                  {value && value !== '-' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(value, label)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );

            const StaticField = ({ label, value }: { label: string; value: string }) => (
              <div>
                <span className="text-muted-foreground block">{label}</span>
                <span className="font-medium">{value || '-'}</span>
              </div>
            );

            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <StaticField label="Nome" value={viewCliente.nome} />
                  <CopyableField label="WhatsApp" value={viewCliente.whatsapp ? `+${viewCliente.whatsapp}` : ''} />
                  <CopyableField label="Email" value={viewCliente.email} />
                  <StaticField label="Vencimento" value={viewCliente.data_vencimento ? format(new Date(viewCliente.data_vencimento), 'dd/MM/yyyy') : ''} />
                  <CopyableField label="Usuário" value={viewCliente.usuario} />
                  <CopyableField label="Senha" value={viewCliente.senha} />
                  <StaticField label="Plano" value={getPlanoNome(viewCliente.plano)} />
                  <StaticField label="Servidor" value={getProdutoNome(viewCliente.produto)} />
                  <StaticField label="Aplicativo" value={getAplicativoNome(viewCliente.app)} />
                  <StaticField label="Telas" value={String(viewCliente.telas || 1)} />
                  <CopyableField label="MAC" value={viewCliente.mac} />
                  <CopyableField label="Dispositivo" value={viewCliente.dispositivo} />
                  <StaticField label="Fatura" value={viewCliente.fatura} />
                  <CopyableField label="Key" value={viewCliente.key} />
                  <StaticField label="Desconto" value={viewCliente.desconto} />
                  <StaticField label="Aniversário" value={viewCliente.aniversario} />
                </div>
                {viewCliente.observacao && (
                  <div>
                    <span className="text-muted-foreground block">Observação</span>
                    <span className="font-medium">{viewCliente.observacao}</span>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewCliente(null);
                      handleEditCliente(viewCliente);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <ImportClientesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportPlanilha={() => document.getElementById('import-csv')?.click()}
        onImportComplete={carregarClientes}
        onImportSigma={() => setImportSigmaOpen(true)}
      />
      <ImportSigmaDialog
        open={importSigmaOpen}
        onOpenChange={setImportSigmaOpen}
        onImportComplete={carregarClientes}
      />
    </main>
  );
}
