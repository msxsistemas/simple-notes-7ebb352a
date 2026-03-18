import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Tutoriais() {
  // SEO
  useEffect(() => {
    document.title = "Tutoriais | Gestor Tech Play";
    const d =
      document.querySelector('meta[name="description"]') ||
      document.createElement("meta");
    d.setAttribute("name", "description");
    d.setAttribute(
      "content",
      "Tutoriais em breve com dicas e guias passo a passo."
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

  return (
    <main className="container mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tutoriais</h1>
      </header>

      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center gap-3">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg">Tutoriais em breve...</p>
          <p className="text-sm text-muted-foreground">
            Em construção. Em breve você encontrará guias e vídeos aqui.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
