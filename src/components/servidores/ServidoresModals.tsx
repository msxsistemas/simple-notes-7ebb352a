import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, Shield, Eye, EyeOff, CheckCircle, XCircle, Plus, Loader2, Key, AlertTriangle, FlaskConical, Search } from "lucide-react";
import { InlineError } from "@/components/ui/inline-error";
import { Panel, ProviderConfig } from "@/config/provedores";

// ==================== Step Indicator ====================
function UnitvStepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Salvar', icon: '💾' },
    { label: 'Verificar', icon: '🔍' },
    { label: 'Código', icon: '📧' },
    { label: 'Vincular', icon: '🔗' },
    { label: 'Testar', icon: '🎉' },
  ];

  return (
    <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-lg p-3">
      <FlaskConical className="w-4 h-4 text-primary mr-2" />
      <span className="text-xs font-semibold text-primary mr-2">INTEGRAÇÃO BETA</span>
      <span className="text-[10px] text-muted-foreground mr-3">
        ✅ Créditos Mensal | ✅ Usuário e senha do painel
      </span>
      <div className="flex items-center gap-1 ml-auto">
        {steps.map((step, i) => (
          <span key={step.label} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              i < currentStep
                ? 'bg-green-500/20 text-green-400'
                : i === currentStep
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground'
            }`}>
              {step.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ==================== Add Panel Modal ====================
interface AddPanelModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  providerConfig?: ProviderConfig;
  formData: { nomePainel: string; urlPainel: string; usuario: string; senha: string };
  setFormData: (data: { nomePainel: string; urlPainel: string; usuario: string; senha: string }) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  autoRenewal: boolean;
  setAutoRenewal: (auto: boolean) => void;
  isTestingConnection: boolean;
  validationError?: string | null;
  onCreatePanel: () => void;
  onTestConnection: () => void;
}

export function AddPanelModal({
  isOpen,
  onOpenChange,
  providerName,
  providerConfig,
  formData,
  setFormData,
  showPassword,
  setShowPassword,
  autoRenewal,
  setAutoRenewal,
  isTestingConnection,
  validationError,
  onCreatePanel,
  onTestConnection,
}: AddPanelModalProps) {
  const senhaLabel = providerConfig?.senhaLabel || 'Senha do Painel';
  const senhaPlaceholder = providerConfig?.senhaPlaceholder || 'sua_senha';
  const nomePlaceholder = providerConfig?.nomePlaceholder || 'Ex: Meu Painel Principal';
  const urlPlaceholder = providerConfig?.urlPlaceholder || 'https://painel.exemplo.com';
  const usuarioPlaceholder = providerConfig?.usuarioPlaceholder || 'seu_usuario';
  const isApiKey = senhaLabel.toLowerCase().includes('chave') || senhaLabel.toLowerCase().includes('api') || senhaLabel.toLowerCase().includes('secret');
  const isUniplay = providerConfig?.id === 'uniplay';
  const isPlayfast = providerConfig?.id === 'playfast';
  const isUnitv = providerConfig?.id === 'unitv';
  const isAiAgent = isUnitv;
  const knownUrls: { label: string; url: string }[] = [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Painel {providerName}</DialogTitle>
          <DialogDescription>Configure suas credenciais para integração</DialogDescription>
        </DialogHeader>

        {/* UniTV Step Indicator */}
        {isAiAgent && <UnitvStepIndicator currentStep={0} />}

        {/* Warning */}
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <span className="text-orange-400 text-xs">⚠️</span>
          <span className="text-sm font-medium text-orange-400">IMPORTANTE:</span>
        <span className="text-sm text-muted-foreground">
            {isAiAgent 
              ? 'Após salvar, use "Verificar" para iniciar a vinculação do dispositivo'
              : isUniplay
                ? 'Após salvar, teste a conexão para verificar suas credenciais'
                : 'Desabilite 2FA no painel se necessário'}
          </span>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>🏷 Nome do Painel *</Label>
            <Input
              value={formData.nomePainel}
              onChange={(e) => setFormData({ ...formData, nomePainel: e.target.value })}
              placeholder={nomePlaceholder}
            />
            <p className="text-xs text-muted-foreground">Nome para identificar este servidor</p>
          </div>

          <div className="space-y-2">
            <Label>👤 {isPlayfast ? 'TOKEN da API' : 'Usuário'} *</Label>
            <Input
              value={formData.usuario}
              onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
              placeholder={usuarioPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{isPlayfast ? 'TOKEN fornecido pelo painel Playfast' : 'Usuário para acessar o painel'}</p>
          </div>

          <div className="space-y-2">
            <Label>{isApiKey ? '🔑' : '🔒'} {senhaLabel} *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder={senhaPlaceholder}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!isPlayfast && !isAiAgent && (
            <div className="space-y-2">
              <Label>🔗 URL do Painel *</Label>
              <Input
                value={formData.urlPainel}
                onChange={(e) => setFormData({ ...formData, urlPainel: e.target.value })}
                placeholder={urlPlaceholder}
              />
              {knownUrls.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  {knownUrls.map((u) => (
                    <div key={u.url}>
                      • <span className="font-medium">{u.label}:</span>{' '}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setFormData({ ...formData, urlPainel: u.url })}
                      >
                        {u.url.replace('https://', '')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isAiAgent && (
            <div className="space-y-2">
              <Label>🔗 URL do Painel</Label>
              <Input
                value={formData.urlPainel}
                onChange={(e) => setFormData({ ...formData, urlPainel: e.target.value })}
                placeholder={urlPlaceholder}
              />
              <p className="text-xs text-muted-foreground">URL do painel (frontend)</p>
            </div>
          )}
        </div>

        {/* Auto renewal toggle */}
        <div className="flex items-center gap-3 py-2">
          <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
          <div>
            <span className="text-sm font-medium text-foreground">🔄 Ativar renovação automática</span>
            <p className="text-xs text-muted-foreground">Quando ativado, os clientes vinculados a este painel terão renovação automática</p>
          </div>
        </div>

        <InlineError message={validationError} />

        <DialogFooter>
          <Button variant="outline" onClick={onTestConnection} disabled={isTestingConnection}>
            {isTestingConnection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Testar Conexão
          </Button>
          <Button onClick={onCreatePanel} className="bg-green-500 hover:bg-green-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            💾 Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Verification Code Modal ====================
interface VerificationCodeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelName: string;
  step: 'send' | 'code';
  email?: string;
  isSubmitting: boolean;
  isSending: boolean;
  onSendCode: () => void;
  onSubmitCode: (code: string) => void;
  onSkipToCode: () => void;
}

export function VerificationCodeModal({
  isOpen, onOpenChange, panelName, step, email,
  isSubmitting, isSending, onSendCode, onSubmitCode, onSkipToCode,
}: VerificationCodeModalProps) {
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    if (code.trim().length >= 4) {
      onSubmitCode(code.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting && !isSending) { onOpenChange(open); setCode(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔐 Verificação de Dispositivo</DialogTitle>
          <DialogDescription>
            {step === 'send'
              ? `O painel "${panelName}" requer verificação. Clique em "Enviar Código" para receber o código no e-mail cadastrado.`
              : `Digite o código de verificação enviado para ${email || 'seu e-mail cadastrado'}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 'send' ? (
            <>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <span className="text-blue-400 text-xs">📧</span>
                <span className="text-sm text-muted-foreground">
                  {email
                    ? `O código será enviado para: ${email}`
                    : 'O código será enviado para o e-mail cadastrado no painel UniTV.'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <span className="text-orange-400 text-xs">⚠️</span>
                <span className="text-sm text-muted-foreground">
                  Não foi possível enviar automaticamente. Clique abaixo para tentar novamente.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <span className="text-green-400 text-xs">✅</span>
                <span className="text-sm text-muted-foreground">
                  Código enviado! Verifique seu e-mail{email ? ` (${email})` : ''} e digite abaixo.
                </span>
              </div>

              <div className="space-y-2">
                <Label>Código de Verificação *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Digite o código recebido"
                  maxLength={10}
                  className="text-center text-lg font-mono tracking-widest"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
              </div>

              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={onSendCode}
                disabled={isSending}
              >
                {isSending ? 'Reenviando...' : '📧 Reenviar código'}
              </button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setCode(''); }} disabled={isSubmitting || isSending}>
            Cancelar
          </Button>
          {step === 'send' ? (
            <>
              <Button variant="ghost" size="sm" onClick={onSkipToCode} className="text-xs">
                Já tenho o código
              </Button>
              <Button onClick={onSendCode} disabled={isSending} className="bg-blue-500 hover:bg-blue-600 text-white">
                {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                📧 Enviar Código
              </Button>
            </>
          ) : (
            <Button onClick={handleSubmit} disabled={code.trim().length < 4 || isSubmitting} className="bg-green-500 hover:bg-green-600 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              🔗 Confirmar e Vincular
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Edit Panel Modal ====================
interface EditPanelModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: { id: string; nome: string; url: string; usuario?: string; senha?: string };
  setEditForm: (form: { id: string; nome: string; url: string; usuario?: string; senha?: string }) => void;
  validationError?: string | null;
  onSave: () => void;
}

export function EditPanelModal({ isOpen, onOpenChange, editForm, setEditForm, validationError, onSave }: EditPanelModalProps) {
  const [showEditPassword, setShowEditPassword] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Painel</DialogTitle>
          <DialogDescription>Atualize as informações do painel</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Painel</Label>
            <Input
              value={editForm.nome}
              onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>URL do Painel</Label>
            <Input
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>👤 Usuário</Label>
            <Input
              value={editForm.usuario || ''}
              onChange={(e) => setEditForm({ ...editForm, usuario: e.target.value })}
              placeholder="Usuário do painel"
            />
          </div>
          <div className="space-y-2">
            <Label>🔑 Senha / Chave da API</Label>
            <div className="relative">
              <Input
                type={showEditPassword ? "text" : "password"}
                value={editForm.senha || ''}
                onChange={(e) => setEditForm({ ...editForm, senha: e.target.value })}
                placeholder="Deixe vazio para manter a atual"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowEditPassword(!showEditPassword)}
              >
                {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Deixe vazio para manter a senha atual</p>
          </div>
        </div>
        <InlineError message={validationError} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Test Result Modal ====================
interface TestResultModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  success: boolean;
  message: string;
  details?: string;
}

export function TestResultModal({ isOpen, onOpenChange, success, message, details }: TestResultModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Resultado do Teste</DialogTitle>
          <DialogDescription className="sr-only">Resultado do teste de conexão</DialogDescription>
        </DialogHeader>
        <div className="text-center py-4">
          <div className="mb-4">
            {success ? (
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${success ? 'text-green-500' : 'text-destructive'}`}>
            {success ? "Teste - Sucesso" : "Teste - Erro"}
          </h3>
          <p className={`text-sm mb-4 ${success ? 'text-green-500/80' : 'text-destructive/80'}`}>
            {message}
          </p>
          {details && (
            <div className="bg-muted rounded-lg p-3 mb-4 text-left">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{details}</pre>
            </div>
          )}
          <Button onClick={() => onOpenChange(false)} className="w-full">OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Delete Confirm Modal ====================
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelName: string;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ isOpen, onOpenChange, panelName, onConfirm }: DeleteConfirmModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir painel</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o painel "{panelName}"? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ==================== Success Modal ====================
interface SuccessModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onClose?: () => void;
}

export function SuccessModal({ isOpen, onOpenChange, message, onClose }: SuccessModalProps) {
  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Sucesso</DialogTitle>
          <DialogDescription className="sr-only">Operação realizada com sucesso</DialogDescription>
        </DialogHeader>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-green-500 mb-2">Sucesso</h3>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <Button onClick={handleClose} className="w-full">OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Search User Modal ====================
interface SearchUserModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelName: string;
  isSearching: boolean;
  result: { found: boolean; user?: any; error?: string } | null;
  onSearch: (username: string) => void;
}

export function SearchUserModal({
  isOpen, onOpenChange, panelName, isSearching, result, onSearch,
}: SearchUserModalProps) {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    if (query.trim().length >= 2) {
      onSearch(query.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSearching) { onOpenChange(open); if (!open) setQuery(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔍 Pesquisar Usuário</DialogTitle>
          <DialogDescription>
            Buscar usuário real no painel "{panelName}" via AI Browser Agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome de usuário do cliente *</Label>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: cliente123"
                disabled={isSearching}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <Button onClick={handleSearch} disabled={query.trim().length < 2 || isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O agente IA fará login no painel e buscará este usuário. Pode levar até 2 minutos.
            </p>
          </div>

          {isSearching && (
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Buscando usuário...</p>
                <p className="text-xs text-muted-foreground">Login + navegação + busca via AI Agent</p>
              </div>
            </div>
          )}

          {result && !isSearching && (
            result.found && result.user ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-green-500">Usuário Encontrado</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {result.user.username && (
                    <div><span className="text-muted-foreground">👤 Usuário:</span> <span className="font-medium text-foreground">{result.user.username}</span></div>
                  )}
                  {result.user.status && (
                    <div><span className="text-muted-foreground">● Status:</span> <span className="font-medium text-foreground">{result.user.status}</span></div>
                  )}
                  {result.user.expiryDate && (
                    <div><span className="text-muted-foreground">📅 Expira:</span> <span className="font-medium text-foreground">{result.user.expiryDate}</span></div>
                  )}
                  {result.user.mac && (
                    <div><span className="text-muted-foreground">📱 MAC:</span> <span className="font-medium text-foreground">{result.user.mac}</span></div>
                  )}
                  {result.user.plan && (
                    <div><span className="text-muted-foreground">📋 Plano:</span> <span className="font-medium text-foreground">{result.user.plan}</span></div>
                  )}
                  {result.user.createdAt && (
                    <div><span className="text-muted-foreground">📆 Criado:</span> <span className="font-medium text-foreground">{result.user.createdAt}</span></div>
                  )}
                </div>
                {result.user.extra && (
                  <p className="text-xs text-muted-foreground mt-1">{result.user.extra}</p>
                )}
              </div>
            ) : (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="font-semibold text-destructive">Não Encontrado</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{result.error || 'Usuário não encontrado no painel.'}</p>
              </div>
            )
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setQuery(''); }} disabled={isSearching}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
