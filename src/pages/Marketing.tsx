import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAplicativos, usePlanos, useProdutos, useTemplatesCobranca } from "@/hooks/useDatabase";

export default function Marketing() {
  // SEO
  useEffect(() => {
    document.title = "Marketing | Gestor Tech Play";
    const d =
      document.querySelector('meta[name="description"]') ||
      document.createElement("meta");
    d.setAttribute("name", "description");
    d.setAttribute(
      "content",
      "Agende campanhas de marketing para clientes e contatos."
    );
    if (!d.parentElement) document.head.appendChild(d);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.href;
  }, []);

  // Data sources
  const { buscar: buscarPlanos } = usePlanos();
  const { buscar: buscarProdutos } = useProdutos();
  const { buscar: buscarAplicativos } = useAplicativos();
  const { buscar: buscarTemplates } = useTemplatesCobranca();

  const [tab, setTab] = useState<"clientes" | "contatos">("clientes");
  const [status, setStatus] = useState<string>("");
  const [plano, setPlano] = useState<string>("");
  const [produto, setProduto] = useState<string>("");
  const [app, setApp] = useState<string>("");
  const [quando, setQuando] = useState<string>("");
  const [tipoMsg, setTipoMsg] = useState<"template" | "rapida">("template");
  const [templateId, setTemplateId] = useState<string>("");
  const [mensagemRapida, setMensagemRapida] = useState<string>("");

  const [planos, setPlanos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aplicativos, setAplicativos] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("Nenhum ficheiro selecionado");

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const [p, pr, a, t] = await Promise.all([
          buscarPlanos(),
          buscarProdutos(),
          buscarAplicativos(),
          buscarTemplates(),
        ]);
        setPlanos(p || []);
        setProdutos(pr || []);
        setAplicativos(a || []);
        setTemplates(t || []);
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOptions = useMemo(
    () => [
      { value: "ativos", label: "Ativos" },
      { value: "inativos", label: "Inativos" },
      { value: "trial", label: "Período de teste" },
    ],
    []
  );

  const handleAgendar = () => {
    // Apenas demonstração visual
    console.log({ tab, status, plano, produto, app, quando, tipoMsg, templateId, mensagemRapida });
  };

  const handleEsvaziar = () => {
    // Apenas demonstração visual
    console.log("Esvaziar tabelas (mock)");
  };

  const handleRemoverDuplicados = () => {
    // Apenas demonstração visual
    console.log("Remover duplicados (mock)");
  };
  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando marketing...</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Marketing</h1>
        <div className="flex gap-2">
          <Button
            variant={tab === "clientes" ? "default" : "outline"}
            onClick={() => setTab("clientes")}
            size="sm"
          >
            Clientes
          </Button>
          <Button
            variant={tab === "contatos" ? "default" : "outline"}
            onClick={() => setTab("contatos")}
            size="sm"
          >
            Contatos
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {tab === "clientes" && (
            <>
              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value || "none"} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Planos e Produtos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Planos</Label>
                  <Select value={plano} onValueChange={setPlano} disabled={carregando}>
                    <SelectTrigger>
                      <SelectValue placeholder={carregando ? "Carregando planos..." : "Selecione um plano"} />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {planos.length === 0 && !carregando ? (
                        <SelectItem value="no-plans" disabled>
                          Nenhum plano cadastrado
                        </SelectItem>
                      ) : (
                        planos.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome || p.name || `Plano ${p.id}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produtos</Label>
                  <Select value={produto} onValueChange={setProduto} disabled={carregando}>
                    <SelectTrigger>
                      <SelectValue placeholder={carregando ? "Carregando produtos..." : "Selecione um produto"} />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {produtos.length === 0 && !carregando ? (
                        <SelectItem value="no-products" disabled>
                          Nenhum produto cadastrado
                        </SelectItem>
                      ) : (
                        produtos.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome || p.name || `Produto ${p.id}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Aplicativos */}
              <div className="space-y-2">
                <Label>Aplicativos</Label>
                <Select value={app} onValueChange={setApp} disabled={carregando}>
                  <SelectTrigger>
                    <SelectValue placeholder={carregando ? "Carregando aplicativos..." : "Selecione um aplicativo"} />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {aplicativos.length === 0 && !carregando ? (
                      <SelectItem value="no-apps" disabled>
                        Nenhum aplicativo cadastrado
                      </SelectItem>
                    ) : (
                      aplicativos.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.nome || a.name || `App ${a.id}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Arquivo (apenas Contatos) */}
          {tab === "contatos" && (
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    setFileName(
                      e.target.files?.[0]?.name ?? "Nenhum ficheiro selecionado"
                    )
                  }
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Escolher ficheiro
                </Button>
                <p className="text-sm text-muted-foreground mt-2">{fileName}</p>
              </div>
            </div>
          )}


          {/* Tipo de mensagem */}
          <div className="space-y-2">
            <Label>Tipo de Mensagem</Label>
            <RadioGroup
              className="flex items-center gap-6"
              value={tipoMsg}
              onValueChange={(v) => setTipoMsg(v as typeof tipoMsg)}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="template" id="msg-template" />
                <Label htmlFor="msg-template" className="cursor-pointer">
                  Template de Mensagem
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="rapida" id="msg-rapida" />
                <Label htmlFor="msg-rapida" className="cursor-pointer">
                  Mensagem Rápida
                </Label>
              </div>
            </RadioGroup>
          </div>

          {tipoMsg === "template" ? (
            <div className="space-y-2">
              <Label>Template de Mensagem</Label>
              <Select value={templateId} onValueChange={setTemplateId} disabled={carregando}>
                <SelectTrigger>
                  <SelectValue placeholder={carregando ? "Carregando templates..." : "Selecione um template"} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {templates.length === 0 && !carregando ? (
                    <SelectItem value="no-templates" disabled>
                      Nenhum template cadastrado
                    </SelectItem>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nome || t.name || `Template ${t.id}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                rows={5}
                value={mensagemRapida}
                onChange={(e) => setMensagemRapida(e.target.value)}
                placeholder="Digite sua mensagem rápida..."
              />
            </div>
          )}

          {/* Data agendamento */}
          <div className="space-y-2">
            <Label>Data agendamento</Label>
            <Input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              placeholder="dd/mm/aaaa --:--"
            />
          </div>

          <Button className="w-full" onClick={handleAgendar}>Agendar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2">
            <Button variant="destructive" onClick={handleEsvaziar}>
              Esvaziar tabelas
            </Button>
            <Button variant="destructive" onClick={handleRemoverDuplicados}>
              Remover duplicados
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum resultado encontrado
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
