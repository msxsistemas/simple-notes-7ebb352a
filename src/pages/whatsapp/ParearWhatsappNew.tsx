import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, RefreshCw, Crown, Zap, ArrowLeft, QrCode, LogOut } from "lucide-react";
import { useEvolutionAPISimple } from "@/hooks/useEvolutionAPISimple";
import { Badge } from "@/components/ui/badge";

type PageView = 'select' | 'connect';

export default function ParearWhatsappNew() {
  const evolution = useEvolutionAPISimple();
  const { session, connecting, connect, disconnect, isConnected, hydrated, checkStatus } = evolution;
  const [view, setView] = useState<PageView>('select');

  useEffect(() => {
    document.title = "Parear WhatsApp | Gestor MSX";
  }, []);

  // Auto-go to connect if already connected
  useEffect(() => {
    if (hydrated && isConnected) {
      setView('connect');
    }
  }, [hydrated, isConnected]);

  if (view === 'connect') {
    return (
      <main className="space-y-6 max-w-xl mx-auto py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setView('select'); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2">
            <span className="text-sm text-muted-foreground">API Ativa:</span>
            <span className="font-bold text-foreground">EVO API</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => checkStatus(true)} disabled={!hydrated}>
            <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Card className="border-border">
          <CardContent className="p-8">
            {!hydrated ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
                <p className="text-muted-foreground">Carregando status da sessão...</p>
              </div>
            ) : isConnected ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Badge className="bg-success/20 text-success border-success/30 mb-6 px-4 py-1.5">
                  <div className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" />
                  Conectado
                </Badge>

                <div className="border-2 border-success/30 rounded-xl p-8 max-w-sm w-full text-center" style={{ background: 'hsl(var(--card))' }}>
                  <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-9 w-9 text-success-foreground" strokeWidth={2} />
                  </div>
                  <h2 className="text-xl font-bold text-success mb-2">WhatsApp Conectado!</h2>
                  <p className="text-sm text-muted-foreground mb-1">
                    Sua instância está ativa e funcionando perfeitamente.
                  </p>
                  {session?.phoneNumber && (
                    <p className="text-sm text-muted-foreground">
                      Número: <span className="text-foreground font-medium">{session.phoneNumber}</span>
                    </p>
                  )}
                  {session?.profileName && (
                    <p className="text-sm text-muted-foreground">
                      Nome: <span className="text-foreground font-medium">{session.profileName}</span>
                    </p>
                  )}
                  <Button onClick={disconnect} variant="destructive" className="mt-6">
                    <LogOut className="h-4 w-4 mr-2" /> Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <h2 className="text-lg font-semibold text-foreground mb-2">Conectar WhatsApp</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {session?.status === 'connecting'
                    ? 'Escaneie o QR Code com seu WhatsApp para conectar.'
                    : 'Clique para gerar o QR Code de conexão.'}
                </p>

                {session?.qrCode ? (
                  <>
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
                      <img
                        src={session.qrCode.startsWith('data:') ? session.qrCode : `data:image/png;base64,${session.qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-[220px] h-[220px]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={connect} variant="outline" size="sm" disabled={connecting}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? 'animate-spin' : ''}`} />
                        Novo QR
                      </Button>
                      <Button onClick={disconnect} variant="destructive" size="sm">
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="w-[220px] h-[220px] bg-muted rounded-xl flex items-center justify-center">
                    {connecting ? (
                      <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                    ) : (
                      <Button onClick={connect} className="bg-success hover:bg-success/90 text-success-foreground">
                        <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                <span className="font-medium text-success">1.</span> Aponte seu celular para o QR Code até que complete o pareamento
              </p>
              <p className="text-warning">
                <span className="font-medium">2.</span> Após o pareamento ficar ativo, aguarde a confirmação automática
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">3.</span> Se tudo ocorrer corretamente, a sessão será ativada automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6 max-w-lg mx-auto py-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Escolha sua API de Conexão</h1>
        <p className="text-muted-foreground mt-1">
          Selecione a API que deseja utilizar para conectar seu WhatsApp
        </p>
      </div>

      <div
        className="relative rounded-xl border-2 border-cyan-500/40 p-6 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-lg"
        style={{ background: 'hsl(var(--card))' }}
        onClick={() => setView('connect')}
      >
        <div className="absolute -top-3 right-4">
          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-xs font-bold px-3 py-1 text-white">
            PREMIUM <Zap className="h-3 w-3 ml-1" />
          </Badge>
        </div>

        <div className="flex justify-center mb-4 mt-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600">
            <Crown className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-foreground">Evolution</h3>
          <p className="text-sm text-muted-foreground mt-1">Conexão estável e confiável com o WhatsApp</p>
        </div>

        <ul className="space-y-2 mb-6">
          {["Conexão estável", "Envio de mensagens", "QR Code e código de pareamento", "Envio de mídias"].map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          onClick={(e) => { e.stopPropagation(); setView('connect'); }}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
        >
          <Crown className="h-4 w-4 mr-2" />
          Selecionar Evolution
        </Button>
      </div>
    </main>
  );
}
