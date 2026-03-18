import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { useTemplatesMensagens } from "@/hooks/useTemplatesMensagens";
import { availableVariableKeys } from "@/utils/message-variables";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function TemplateEditar() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateTemplate } = useTemplatesMensagens();
  const { user } = useCurrentUser();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome: "",
    mensagem: "",
  });

  useEffect(() => {
    document.title = "Editar Template | Tech Play";

    const carregarTemplate = async () => {
      if (!id) {
        navigate("/whatsapp/templates");
        return;
      }

      // Wait for user to be available
      if (!user?.id) return;

      setLoadingData(true);
      try {
        const { data, error } = await supabase
          .from("templates_mensagens")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error || !data) {
          navigate("/whatsapp/templates");
          return;
        }

        setFormData({
          nome: data.nome || "",
          mensagem: data.mensagem || "",
        });
      } catch (error) {
        console.error("Erro ao carregar template:", error);
        navigate("/whatsapp/templates");
      } finally {
        setLoadingData(false);
      }
    };

    carregarTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.nome.trim()) errors.nome = "Campo obrigatório";
    if (!formData.mensagem.trim()) errors.mensagem = "Campo obrigatório";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    if (!id) return;

    setLoading(true);
    try {
      await updateTemplate(id, {
        nome: formData.nome,
        mensagem: formData.mensagem,
      });

      navigate("/whatsapp/templates");
    } catch (error) {
      console.error("Erro ao atualizar template:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border border-border/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground">Carregando dados do template...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Editar Template</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2" data-field="nome">
              <Label className="text-sm font-medium">Nome do Template <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Digite o nome do template"
                className={`bg-background border-border ${fieldErrors.nome ? 'border-destructive' : ''}`}
                value={formData.nome}
                onChange={(e) => { handleInputChange("nome", e.target.value); setFieldErrors(prev => ({ ...prev, nome: '' })); }}
              />
              {fieldErrors.nome && <span className="text-xs text-destructive">{fieldErrors.nome}</span>}
            </div>

            <div className="space-y-2" data-field="mensagem">
              <Label className="text-sm font-medium">Mensagem <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {availableVariableKeys.map((key) => (
                  <span
                    key={key}
                    className="text-primary text-xs bg-primary/10 px-2 py-1 rounded cursor-pointer hover:bg-primary/20"
                    onClick={() => setFormData(prev => ({ ...prev, mensagem: prev.mensagem + key }))}
                  >
                    {key}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Use <span className="text-primary">{"{br}"}</span> para quebra de linha.
              </p>
              <Textarea
                placeholder="Digite a mensagem do template"
                className={`bg-background border-border min-h-[150px] resize-none ${fieldErrors.mensagem ? 'border-destructive' : ''}`}
                value={formData.mensagem}
                onChange={(e) => { handleInputChange("mensagem", e.target.value); setFieldErrors(prev => ({ ...prev, mensagem: '' })); }}
              />
              {fieldErrors.mensagem && <span className="text-xs text-destructive">{fieldErrors.mensagem}</span>}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/whatsapp/templates")}
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
