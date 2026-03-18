import { useEffect, useState } from "react";
import { useTemplatesCobranca, useClientes, usePlanos } from "@/hooks/useDatabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit2, Copy, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MensagensCobranca() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [templateEditando, setTemplateEditando] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [nomeTemplate, setNomeTemplate] = useState("");
  const [mensagem, setMensagem] = useState("");
  
  const { criar, atualizar, buscar, deletar, restaurarPadroes } = useTemplatesCobranca();
  const { buscar: buscarClientes } = useClientes();
  const { buscar: buscarPlanos } = usePlanos();
  const { userId } = useCurrentUser();
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [templateParaExcluir, setTemplateParaExcluir] = useState<any>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [restaurandoPadroes, setRestaurandoPadroes] = useState(false);
  const [restaurarDialogOpen, setRestaurarDialogOpen] = useState(false);
  
  // Estados para gerar mensagem
  const [gerarMensagemOpen, setGerarMensagemOpen] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [mensagemGerada, setMensagemGerada] = useState("");

  useEffect(() => {
    document.title = "Templates | Gestor Tech Play";
    const d = document.querySelector('meta[name="description"]') || document.createElement('meta');
    d.setAttribute('name', 'description');
    d.setAttribute('content', 'Templates de mensagens para seus clientes.');
    if (!d.parentElement) document.head.appendChild(d);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    // Recarrega assim que o usuário estiver definido
    if (!userId) return;
    
    const inicializar = async () => {
      await carregarTemplates();
      await carregarDados();
    };
    
    inicializar();
  }, [userId]);

  const carregarDados = async () => {
    try {
      const [clientesData, planosData] = await Promise.all([
        buscarClientes(),
        buscarPlanos(),
      ]);
      setClientes(clientesData || []);
      setPlanos(planosData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const carregarTemplates = async () => {
    const dados = await buscar();
    const LEGACY = "usuario@email.com ou 11999999999 ou CPF";
    const sane = (dados || []).map((t: any) => ({
      ...t,
      chave_pix: t?.chave_pix === LEGACY ? "" : (t?.chave_pix || ""),
    }));
    setTemplates(sane);
  };

  const handleGerarMensagem = (template: any) => {
    setTemplateSelecionado(template);
    setClienteSelecionado("");
    setMensagemGerada("");
    setGerarMensagemOpen(true);
  };

  const gerarMensagemComDados = () => {
    if (!clienteSelecionado) {
      toast.error("Selecione um cliente");
      return;
    }

    const cliente = clientes.find(c => c.id === clienteSelecionado);
    if (!cliente) {
      toast.error("Cliente não encontrado");
      return;
    }

    // Utilitários de busca e parsing
    const sanitizeNumber = (val: any) => {
      if (val === null || val === undefined) return 0;
      const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const normalize = (s: any) => String(s ?? '').trim().toLowerCase();

    const findPlano = () => {
      const cliVal = cliente.plano;
      // 1) por id
      let p = planos.find(pl => String(pl.id) === String(cliVal));
      if (p) return p;
      // 2) por nome exato (case-insensitive)
      p = planos.find(pl => normalize(pl.nome) === normalize(cliVal));
      if (p) return p;
      // 3) por inclusão parcial (nome contém valor do cliente)
      p = planos.find(pl => normalize(pl.nome).includes(normalize(cliVal)) || normalize(cliVal).includes(normalize(pl.nome)));
      return p;
    };

    const plano = findPlano();
    const planoNome = plano?.nome || cliente.plano || "N/A";
    const valorPlano = sanitizeNumber(plano?.valor);
    
    // Determinar saudação baseada na hora
    const hora = new Date().getHours();
    let saudacao = "Bom dia";
    if (hora >= 12 && hora < 18) {
      saudacao = "Boa tarde";
    } else if (hora >= 18) {
      saudacao = "Boa noite";
    }
    
    let dataVencimento = "N/A";
    if (cliente.data_vencimento) {
      try {
        dataVencimento = format(new Date(cliente.data_vencimento), "dd/MM/yyyy");
      } catch {
        dataVencimento = cliente.data_vencimento;
      }
    }

    // Calcular desconto e total
    const desconto = sanitizeNumber(cliente.desconto);
    const total = Math.max(0, valorPlano - desconto);

    // Substituir variáveis na mensagem (robusto com sinônimos)
    let mensagemFinal = templateSelecionado?.mensagem || "";

    const f2 = (n: number) => n.toFixed(2);
    const normalizeKey = (s: any) => String(s ?? "").toLowerCase().replace(/[\s_-]/g, "");

    const map: Record<string, string> = {
      saudacao,
      nome: cliente.nome || "",
      cliente: cliente.nome || "",
      nomecliente: cliente.nome || "",
      plano: planoNome,
      valor: f2(valorPlano),
      valorplano: f2(valorPlano),
      desconto: f2(desconto),
      total: f2(total),
      vencimento: dataVencimento,
      datavencimento: dataVencimento,
      usuario: cliente.usuario || cliente.email || "",
      senha: cliente.senha || "",
    };

    console.log('Cliente dados para template:', {
      nome: cliente.nome,
      usuario: cliente.usuario,
      senha: cliente.senha,
      email: cliente.email
    });

    mensagemFinal = mensagemFinal.replace(/\{([^{}]+)\}/g, (full, key) => {
      const k = normalizeKey(key);
      return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : full;
    });

    // Passo extra de segurança para {usuario} e {senha}
    mensagemFinal = mensagemFinal.replace(/\{\s*(usuario|user|login)\s*\}/gi, map.usuario);
    mensagemFinal = mensagemFinal.replace(/\{\s*(senha|password|pwd)\s*\}/gi, map.senha);

    setMensagemGerada(mensagemFinal);
  };

  const copiarMensagem = () => {
    if (!mensagemGerada) {
      toast.error("Gere a mensagem primeiro");
      return;
    }

    navigator.clipboard.writeText(mensagemGerada);
    toast.success("Mensagem copiada!");
  };
  const abrirModalEdicao = (template: any) => {
    setEditando(true);
    setTemplateEditando(template);
    setNomeTemplate(template.nome);
    setMensagem(template.mensagem || "");
    setOpen(true);
  };

  const abrirModalCriacao = () => {
    setEditando(false);
    setTemplateEditando(null);
    setNomeTemplate("");
    setMensagem("");
    setOpen(true);
  };

  const fecharModal = () => {
    setOpen(false);
    setEditando(false);
    setTemplateEditando(null);
    setNomeTemplate("");
    setMensagem("");
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editando && templateEditando) {
        await atualizar(templateEditando.id, {
          nome: nomeTemplate,
          mensagem: mensagem,
          incluir_cartao: false,
          incluir_chave_pix: false,
          chave_pix: ""
        });
      } else {
        await criar({
          nome: nomeTemplate,
          mensagem: mensagem,
          incluir_cartao: false,
          incluir_chave_pix: false,
          chave_pix: ""
        });
      }
      await carregarTemplates();
      toast.success(editando ? 'Template atualizado!' : 'Template salvo!');
      fecharModal();
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error('Erro ao salvar template');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalExclusao = (template: any) => {
    setTemplateParaExcluir(template);
    setAlertDialogOpen(true);
  };

  const confirmarExclusao = async () => {
    if (!templateParaExcluir?.id) return;
    setDeletandoId(templateParaExcluir.id);
    try {
      await deletar(templateParaExcluir.id);
      await carregarTemplates();
      toast.success('Template excluído!');
    } catch (error) {
      console.error("Erro ao excluir template:", error);
      toast.error('Erro ao excluir template');
    } finally {
      setDeletandoId(null);
      setTemplateParaExcluir(null);
      setAlertDialogOpen(false);
    }
  };

  const handleRestaurarPadroes = async () => {
    setRestaurandoPadroes(true);
    try {
      await restaurarPadroes();
      await carregarTemplates();
      setRestaurarDialogOpen(false);
    } catch (error) {
      console.error("Erro ao restaurar templates:", error);
    } finally {
      setRestaurandoPadroes(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Templates</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setRestaurarDialogOpen(true)}
            variant="outline"
          >
            Limpar Todos
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={abrirModalCriacao} className="bg-cyan-500 hover:bg-cyan-600">Novo</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar template" : "Novo template"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do template</Label>
                <Input
                  id="nome"
                  required
                  value={nomeTemplate}
                  onChange={(e) => setNomeTemplate(e.target.value)}
                  placeholder="Digite o nome do template"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={8}
                  placeholder="Digite sua mensagem..."
                />
              </div>

              <div className="space-y-2">
                <Label>Escolha uma foto, vídeo, áudio ou PDF (opcional)</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                  <Button type="button" variant="outline" size="sm">
                    Escolher ficheiro
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">Nenhum ficheiro selecionado</p>
                </div>
              </div>

              <div className="pt-2 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Variáveis disponíveis nos templates:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{"{saudacao}"} - Saudação baseada no horário (Bom dia, Boa tarde, Boa noite)</li>
                  <li>{"{nome}"}, {"{cliente}"} ou {"{nome_cliente}"} - Nome do cliente</li>
                  <li>{"{usuario}"} - Usuário do cliente</li>
                  <li>{"{senha}"} - Senha do cliente</li>
                  <li>{"{plano}"} - Nome do plano</li>
                  <li>{"{valor}"} ou {"{valor_plano}"} - Valor do plano</li>
                  <li>{"{desconto}"} - Desconto aplicado</li>
                  <li>{"{total}"} - Total após desconto (valor - desconto)</li>
                  <li>{"{vencimento}"} ou {"{data_vencimento}"} - Data de vencimento</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={fecharModal} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                >
                  {loading ? "Processando..." : (editando ? "Atualizar" : "Salvar")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{templateParaExcluir?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarExclusao}
              disabled={deletandoId === templateParaExcluir?.id}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletandoId === templateParaExcluir?.id ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restaurarDialogOpen} onOpenChange={setRestaurarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os templates?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover todos os templates? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestaurarPadroes}
              disabled={restaurandoPadroes}
              className="bg-destructive hover:bg-destructive/90"
            >
              {restaurandoPadroes ? "Removendo..." : "Limpar Todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={gerarMensagemOpen} onOpenChange={setGerarMensagemOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar mensagem personalizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template: {templateSelecionado?.nome}</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Selecione o cliente</Label>
              <Select 
                value={clienteSelecionado} 
                onValueChange={(value) => {
                  setClienteSelecionado(value);
                  // Gerar automaticamente quando selecionar o cliente
                  setTimeout(() => {
                    if (value) {
                      const botaoGerar = document.querySelector('[data-gerar-mensagem]') as HTMLButtonElement;
                      if (botaoGerar) botaoGerar.click();
                    }
                  }, 100);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              data-gerar-mensagem
              onClick={gerarMensagemComDados}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              Gerar mensagem
            </Button>

            {mensagemGerada && (
              <div className="space-y-2">
                <Label>Mensagem gerada</Label>
                <Textarea
                  value={mensagemGerada}
                  readOnly
                  rows={10}
                  className="bg-muted"
                />
                <Button 
                  onClick={copiarMensagem}
                  variant="outline"
                  className="w-full"
                >
                  Copiar mensagem
                </Button>
              </div>
            )}

            <div className="pt-2 text-sm text-muted-foreground">
              <p className="font-medium mb-1">Variáveis disponíveis:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{"{saudacao}"} - Saudação baseada no horário (Bom dia, Boa tarde, Boa noite)</li>
                <li>{"{nome}"}, {"{cliente}"} ou {"{nome_cliente}"} - Nome do cliente</li>
                <li>{"{usuario}"} - Usuário do cliente</li>
                <li>{"{senha}"} - Senha do cliente</li>
                <li>{"{plano}"} - Nome do plano</li>
                <li>{"{valor}"} ou {"{valor_plano}"} - Valor do plano</li>
                <li>{"{desconto}"} - Desconto aplicado</li>
                <li>{"{total}"} - Total após desconto (valor - desconto)</li>
                <li>{"{vencimento}"} ou {"{data_vencimento}"} - Data de vencimento</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates de mensagens</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Mídia</TableHead>
                  <TableHead>Padrão</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template, index) => (
                  <TableRow key={template.id || index}>
                    <TableCell className="font-medium">{template.nome}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {template.midia || "NÃO"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.padrao ? (
                        <div className="w-4 h-4 bg-primary rounded-sm"></div>
                      ) : (
                        <div className="w-4 h-4 border border-muted-foreground rounded-sm"></div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0"
                          onClick={() => abrirModalEdicao(template)}
                          title="Editar template"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleGerarMensagem(template)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => abrirModalExclusao(template)}
                          disabled={deletandoId === template.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            Mostrando 1 até {templates.length} de {templates.length} resultados
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
