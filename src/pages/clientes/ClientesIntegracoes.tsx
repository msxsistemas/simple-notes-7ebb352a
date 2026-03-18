import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PROVEDORES, ProvedoresList, ProviderCard, PanelsList } from "@/components/servidores/ProvedoresList";
import { Panel, ProviderConfig } from "@/config/provedores";
import { AddPanelModal, EditPanelModal, TestResultModal, DeleteConfirmModal, SuccessModal } from "@/components/servidores/ServidoresModals";

export default function ClientesIntegracoes() {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testingPanelId, setTestingPanelId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('koffice-api');
  
  const [testResultModal, setTestResultModal] = useState<{
    isOpen: boolean;
    success: boolean;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    success: false,
    message: "",
    details: "",
  });
  
  const [formData, setFormData] = useState({
    nomePainel: "",
    urlPainel: "",
    usuario: "",
    senha: ""
  });

  const { toast, dismiss } = useToast();

  const [panels, setPanels] = useState<Panel[]>([]);

  const [createResultModal, setCreateResultModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; panel: { id: string; nome: string } | null }>({
    isOpen: false,
    panel: null,
  });

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ id: string; nome: string; url: string }>({ id: "", nome: "", url: "" });
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Servidores | Tech Play";
    loadPanels();
  }, []);

  const resolveVaultCredentials = async (panelId: string, userId: string, fallbackUsuario: string, fallbackSenha: string) => {
    if (fallbackUsuario !== 'vault' && fallbackSenha !== 'vault') {
      return { usuario: fallbackUsuario, senha: fallbackSenha };
    }
    try {
      const [usuarioRes, senhaRes] = await Promise.all([
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `usuario_${panelId}` }),
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `senha_${panelId}` }),
      ]);
      return { usuario: usuarioRes.data || fallbackUsuario, senha: senhaRes.data || fallbackSenha };
    } catch {
      return { usuario: fallbackUsuario, senha: fallbackSenha };
    }
  };

  const storeVaultCredentials = async (panelId: string, userId: string, usuario: string, senha: string) => {
    await Promise.all([
      supabase.rpc('store_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `usuario_${panelId}`, p_secret_value: usuario }),
      supabase.rpc('store_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `senha_${panelId}`, p_secret_value: senha }),
    ]);
  };

  const deleteVaultCredentials = async (panelId: string, userId: string) => {
    await Promise.all([
      supabase.rpc('delete_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `usuario_${panelId}` }),
      supabase.rpc('delete_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `senha_${panelId}` }),
    ]).catch(() => {});
  };

  const loadPanels = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const userId = session.session.user.id;

      const { data, error } = await supabase
        .from('paineis_integracao' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const resolved = await Promise.all(data.map(async (p: any) => {
          const creds = await resolveVaultCredentials(p.id, userId, p.usuario, p.senha);
          return {
            id: String(p.id),
            nome: p.nome,
            url: p.url,
            usuario: creds.usuario,
            senha: creds.senha,
            status: p.status as 'Ativo' | 'Inativo',
            autoRenovacao: p.auto_renovacao,
            provedor: p.provedor || 'playfast',
          };
        }));
        setPanels(resolved);
      }
    } catch (error: any) {
      console.error('Erro ao carregar painéis:', error);
      toast({ title: "Erro", description: "Não foi possível carregar os painéis" });
    }
  };

  const handleCreatePanel = async () => {
    const baseUrl = formData.urlPainel.trim().replace(/\/$/, "");
    if (!formData.nomePainel.trim() || !formData.usuario.trim() || !formData.senha.trim() || !baseUrl) {
      setValidationError("Preencha todos os campos marcados com *");
      return;
    }
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(baseUrl)) {
      setValidationError("Informe uma URL válida iniciando com http:// ou https://");
      return;
    }
    setValidationError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({ title: "Erro", description: "Você precisa estar logado" });
        return;
      }

      const usuario = formData.usuario.trim();
      const senha = formData.senha.trim();

      const { data, error } = await supabase
        .from('paineis_integracao' as any)
        .insert([{
          user_id: session.session.user.id,
          nome: formData.nomePainel.trim(),
          url: baseUrl,
          usuario: 'vault',
          senha: 'vault',
          status: 'Ativo',
          auto_renovacao: autoRenewal,
          provedor: selectedProvider
        }])
        .select()
        .single();

      if (error) throw error;

      const panelId = String((data as any).id);
      await storeVaultCredentials(panelId, session.session.user.id, usuario, senha);

      setPanels((prev) => [...prev, {
        id: panelId,
        nome: (data as any).nome,
        url: (data as any).url,
        usuario,
        senha,
        status: (data as any).status as 'Ativo' | 'Inativo',
        autoRenovacao: (data as any).auto_renovacao,
        provedor: selectedProvider
      }]);

      setCreateResultModal({ isOpen: true, message: `Painel '${formData.nomePainel}' criado com sucesso!` });
      setFormData({ nomePainel: "", urlPainel: "", usuario: "", senha: "" });
    } catch (error: any) {
      console.error('Erro ao criar painel:', error);
      toast({ title: "Erro", description: "Não foi possível criar o painel" });
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const baseUrl = formData.urlPainel.trim().replace(/\/$/, '');
      const usuario = formData.usuario.trim();
      const senha = formData.senha.trim();
      const nomePainel = formData.nomePainel.trim();

      if (!nomePainel || !usuario || !senha || !baseUrl) {
        setTestResultModal({
          isOpen: true,
          success: false,
          message: "Dados Obrigatórios Ausentes",
          details: "❌ Preencha todos os campos obrigatórios antes de testar."
        });
        return;
      }

      const provider = PROVEDORES.find(p => p.id === selectedProvider);
      const endpoint = provider?.loginEndpoint || '/api/auth/login';
      const payload = provider?.buildLoginPayload 
        ? provider.buildLoginPayload(usuario, senha)
        : { username: usuario, password: senha };

      const { data, error } = await supabase.functions.invoke('test-panel-connection', {
        body: {
          baseUrl,
          username: usuario,
          password: senha,
          endpointPath: endpoint,
          endpointMethod: provider?.loginMethod || 'POST',
          loginPayload: payload,
          providerId: selectedProvider,
          extraHeaders: { Accept: 'application/json' }
        },
      });

      if (error || !data) {
        setTestResultModal({
          isOpen: true,
          success: false,
          message: 'Erro no Teste',
          details: `Não foi possível executar o teste. ${error?.message ?? ''}`.trim(),
        });
        return;
      }

      if (data.success) {
        const account = data.account;
        if (data.data?.token) {
          localStorage.setItem("auth_token", data.data.token);
        }
        // Build details with credits and clients info if available
        let detailLines = [
          `✅ Painel: ${nomePainel}`,
          `🔗 Endpoint: ${data.endpoint}`,
          `👤 Usuário: ${usuario}`,
          `📡 Status: ${account?.status ?? 'OK'}`,
        ];
        if (account?.credits !== undefined && account?.credits !== null) {
          detailLines.push(`💰 Créditos: ${account.credits}`);
        }
        if (account?.totalClients !== undefined) {
          detailLines.push(`👥 Total de Clientes: ${account.totalClients}`);
        }
        if (account?.activeClients !== undefined) {
          detailLines.push(`✅ Clientes Ativos: ${account.activeClients}`);
        }
        if (account?.note) {
          detailLines.push(`\n⚠️ ${account.note}`);
        }
        detailLines.push(`\n✅ Autenticação realizada com sucesso no painel.`);
        
        setTestResultModal({
          isOpen: true,
          success: true,
          message: "CONEXÃO REAL BEM-SUCEDIDA!",
          details: detailLines.join('\n')
        });
      } else {
        setTestResultModal({
          isOpen: true,
          success: false,
          message: "FALHA NA AUTENTICAÇÃO",
          details: data.details || "Credenciais inválidas ou URL incorreta."
        });
      }
    } catch (error: any) {
      setTestResultModal({
        isOpen: true,
        success: false,
        message: "Erro no Teste",
        details: `Erro inesperado durante o teste: ${error.message}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testPanel = async (panel: Panel) => {
    setIsTestingConnection(true);
    setTestingPanelId(panel.id);
    try {
      const baseUrl = panel.url.trim().replace(/\/$/, '');
      const provider = PROVEDORES.find(p => p.id === panel.provedor);
      const endpoint = provider?.loginEndpoint || '/api/auth/login';
      const payload = provider?.buildLoginPayload 
        ? provider.buildLoginPayload(panel.usuario, panel.senha)
        : { username: panel.usuario, password: panel.senha };

      const { data, error } = await supabase.functions.invoke('test-panel-connection', {
        body: {
          baseUrl,
          username: panel.usuario,
          password: panel.senha,
          endpointPath: endpoint,
          endpointMethod: provider?.loginMethod || 'POST',
          loginPayload: payload,
          providerId: panel.provedor || selectedProvider,
          extraHeaders: { Accept: 'application/json' }
        },
      });

      if (error || !data) {
        setTestResultModal({
          isOpen: true,
          success: false,
          message: 'Erro no Teste',
          details: `Não foi possível executar o teste agora. ${error?.message ?? ''}`.trim(),
        });
        return;
      }

      if (data.success) {
        const account = data.account;
        let detailLines = [
          `✅ Painel: ${panel.nome}`,
          `🔗 Endpoint: ${data.endpoint}`,
          `👤 Usuário: ${panel.usuario}`,
          `📡 Status: ${(account?.status ?? 'OK')}`,
        ];
        if (account?.exp_date) detailLines.push(`⏱️ Expira: ${account.exp_date}`);
        if (account?.credits !== undefined && account?.credits !== null) {
          detailLines.push(`💰 Créditos: ${account.credits}`);
        }
        if (account?.totalClients !== undefined) {
          detailLines.push(`👥 Total de Clientes: ${account.totalClients}`);
        }
        if (account?.activeClients !== undefined) {
          detailLines.push(`✅ Clientes Ativos: ${account.activeClients}`);
        }
        if (account?.note) {
          detailLines.push(`\n⚠️ ${account.note}`);
        }
        detailLines.push(`\n✅ Autenticação realizada com sucesso no painel.`);
        setTestResultModal({
          isOpen: true,
          success: true,
          message: 'CONEXÃO REAL BEM-SUCEDIDA!',
          details: detailLines.join('\n'),
        });
      } else {
        const logs = Array.isArray(data.logs)
          ? data.logs
              .slice(0, 4)
              .map((l: any) => {
                const s = [
                  l.status ? `status: ${l.status}` : null,
                  l.ok !== undefined ? `ok: ${l.ok}` : null,
                ]
                  .filter(Boolean)
                  .join(', ');
                const head = s ? `(${s})` : '';
                return `• ${l.url} ${head}\n${(l.snippet || '').slice(0, 200)}`;
              })
              .join('\n\n')
          : '';

        setTestResultModal({
          isOpen: true,
          success: false,
          message: 'FALHA NA AUTENTICAÇÃO',
          details: `${data.details || 'Usuário/senha inválidos ou URL incorreta.'}${logs ? '\n\nTentativas:\n' + logs : ''}`,
        });
      }
    } catch (error: any) {
      setTestResultModal({
        isOpen: true,
        success: false,
        message: 'Erro no Teste',
        details: `Erro inesperado durante o teste: ${error.message}`,
      });
    } finally {
      setIsTestingConnection(false);
      setTestingPanelId(null);
    }
  };

  const startEditPanel = (panel: Panel) => {
    setEditForm({ id: panel.id, nome: panel.nome, url: panel.url });
    setEditValidationError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditPanel = async () => {
    dismiss();

    if (!editForm.nome.trim() || !editForm.url.trim()) {
      setEditValidationError('Preencha nome e URL');
      return;
    }
    const baseUrl = editForm.url.trim().replace(/\/$/, '');
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(baseUrl)) {
      setEditValidationError('Informe uma URL válida iniciando com http:// ou https://');
      return;
    }
    setEditValidationError(null);

    try {
      const { error } = await supabase
        .from('paineis_integracao' as any)
        .update({
          nome: editForm.nome.trim(),
          url: baseUrl
        })
        .eq('id', editForm.id);

      if (error) throw error;

      setPanels((prev) => prev.map((p) => (p.id === editForm.id ? { ...p, nome: editForm.nome.trim(), url: baseUrl } : p)));
      setIsEditModalOpen(false);
      setCreateResultModal({ isOpen: true, message: `Painel '${editForm.nome}' atualizado com sucesso!` });
    } catch (error: any) {
      console.error('Erro ao atualizar painel:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar o painel" });
    }
  };

  const handleToggleStatus = async (id: string) => {
    const panel = panels.find(p => p.id === id);
    if (!panel) return;

    const newStatus = panel.status === 'Ativo' ? 'Inativo' : 'Ativo';

    try {
      const { error } = await supabase
        .from('paineis_integracao' as any)
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar o status" });
    }
  };

  const openDeleteConfirm = (panel: Panel) => {
    setDeleteConfirmModal({ isOpen: true, panel: { id: panel.id, nome: panel.nome } });
  };

  const handleDeletePanel = async () => {
    if (!deleteConfirmModal.panel) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { error } = await supabase
        .from('paineis_integracao' as any)
        .delete()
        .eq('id', deleteConfirmModal.panel.id);

      if (error) throw error;

      if (userId) {
        await deleteVaultCredentials(deleteConfirmModal.panel.id, userId);
      }

      setPanels((prev) => prev.filter((p) => p.id !== deleteConfirmModal.panel!.id));
      setDeleteConfirmModal({ isOpen: false, panel: null });
      setCreateResultModal({ isOpen: true, message: `Painel '${deleteConfirmModal.panel.nome}' excluído com sucesso!` });
    } catch (error: any) {
      console.error('Erro ao excluir painel:', error);
      toast({ title: "Erro", description: "Não foi possível excluir o painel" });
      setDeleteConfirmModal({ isOpen: false, panel: null });
    }
  };

  // Filtrar provedores baseado na busca
  const filteredProvedores = PROVEDORES.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Obter provedor selecionado
  const currentProvider = PROVEDORES.find(p => p.id === selectedProvider);

  // Filtrar painéis pelo provedor selecionado
  const providerPanels = panels.filter(p => p.provedor === selectedProvider || (!p.provedor && selectedProvider === 'playfast'));

  // Estatísticas do provedor selecionado
  const providerStats = {
    total: providerPanels.length,
    ativos: providerPanels.filter(p => p.status === 'Ativo').length,
    inativos: providerPanels.filter(p => p.status === 'Inativo').length
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Servidores IPTV</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus painéis de integração</p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Buscar provedor</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder=""
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Provedores Grid */}
      <ProvedoresList 
        filteredProvedores={filteredProvedores}
        selectedProvider={selectedProvider}
        onSelectProvider={(id) => {
          setSelectedProvider(id);
          // Reset form when switching providers to avoid data leaking between providers
          setFormData({ nomePainel: "", urlPainel: "", usuario: "", senha: "" });
          setAutoRenewal(false);
          setIsConfigModalOpen(false);
        }}
      />

      {/* Provider Card */}
      {currentProvider && (
        <ProviderCard provider={currentProvider} stats={providerStats} />
      )}

      {/* Panels List - only for integrated providers */}
      {currentProvider?.integrado && (
        <PanelsList
          panels={providerPanels}
          providerName={currentProvider?.nome || ''}
          testingPanelId={testingPanelId}
          onAddPanel={() => {
            setFormData({ nomePainel: "", urlPainel: "", usuario: "", senha: "" });
            setAutoRenewal(false);
            setIsConfigModalOpen(true);
          }}
          onEditPanel={startEditPanel}
          onToggleStatus={handleToggleStatus}
          onTestPanel={testPanel}
          onDeletePanel={openDeleteConfirm}
        />
      )}

      {/* Modals */}
      <AddPanelModal
        isOpen={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        providerName={currentProvider?.nome || ''}
        providerConfig={currentProvider}
        formData={formData}
        setFormData={setFormData}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        autoRenewal={autoRenewal}
        setAutoRenewal={setAutoRenewal}
        isTestingConnection={isTestingConnection}
        validationError={validationError}
        onCreatePanel={handleCreatePanel}
        onTestConnection={handleTestConnection}
      />

      <EditPanelModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        validationError={editValidationError}
        onSave={handleSaveEditPanel}
      />

      <TestResultModal
        isOpen={testResultModal.isOpen}
        onOpenChange={(open) => setTestResultModal(prev => ({ ...prev, isOpen: open }))}
        success={testResultModal.success}
        message={testResultModal.message}
        details={testResultModal.details}
      />

      <DeleteConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onOpenChange={(open) => setDeleteConfirmModal(prev => ({ ...prev, isOpen: open }))}
        panelName={deleteConfirmModal.panel?.nome || ''}
        onConfirm={handleDeletePanel}
      />

      <SuccessModal
        isOpen={createResultModal.isOpen}
        onOpenChange={(open) => setCreateResultModal(prev => ({ ...prev, isOpen: open }))}
        message={createResultModal.message}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </main>
  );
}
