import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed before (expires after 3 days)
    const dismissedAt = localStorage.getItem("pwa-banner-dismissed");
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt);
      if (diff < 3 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // iOS doesn't support beforeinstallprompt
    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: show after 3 seconds on mobile even without the event
    const isMobile = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let timeout: ReturnType<typeof setTimeout>;
    if (isMobile) {
      timeout = setTimeout(() => {
        setShowIOSHint(true); // reuse as generic fallback
      }, 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", Date.now().toString());
  };

  // Don't show if installed or dismissed
  if (isInstalled || dismissed) return null;

  // Nothing to show
  if (!deferredPrompt && !showIOSHint) return null;

  const isIOSDevice = isIOS();

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-[0_8px_32px_hsl(var(--primary)/.2)] p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          {isIOSDevice ? (
            <Share className="h-5 w-5 text-primary" />
          ) : (
            <Download className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instalar Gestor MSX</p>
          {isIOSDevice ? (
            <p className="text-xs text-muted-foreground">
              Toque em <Share className="inline h-3 w-3 -mt-0.5" /> e depois <strong>"Adicionar à Tela de Início"</strong>
            </p>
          ) : deferredPrompt ? (
            <p className="text-xs text-muted-foreground">Acesse mais rápido direto da tela inicial</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Menu <strong>⋮</strong> → <strong>"Instalar app"</strong>
            </p>
          )}
        </div>
        {deferredPrompt && (
          <Button
            size="sm"
            onClick={handleInstall}
            className="rounded-xl text-xs font-bold px-4 h-9 flex-shrink-0"
          >
            Instalar
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
