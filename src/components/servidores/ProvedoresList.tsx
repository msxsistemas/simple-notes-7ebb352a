import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Check, Edit, Pause, RefreshCw, Trash2, Monitor, Plus, Lock, Shield, Link2, Search, Coins, Bot } from "lucide-react";
import { ProviderConfig, Panel } from "@/config/provedores";

// Re-export types for backward compatibility
export type { ProviderConfig, Panel } from "@/config/provedores";
export { PROVEDORES } from "@/config/provedores";

interface ProvedoresListProps {
  filteredProvedores: ProviderConfig[];
  selectedProvider: string;
  onSelectProvider: (id: string) => void;
}

export function ProvedoresList({ filteredProvedores, selectedProvider, onSelectProvider }: ProvedoresListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filteredProvedores.map((provedor) => (
        <button
          key={provedor.id}
          onClick={() => onSelectProvider(provedor.id)}
          className={`px-4 py-2 text-xs font-medium rounded-md transition-all relative ${
            selectedProvider === provedor.id
              ? "bg-primary text-primary-foreground"
              : provedor.integrado
                ? "bg-secondary/80 text-secondary-foreground/70 border border-border/30 hover:bg-secondary hover:text-secondary-foreground"
                : "bg-secondary/40 text-muted-foreground/50 border border-border/20 cursor-default"
          }`}
        >
          {provedor.nome}
          {!provedor.integrado && (
            <Lock className="inline-block w-3 h-3 ml-1 opacity-50" />
          )}
        </button>
      ))}
    </div>
  );
}

interface ProviderCardProps {
  provider: ProviderConfig;
  stats: { total: number; ativos: number; inativos: number };
}

export function ProviderCard({ provider, stats }: ProviderCardProps) {
  if (!provider.integrado) {
    return (
      <div className="rounded-lg p-6 bg-card border border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{provider.nome}</h3>
              <p className="text-sm text-muted-foreground">{provider.descricao}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-amber-400 border-amber-400/50 bg-amber-400/10">
            Em breve
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          A integração com <span className="font-medium text-foreground">{provider.nome}</span> ainda não está disponível. Em breve você poderá configurar seus painéis aqui.
        </p>
      </div>
    );
  }

  const isAIAgent = provider.id === 'unitv' || provider.id === 'uniplay';

  return (
    <div className="rounded-lg p-4 bg-card border border-border">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{provider.nome}</h3>
              {isAIAgent && (
                <Badge className="bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 text-[10px] gap-1">
                  <Bot className="w-3 h-3" />
                  AI Agent
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{provider.descricao}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="border border-primary/50 rounded-lg px-4 py-2 text-center min-w-[70px]">
            <div className="text-lg font-bold text-primary">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
          <div className="border border-green-500/50 rounded-lg px-4 py-2 text-center min-w-[70px]">
            <div className="text-lg font-bold text-green-500">{stats.ativos}</div>
            <div className="text-[10px] text-muted-foreground">Ativos</div>
          </div>
          <div className="border border-destructive/50 bg-destructive/5 rounded-lg px-4 py-2 text-center min-w-[70px]">
            <div className="text-lg font-bold text-destructive">{stats.inativos}</div>
            <div className="text-[10px] text-muted-foreground">Inativos</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificacaoStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'vinculado':
      return <Badge className="bg-green-500 hover:bg-green-500 text-white text-[10px]">✅ Vinculado</Badge>;
    case 'verificado':
      return <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px]">🔗 Verificado</Badge>;
    default:
      return <Badge variant="outline" className="text-amber-400 border-amber-400/50 bg-amber-400/10 text-[10px]">⚠ Pendente</Badge>;
  }
}

interface PanelsListProps {
  panels: Panel[];
  providerName: string;
  providerId?: string;
  testingPanelId?: string | null;
  verifyingPanelId?: string | null;
  checkingCreditsPanelId?: string | null;
  onAddPanel: () => void;
  onEditPanel: (panel: Panel) => void;
  onToggleStatus: (id: string) => void;
  onTestPanel: (panel: Panel) => void;
  onDeletePanel: (panel: Panel) => void;
  onVerifyPanel?: (panel: Panel) => void;
  onVincularPanel?: (panel: Panel) => void;
  onCheckCredits?: (panel: Panel) => void;
  onSearchUser?: (panel: Panel) => void;
}

export function PanelsList({ 
  panels, 
  providerName,
  providerId,
  testingPanelId,
  verifyingPanelId,
  checkingCreditsPanelId,
  onAddPanel, 
  onEditPanel, 
  onToggleStatus, 
  onTestPanel, 
  onDeletePanel,
  onVerifyPanel,
  onVincularPanel,
  onCheckCredits,
  onSearchUser,
}: PanelsListProps) {
  const isUnitv = false; // keep standard layout for all providers

  if (panels.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 bg-card/50 min-h-[200px] flex flex-col items-center justify-center">
        <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center mb-4">
          <Monitor className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium mb-1">Nenhum painel configurado</p>
        <p className="text-sm text-muted-foreground mb-4">
          Configure seu <span className="text-primary">primeiro painel {providerName}</span> para começar
        </p>
        <Button onClick={onAddPanel} className="bg-green-500 hover:bg-green-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Painel {providerName}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          Painéis {providerName} Configurados ({panels.length})
        </h3>
        <Button onClick={onAddPanel} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Painel
        </Button>
      </div>

      {/* Table header for UniTV */}
      {isUnitv && (
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground">
          <span>🏷 Painel</span>
          <span>👤 Usuário</span>
          <span>📱 Dispositivo</span>
          <span>● Status</span>
          <span>🔄 Renovação</span>
          <span>🔐 Vinculação</span>
          <span>⚙ Ações</span>
        </div>
      )}

      <div className="divide-y divide-border">
        {panels.map((p) => (
          <div key={p.id} className={isUnitv 
            ? "grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-2 items-center p-4"
            : "flex items-center justify-between p-4"
          }>
            {isUnitv ? (
              <>
                {/* Painel name + ID */}
                <div>
                  <div className="text-foreground font-medium text-sm">{p.nome}</div>
                  <div className="text-[10px] text-muted-foreground">🆔 ID: {p.dispositivoId || 'n/d'}</div>
                </div>

                {/* Usuário */}
                <div className="text-sm text-muted-foreground">{p.usuario}</div>

                {/* Dispositivo */}
                <VerificacaoStatusBadge status={p.verificacaoStatus} />

                {/* Status */}
                <Badge variant={p.status === 'Ativo' ? 'default' : 'secondary'} className={p.status === 'Ativo' ? 'bg-green-500 hover:bg-green-500 text-[10px]' : 'text-[10px]'}>
                  {p.status}
                </Badge>

                {/* Renovação */}
                <Badge variant="outline" className={`text-[10px] ${p.autoRenovacao ? 'text-green-400 border-green-400/50' : 'text-muted-foreground'}`}>
                  {p.autoRenovacao ? '✅ Ativa' : '✖ Desativada'}
                </Badge>

                {/* Vinculação status */}
                <div className="text-[10px] text-muted-foreground text-center">
                  {p.verificacaoStatus === 'vinculado' ? '🟢' : p.verificacaoStatus === 'verificado' ? '🟡' : '🔴'}
                </div>

                {/* Ações */}
                <div className="flex gap-1 items-center flex-wrap">
                  {p.verificacaoStatus !== 'vinculado' && onVerifyPanel && (
                    <Button 
                      onClick={() => onVerifyPanel(p)} 
                      disabled={!!verifyingPanelId}
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {verifyingPanelId === p.id ? 'Verificando...' : 'Verificar'}
                    </Button>
                  )}
                  {p.verificacaoStatus === 'verificado' && onVincularPanel && (
                    <Button 
                      onClick={() => onVincularPanel(p)} 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] border-green-500/50 text-green-400 hover:bg-green-500/10"
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Vincular
                    </Button>
                  )}
                  <Button onClick={() => onTestPanel(p)} disabled={!!testingPanelId} variant="outline" size="sm" className="h-7 text-[10px] border-primary/50 text-primary hover:bg-primary/10">
                    <RefreshCw className={`h-3 w-3 mr-1 ${testingPanelId === p.id ? 'animate-spin' : ''}`} />
                    {testingPanelId === p.id ? '...' : 'Testar'}
                  </Button>
                  <Button onClick={() => onEditPanel(p)} variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button onClick={() => onToggleStatus(p.id)} variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80">
                    {p.status === 'Ativo' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button onClick={() => onDeletePanel(p)} variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 ${p.status === 'Ativo' ? 'bg-green-500' : 'bg-muted'} rounded-full flex items-center justify-center mt-0.5`}>
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{p.nome}</div>
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
                      {p.url}
                    </a>
                    {(onCheckCredits || onSearchUser) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Bot className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] text-violet-400 font-medium">AI Agent</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={p.status === 'Ativo' ? 'default' : 'secondary'} className={p.status === 'Ativo' ? 'bg-green-500 hover:bg-green-500' : ''}>
                    {p.status}
                  </Badge>
                  <div className="flex gap-1 items-center">
                     {onCheckCredits && (
                      <Button onClick={(e) => { e.stopPropagation(); onCheckCredits(p); }} disabled={checkingCreditsPanelId === p.id} variant="outline" size="sm" className="h-8 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                        <Coins className={`h-3 w-3 mr-1 ${checkingCreditsPanelId === p.id ? 'animate-spin' : ''}`} />
                        {checkingCreditsPanelId === p.id ? 'Consultando...' : 'Créditos'}
                      </Button>
                    )}
                     {onSearchUser && (
                      <Button onClick={(e) => { e.stopPropagation(); onSearchUser(p); }} variant="outline" size="sm" className="h-8 text-xs border-primary/50 text-primary hover:bg-primary/10">
                        <Search className="h-3 w-3 mr-1" />
                        Pesquisar Usuário
                      </Button>
                    )}
                    <Button onClick={() => onTestPanel(p)} disabled={!!testingPanelId} variant="outline" size="sm" className="h-8 text-xs border-primary/50 text-primary hover:bg-primary/10">
                      <RefreshCw className={`h-3 w-3 mr-1 ${testingPanelId === p.id ? 'animate-spin' : ''}`} />
                      {testingPanelId === p.id ? 'Testando...' : 'Testar'}
                    </Button>
                    <Button onClick={() => onEditPanel(p)} variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => onToggleStatus(p.id)} variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80">
                      {p.status === 'Ativo' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button onClick={() => onDeletePanel(p)} variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
