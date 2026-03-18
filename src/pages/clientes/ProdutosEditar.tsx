import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProdutos } from "@/hooks/useDatabase";
import { supabase } from "@/lib/supabase";


const formatCurrencyBRL = (value: string) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const number = Number(digits) / 100;
  if (isNaN(number)) return "R$ 0,00";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const PROVIDER_LABELS: Record<string, string> = {
  'mundogf': 'MundoGF',
  'koffice-api': 'KOffice API',
  'koffice-v2': 'KOffice V2',
  'uniplay': 'Uniplay e Franquias',
  'sigma': 'Sigma',
  'playfast': 'Playfast',
  'unitv': 'UniTV',
};

const PROVEDORES_COM_P2P = ['mundogf'];

export default function ProdutosEditar() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { atualizar, buscarPorId } = useProdutos();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paineis, setPaineis] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    creditos: "",
    descricao: "",
    configuracoesIptv: false,
    provedorIptv: "",
    painelId: "",
    renovacaoAutomatica: false,
    tipoServico: "iptv" as "iptv" | "p2p",
    gateway: "",
  });

  useEffect(() => {
    document.title = "Editar Produto | Tech Play";
    carregarPaineis();
    
    const carregar = async () => {
      if (!id) { navigate("/produtos"); return; }
      setLoadingData(true);
      try {
        // Fetch produto with painel_id
        const { data: produto, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !produto) {
          toast({ title: "Erro", description: "Produto não encontrado", variant: "destructive" });
          navigate("/produtos");
          return;
        }

        setFormData({
          nome: produto.nome || "",
          valor: produto.valor ? (produto.valor.toString().trim().startsWith("R$") ? produto.valor : formatCurrencyBRL(produto.valor.toString())) : "",
          creditos: produto.creditos || "",
          descricao: produto.descricao || "",
          configuracoesIptv: produto.configuracoes_iptv ?? false,
          provedorIptv: produto.provedor_iptv ?? "",
          painelId: (produto as any).painel_id ?? "",
          renovacaoAutomatica: produto.renovacao_automatica ?? false,
          tipoServico: ((produto as any).tipo_servico as "iptv" | "p2p") ?? "iptv",
          gateway: (produto as any).gateway ?? "",
        });
      } catch (error) {
        console.error("Erro ao carregar produto:", error);
        toast({ title: "Erro", description: "Erro ao carregar dados do produto", variant: "destructive" });
        navigate("/produtos");
      } finally {
        setLoadingData(false);
      }
    };
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [servidoresAtivos, setServidoresAtivos] = useState<string[]>([]);

  const carregarPaineis = async () => {
    const { data } = await supabase
      .from('paineis_integracao')
      .select('id, nome, provedor')
      .order('nome');
    setPaineis(data || []);
  };

  const carregarServidoresAtivos = async () => {
    const { data } = await supabase
      .from('system_servidores')
      .select('id')
      .in('status', ['ativo', 'manutencao']);
    setServidoresAtivos((data || []).map(s => s.id));
  };

  useEffect(() => {
    carregarServidoresAtivos();
  }, []);

  const paineisFiltrados = paineis.filter(p => p.provedor === formData.provedorIptv);
  const provedoresDisponiveis = [...new Set(paineis.map(p => p.provedor))].filter(p => servidoresAtivos.includes(p));

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'provedorIptv') {
        // Auto-select panel if only one matches the new provider
        const matching = paineis.filter(p => p.provedor === value);
        updated.painelId = matching.length === 1 ? matching[0].id : '';
        if (!PROVEDORES_COM_P2P.includes(value as string)) {
          updated.tipoServico = 'iptv';
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.nome.trim()) errors.nome = "Campo obrigatório";
    if (!formData.valor.trim()) errors.valor = "Campo obrigatório";

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
    if (!id) return;

    setLoading(true);
    try {
      // Auto-select painel if only one matches and none selected
      let painelIdToSave = formData.painelId;
      if (!painelIdToSave && formData.configuracoesIptv && formData.provedorIptv) {
        const matching = paineis.filter(p => p.provedor === formData.provedorIptv);
        if (matching.length === 1) painelIdToSave = matching[0].id;
      }

      // Use supabase directly to include painel_id
      const { error } = await supabase.from('produtos').update({
        nome: formData.nome,
        valor: formData.valor,
        creditos: formData.creditos,
        descricao: formData.descricao,
        configuracoes_iptv: formData.configuracoesIptv,
        provedor_iptv: formData.provedorIptv || null,
        painel_id: painelIdToSave || null,
        renovacao_automatica: formData.renovacaoAutomatica,
        tipo_servico: formData.tipoServico,
        gateway: formData.gateway || null,
      }).eq('id', id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Produto atualizado com sucesso!" });
      navigate("/produtos");
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      toast({ title: "Erro", description: "Erro ao atualizar produto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Editar Produto</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2" data-field="nome">
                <Label className="text-sm font-medium">Nome do Produto <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Nome do produto" 
                  className={`bg-background border-border ${fieldErrors.nome ? 'border-destructive' : ''}`}
                  value={formData.nome}
                  onChange={(e) => { handleInputChange("nome", e.target.value); setFieldErrors(prev => ({ ...prev, nome: '' })); }}
                />
                {fieldErrors.nome && <span className="text-xs text-destructive">{fieldErrors.nome}</span>}
              </div>
              
              <div className="space-y-2" data-field="valor">
                <Label className="text-sm font-medium">Valor <span className="text-destructive">*</span></Label>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={`bg-background border-border ${fieldErrors.valor ? 'border-destructive' : ''}`}
                  value={formData.valor}
                  onChange={(e) => { handleInputChange("valor", formatCurrencyBRL(e.target.value)); setFieldErrors(prev => ({ ...prev, valor: '' })); }}
                />
                {fieldErrors.valor && <span className="text-xs text-destructive">{fieldErrors.valor}</span>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Créditos</Label>
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <Input 
                  placeholder="Quantidade de créditos"
                  className="bg-background border-border"
                  value={formData.creditos}
                  onChange={(e) => handleInputChange("creditos", e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Descrição</Label>
                <Textarea 
                  placeholder="Descrição do produto"
                  className="bg-background border-border min-h-[100px] resize-none"
                  value={formData.descricao}
                  onChange={(e) => handleInputChange("descricao", e.target.value)}
                />
              </div>
            </div>

            {/* Configurações IPTV */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="configIptv"
                  checked={formData.configuracoesIptv}
                  onChange={(e) => handleInputChange("configuracoesIptv", e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="configIptv" className="cursor-pointer text-sm font-medium">Configurações IPTV</Label>
              </div>

              {formData.configuracoesIptv && (
                <div className="space-y-3 pl-6 border-l-2 border-border">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Provedor IPTV</Label>
                    <Select value={formData.provedorIptv} onValueChange={(value) => handleInputChange("provedorIptv", value)}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione o provedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {provedoresDisponiveis.map((prov) => (
                          <SelectItem key={prov} value={prov}>
                            {PROVIDER_LABELS[prov] || prov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.provedorIptv && PROVEDORES_COM_P2P.includes(formData.provedorIptv) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipo de Serviço</Label>
                      <Select value={formData.tipoServico} onValueChange={(value) => handleInputChange("tipoServico", value)}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iptv">IPTV</SelectItem>
                          <SelectItem value="p2p">P2P</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Este servidor suporta IPTV e P2P</p>
                    </div>
                  )}

                  {formData.provedorIptv && paineisFiltrados.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Painel Específico</Label>
                      <Select value={formData.painelId} onValueChange={(value) => handleInputChange("painelId", value)}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder={paineisFiltrados.length === 1 ? paineisFiltrados[0].nome : "Selecione o painel..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {paineisFiltrados.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {paineisFiltrados.length === 1 
                          ? "Único painel disponível — será usado automaticamente" 
                          : "Escolha qual painel será usado para renovação"}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Renovação Automática</Label>
                      <p className="text-xs text-muted-foreground">Renova automaticamente no servidor IPTV</p>
                    </div>
                    <Switch
                      checked={formData.renovacaoAutomatica}
                      onCheckedChange={(checked) => handleInputChange("renovacaoAutomatica", checked)}
                    />
                  </div>

                  {provedoresDisponiveis.length === 0 ? (
                    <div className="flex items-center gap-2 text-warning text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Nenhum painel IPTV configurado. Configure em Servidores.</span>
                    </div>
                  ) : formData.provedorIptv && paineisFiltrados.length > 0 ? (
                    <div className="flex items-center gap-2 text-primary text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>{paineisFiltrados.length} painel(éis) {PROVIDER_LABELS[formData.provedorIptv] || formData.provedorIptv} disponível(eis)</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Gateway de Cobrança */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div>
                <Label className="text-sm font-medium">Gateway de Cobrança</Label>
                <p className="text-xs text-muted-foreground">Deixe em "Padrão global" para usar o gateway configurado no sistema. Selecione outro para usar um gateway específico para este produto.</p>
              </div>
              <Select value={formData.gateway || "global"} onValueChange={(value) => handleInputChange("gateway", value === "global" ? "" : value)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Padrão global (sistema)</SelectItem>
                  <SelectItem value="asaas">Asaas</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="v3pay">V3Pay PF</SelectItem>
                  <SelectItem value="v3pay_pj">V3Pay PJ</SelectItem>
                  <SelectItem value="ciabra">Ciabra</SelectItem>
                  <SelectItem value="woovi">Woovi</SelectItem>
                </SelectContent>
              </Select>
              {formData.gateway && (
                <p className="text-xs text-primary">✅ Cobranças deste produto usarão: <strong>{({ mercadopago: 'Mercado Pago', v3pay: 'V3Pay PF', v3pay_pj: 'V3Pay PJ' } as Record<string, string>)[formData.gateway] || formData.gateway.charAt(0).toUpperCase() + formData.gateway.slice(1)}</strong></p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/produtos")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
