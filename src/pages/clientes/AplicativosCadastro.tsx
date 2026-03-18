import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAplicativos } from "@/hooks/useDatabase";

export default function AplicativosCadastro() {
  const navigate = useNavigate();
  const { criar } = useAplicativos();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
  });

  useEffect(() => {
    document.title = "Adicionar Aplicativo | Tech Play";
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.nome.trim()) errors.nome = "Campo obrigatório";

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
      await criar(formData);
      
      toast({
        title: "Sucesso",
        description: "Aplicativo cadastrado com sucesso!",
      });
      
      navigate("/aplicativos");
    } catch (error) {
      console.error("Erro ao salvar aplicativo:", error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar aplicativo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Card do Formulário */}
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Cadastrar Novo Aplicativo</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2" data-field="nome">
                <Label className="text-sm font-medium">Nome do Aplicativo <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Nome do aplicativo" 
                  className={`bg-background border-border ${fieldErrors.nome ? 'border-destructive' : ''}`}
                  value={formData.nome}
                  onChange={(e) => { handleInputChange("nome", e.target.value); setFieldErrors(prev => ({ ...prev, nome: '' })); }}
                />
                {fieldErrors.nome && <span className="text-xs text-destructive">{fieldErrors.nome}</span>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Descrição</Label>
                <Textarea 
                  placeholder="Descrição do aplicativo"
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
                onClick={() => navigate("/aplicativos")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Cadastrar Aplicativo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
