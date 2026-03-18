import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlanos } from "@/hooks/useDatabase";

const formatCurrencyBRL = (value: string) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const number = Number(digits) / 100;
  if (isNaN(number)) return "R$ 0,00";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function PlanosEditar() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { atualizar, buscarPorId } = usePlanos();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    tipo: "meses",
    quantidade: "1",
    descricao: "",
  });

  useEffect(() => {
    document.title = "Editar Plano | Tech Play";
    
    const carregarPlano = async () => {
      if (!id) {
        navigate("/planos");
        return;
      }
      
      setLoadingData(true);
      try {
        const plano = await buscarPorId(id);
        if (plano) {
          setFormData({
            nome: plano.nome || "",
            valor: plano.valor ? (plano.valor.toString().trim().startsWith("R$") ? plano.valor : formatCurrencyBRL(plano.valor.toString())) : "",
            tipo: plano.tipo || "meses",
            quantidade: plano.quantidade || "1",
            descricao: plano.descricao || "",
          });
        } else {
          toast({
            title: "Erro",
            description: "Plano não encontrado",
            variant: "destructive",
          });
          navigate("/planos");
        }
      } catch (error) {
        console.error("Erro ao carregar plano:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados do plano",
          variant: "destructive",
        });
        navigate("/planos");
      } finally {
        setLoadingData(false);
      }
    };

    carregarPlano();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      await atualizar(id, formData);
      
      toast({
        title: "Sucesso",
        description: "Plano atualizado com sucesso!",
      });
      
      navigate("/planos");
    } catch (error) {
      console.error("Erro ao atualizar plano:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar plano",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <List className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Editar Plano</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2" data-field="nome">
                <Label className="text-sm font-medium">Nome do Plano <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Nome do plano" 
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
                <Label className="text-sm font-medium">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meses">Meses</SelectItem>
                    <SelectItem value="dias">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Período</Label>
                <Input 
                  type="number"
                  min="1"
                  placeholder="1"
                  className="bg-background border-border"
                  value={formData.quantidade}
                  onChange={(e) => handleInputChange("quantidade", e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Descrição</Label>
                <Textarea 
                  placeholder="Descrição do plano"
                  className="bg-background border-border min-h-[100px] resize-none"
                  value={formData.descricao}
                  onChange={(e) => handleInputChange("descricao", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/planos")}
              >
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
