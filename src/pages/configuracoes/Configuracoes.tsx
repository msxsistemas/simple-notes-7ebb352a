import { useEffect } from "react";

export default function Configuracoes() {
  useEffect(() => {
    document.title = "Configurações | Gestor Tech Play";
    const desc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    desc.setAttribute('name', 'description');
    desc.setAttribute('content', 'Configurações do Gestor Tech Play: preferências e ajustes.');
    if (!desc.parentElement) document.head.appendChild(desc);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="text-muted-foreground">Escolha um tópico no menu lateral.</p>
    </div>
  );
}
