import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Search, X, Send, ChevronDown } from "lucide-react";

export default function MensagensEnviadas() {
  // SEO
  useEffect(() => {
    document.title = "Mensagens Enviadas | Gestor Tech Play";
    const d =
      document.querySelector('meta[name="description"]') ||
      document.createElement("meta");
    d.setAttribute("name", "description");
    d.setAttribute(
      "content",
      "Resumo de envios: sucesso, fila e falhas, com busca e ações."
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

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState("10");

  return (
    <main className="space-y-6" aria-labelledby="mensagens-title">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Lembretes</p>
        <h1 id="mensagens-title" className="text-2xl md:text-3xl font-bold tracking-tight">
          Mensagens enviadas
        </h1>
      </header>

      {/* Cards de métricas */}
      <section aria-label="Resumo de Envios" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sucesso */}
        <Card>
          <div className="h-1.5 bg-[hsl(var(--success))] rounded-t-md" />
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span>Envios</span>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold">0</div>
                <p className="text-sm text-muted-foreground">Enviados com sucesso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fila */}
        <Card>
          <div className="h-1.5 bg-[hsl(var(--warning))] rounded-t-md" />
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span>Envios</span>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold">0</div>
                <p className="text-sm text-muted-foreground">Envios na fila</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Falhas */}
        <Card>
          <div className="h-1.5 bg-[hsl(var(--destructive))] rounded-t-md" />
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span>Envios</span>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold">0</div>
                <p className="text-sm text-muted-foreground">Envios com falha</p>
              </div>
              <Button size="sm" variant="secondary">Reagendar</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Ações principais */}
      <section className="flex flex-wrap items-center gap-3">
        <Button>
          <span className="mr-2">REAGENDAR TUDO</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="destructive">Limpar Tabela</Button>
      </section>

      {/* Barra de busca e paginação */}
      <section className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Input
            placeholder="Procurar ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Buscar mensagens"
          />
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--brand))]"
          />
          {query && (
            <button
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="w-24">
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger>
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent>
              {(["10", "25", "50", "100"]).map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como editar WhatsApp:</AlertTitle>
            <AlertDescription>
              Clique sobre o número do WhatsApp para editá-lo diretamente na tabela. Pressione Enter ou clique fora para salvar.
            </AlertDescription>
          </Alert>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nada para mostrar
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">Mostrando até de 0 resultados</p>
        </CardContent>
      </Card>
    </main>
  );
}
