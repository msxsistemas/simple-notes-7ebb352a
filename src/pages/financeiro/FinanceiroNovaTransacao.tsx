import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign } from "lucide-react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { toast } from "sonner";

const formatCurrencyBRL = (value: string) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const number = Number(digits) / 100;
  if (isNaN(number)) return "R$ 0,00";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function FinanceiroNovaTransacao() {
  const navigate = useNavigate();
  const { salvarTransacao } = useFinanceiro();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    valor: "",
    tipo: "" as "" | "entrada" | "saida",
    descricao: "",
  });

  useEffect(() => {
    document.title = "Nova Transação | Gestor Tech Play";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.valor.trim()) errors.valor = "Campo obrigatório";
    if (!formData.tipo) errors.tipo = "Campo obrigatório";
    if (!formData.descricao.trim()) errors.descricao = "Campo obrigatório";

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

    setLoading(true);
    try {
      const valorStr = formData.valor.replace(/[R$\s]/g, '').replace(',', '.');
      const valor = parseFloat(valorStr);

      if (isNaN(valor) || valor <= 0) {
        setFieldErrors(prev => ({ ...prev, valor: "Valor inválido" }));
        setLoading(false);
        return;
      }

      await salvarTransacao({
        valor,
        tipo: formData.tipo as "entrada" | "saida",
        descricao: formData.descricao,
      });

      toast.success("Transação criada com sucesso!");
      navigate("/financeiro");
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast.error("Erro ao salvar transação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Nova Transação</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2" data-field="valor">
                <Label className="text-sm font-medium">Valor <span className="text-destructive">*</span></Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={`bg-background border-border ${fieldErrors.valor ? 'border-destructive' : ''}`}
                  value={formData.valor}
                  onChange={(e) => { setFormData(prev => ({ ...prev, valor: formatCurrencyBRL(e.target.value) })); setFieldErrors(prev => ({ ...prev, valor: '' })); }}
                />
                {fieldErrors.valor && <span className="text-xs text-destructive">{fieldErrors.valor}</span>}
              </div>

              <div className="space-y-2" data-field="tipo">
                <Label className="text-sm font-medium">Tipo <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: "entrada" | "saida") => { setFormData(prev => ({ ...prev, tipo: value })); setFieldErrors(prev => ({ ...prev, tipo: '' })); }}
                >
                  <SelectTrigger className={`bg-background border-border ${fieldErrors.tipo ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.tipo && <span className="text-xs text-destructive">{fieldErrors.tipo}</span>}
              </div>

              <div className="space-y-2 md:col-span-2" data-field="descricao">
                <Label className="text-sm font-medium">Descrição <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Nome do cliente&#10;Plano: Mensal"
                  rows={4}
                  className={`bg-background border-border resize-none ${fieldErrors.descricao ? 'border-destructive' : ''}`}
                  value={formData.descricao}
                  onChange={(e) => { setFormData(prev => ({ ...prev, descricao: e.target.value })); setFieldErrors(prev => ({ ...prev, descricao: '' })); }}
                />
                {fieldErrors.descricao && <span className="text-xs text-destructive">{fieldErrors.descricao}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/financeiro")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Cadastrar Transação"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
