import { useNavigate } from "react-router-dom";
import logoMsx from "@/assets/logo-msx.png";
import { Button } from "@/components/ui/button";

interface LegalPageLayoutProps {
  title: string;
  date: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, date, children }: LegalPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/auth')}>
            <img src={logoMsx} alt="Gestor MSX" className="h-10 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/auth')}
              className="text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/auth?signup=true')}
              className="bg-primary hover:bg-primary/90"
            >
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-border/30 py-16 text-center" style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(220 25% 12%) 100%)' }}>


        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground/60 text-sm">Última atualização: {date}</p>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-10">
          {children}
        </div>

        <div className="mt-16 pt-8 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground/40">
            2026© Todos os direitos reservados Gestor MSX
          </p>
        </div>
      </div>
    </div>
  );
}
