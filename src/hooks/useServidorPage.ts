import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PROVEDORES, Panel, ProviderConfig, getTestStrategy } from "@/config/provedores";

import { PLAYFAST_API_BASE } from "@/config/provedores/playfast";

/** Sanitize browser agent error messages that may contain raw HTML */
function cleanAgentError(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/Username or Email\s*Password\s*Forgot Password\?\s*Show password\s*Verified\s*Continue\s*/gi, '')
    .replace(/System protected against bots and automation apps[^\n]*/gi, '⚠️ Painel protegido contra bots.')
    .replace(/The provided credentials are incorrect[^\n]*/gi, 'Credenciais incorretas. Verifique usuário e senha.')
    .trim() || 'Falha no login automático.';
}

async function testSigmaApiConnection(baseUrl: string, username: string, password: string) {
  const cleanBase = baseUrl.trim().replace(/\/$/, '');
  const endpoint = `${cleanBase}/api/auth/login`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'locale': 'pt',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'Origin': cleanBase,
      'Referer': `${cleanBase}/`,
    },
    body: JSON.stringify({
      captcha: 'not-a-robot',
      captchaChecked: true,
      username,
      password,
      twofactor_code: '',
      twofactor_recovery_code: '',
      twofactor_trusted_device_id: '',
    }),
  });

  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}

  if (resp.ok && json && (json.token || json.id || json.username)) {
    return {
      success: true,
      endpoint,
      account: {
        status: json.status || 'ACTIVE',
        credits: json.credits,
        user: json.username || username,
      },
    };
  }

  if (resp.status === 404) {
    return { success: false, details: 'Endpoint Sigma não encontrado. Verifique se a URL está correta (ex: https://painelslim.site).' };
  }

  if (resp.status === 401 || resp.status === 403) {
    return { success: false, details: 'Credenciais Sigma inválidas. Verifique usuário e senha.' };
  }

  const apiMsg = cleanAgentError(json?.message || text || `HTTP ${resp.status}`);
  return { success: false, details: `Falha na autenticação Sigma: ${apiMsg}` };
}

export function useServidorPage(providerId: string) {
  const provider = PROVEDORES.find(p => p.id === providerId) || null;

  const [panels, setPanels] = useState<Panel[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testingPanelId, setTestingPanelId] = useState<string | null>(null);
  const [verifyingPanelId, setVerifyingPanelId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nomePainel: "", urlPainel: "", usuario: "", senha: "" });

  // UniTV verification flow
  const [verificationModal, setVerificationModal] = useState<{
    isOpen: boolean; panelId: string; panelName: string;
    step: 'send' | 'code'; email?: string; token?: string;
    url?: string; username?: string; password?: string;
  }>({
    isOpen: false, panelId: '', panelName: '', step: 'send',
  });
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const [testResultModal, setTestResultModal] = useState<{
    isOpen: boolean; success: boolean; message: string; details?: string;
  }>({ isOpen: false, success: false, message: "", details: "" });

  const [createResultModal, setCreateResultModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false, message: "",
  });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; panel: { id: string; nome: string } | null }>({
    isOpen: false, panel: null,
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ id: string; nome: string; url: string; usuario?: string; senha?: string }>({ id: "", nome: "", url: "" });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  const { toast, dismiss } = useToast();

  useEffect(() => {
    loadPanels();
  }, [providerId]);

  const resolveVaultCredentials = async (panelId: string, userId: string, fallbackUsuario: string, fallbackSenha: string) => {
    if (fallbackUsuario !== 'vault' && fallbackSenha !== 'vault') {
      return { usuario: fallbackUsuario, senha: fallbackSenha };
    }
    try {
      const [usuarioRes, senhaRes] = await Promise.all([
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `usuario_${panelId}` }),
        supabase.rpc('get_gateway_secret', { p_user_id: userId, p_gateway: 'painel', p_secret_name: `senha_${panelId}` }),
      ]);
      return {
        usuario: usuarioRes.data || fallbackUsuario,
        senha: senhaRes.data || fallbackSenha,
      };
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
        .eq('provedor', providerId)
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
            provedor: p.provedor || providerId,
            dispositivo: p.dispositivo || null,
            verificacaoStatus: (p.verificacao_status as 'pendente' | 'verificado' | 'vinculado') || 'pendente',
            dispositivoId: p.dispositivo_id || null,
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
    const rawUrl = formData.urlPainel;
    const baseUrl = rawUrl.trim().replace(/\/$/, "");
    if (!formData.nomePainel.trim() || !formData.usuario.trim() || !formData.senha.trim() || !baseUrl) {
      setValidationError("Preencha todos os campos marcados com *");
      return;
    }
    if (!/^https?:\/\/.+/.test(baseUrl)) {
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
          provedor: providerId,
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
        provedor: providerId,
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
      const rawUrl = formData.urlPainel;
      const baseUrl = rawUrl.trim().replace(/\/$/, '');
      const usuario = formData.usuario.trim();
      const senha = formData.senha.trim();
      const nomePainel = formData.nomePainel.trim();

      if (!nomePainel || !usuario || !senha || !baseUrl) {
        setTestResultModal({
          isOpen: true, success: false,
          message: "Dados Obrigatórios Ausentes",
          details: "❌ Preencha nome, URL, usuário e senha com dados reais antes de testar.",
        });
        return;
      }

      // Sigma: teste direto via API
      if (providerId === 'sigma') {
        try {
          const result = await testSigmaApiConnection(baseUrl, usuario, senha);
          if (result.success) {
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO REAL BEM-SUCEDIDA!',
              details: `✅ Painel: ${nomePainel}\n🔗 Endpoint: ${result.endpoint}\n👤 Usuário: ${result.account.user}\n📡 Status: ${result.account.status}\n${result.account.credits !== undefined && result.account.credits !== null ? `💰 Créditos: ${result.account.credits}\n` : ''}\n✅ Autenticação realizada com sucesso no painel.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
              details: `❌ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n\n❌ ${result.details}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `Erro inesperado: ${err.message}`,
          });
        }
        return;
      }

      // Playfast: usa Edge Function diretamente (TOKEN + secret)
      if (providerId === 'playfast') {
        try {
          const { data, error } = await supabase.functions.invoke('playfast-renew', {
            body: { token: usuario, secret: senha, action: 'profile' },
          });

          if (error) {
            setTestResultModal({
              isOpen: true, success: false, message: "Erro no Teste",
              details: `❌ Painel: ${nomePainel}\n\n❌ Não foi possível conectar à API Playfast.\nErro: ${error.message}`,
            });
            return;
          }

          if (data?.success) {
            setTestResultModal({
              isOpen: true, success: true, message: "CONEXÃO REAL BEM-SUCEDIDA!",
              details: `✅ Painel: ${nomePainel}\n🔗 API: ${PLAYFAST_API_BASE}\n👤 Usuário: ${data.username || usuario}\n💰 Créditos: ${data.credits ?? 'n/d'}\n📧 Email: ${data.email || 'n/d'}\n📡 Status: ${data.status === 1 ? 'Ativo' : 'Inativo'}\n\n✅ Autenticação realizada com sucesso.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: "FALHA NA AUTENTICAÇÃO",
              details: `❌ Painel: ${nomePainel}\n🔗 API: ${PLAYFAST_API_BASE}\n\n❌ ${data?.error || 'TOKEN ou Secret inválidos.'}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: "Erro no Teste",
            details: `Erro inesperado: ${err.message}`,
          });
        }
        return;
      }

      // KOffice API/V2: usa Edge Function dedicada para teste (form login + verify)
      if (providerId === 'koffice-api' || providerId === 'koffice-v2') {
        try {
          const { data, error } = await supabase.functions.invoke('koffice-renew', {
            body: { action: 'test_connection', url: baseUrl, panelUser: usuario, panelPass: senha, providerId },
          });

          if (error) {
            setTestResultModal({
              isOpen: true, success: false, message: "Erro no Teste",
              details: `❌ Painel: ${nomePainel}\n\n❌ Não foi possível conectar ao painel KOffice.\nErro: ${error.message}`,
            });
            return;
          }

          if (data?.success) {
            setTestResultModal({
              isOpen: true, success: true, message: "CONEXÃO REAL BEM-SUCEDIDA!",
              details: `✅ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n👥 Total Clientes: ${data.clients_count ?? 'n/d'}\n✅ Clientes Ativos: ${data.active_clients_count ?? 'n/d'}\n\n✅ Autenticação realizada com sucesso no painel.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: "FALHA NA AUTENTICAÇÃO",
              details: `❌ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n\n❌ ${data?.error || 'Usuário ou API key inválidos. Verifique suas credenciais e tente novamente.'}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: "Erro no Teste",
            details: `Erro inesperado: ${err.message}`,
          });
        }
        return;
      }

      // Uniplay: vai direto ao browser agent (JSON POST não funciona — API retorna 404)
      if (providerId === 'uniplay') {
        try {
          console.log('🤖 Uniplay: Iniciando browser agent...');
          const { data, error } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'test_connection', url: baseUrl, username: usuario, password: senha },
          });

          if (error) {
            setTestResultModal({
              isOpen: true, success: false, message: 'Erro no Teste',
              details: `❌ Painel: ${nomePainel}\n\n❌ Browser Agent: ${error.message}`,
            });
            return;
          }

          if (data?.success && data?.error) {
            toast({ title: "✅ Credenciais válidas!", description: "Verificação de identidade (2FA) pendente. Digite o código enviado ao seu e-mail." });
            setVerificationModal({
              isOpen: true,
              panelId: '',
              panelName: nomePainel,
              step: 'code',
              email: data.email || undefined,
              token: data.browserbaseSessionId || undefined,
              url: baseUrl,
              username: usuario,
              password: senha,
            });
          } else if (data?.success) {
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO VIA AI AGENT BEM-SUCEDIDA!',
              details: `✅ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n🤖 Método: ${data.method || 'AI Browser Agent'}\n\n✅ Login automático realizado com sucesso.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
              details: `❌ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n\n❌ ${data?.error || 'Falha no login automático.'}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `Erro inesperado: ${err.message}`,
          });
        }
        return;
      }

      // UniTV: usa universal-panel (AI Browser Agent via Browserbase)
      if (providerId === 'unitv') {
        try {
          const { data, error } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'test_connection', url: baseUrl, username: usuario, password: senha },
          });

          if (error) {
            setTestResultModal({
              isOpen: true, success: false, message: 'Erro no Teste',
              details: `❌ Painel: ${nomePainel}\n\n❌ ${error.message}`,
            });
            return;
          }

          if (data?.success && data?.error) {
            // Credentials OK but 2FA required — open verification code modal
            toast({ title: "✅ Credenciais válidas!", description: "Verificação de identidade (2FA) pendente. Digite o código enviado ao seu e-mail." });
            setVerificationModal({
              isOpen: true,
              panelId: '',
              panelName: nomePainel,
              step: 'code',
              email: data.email || undefined,
              token: data.browserbaseSessionId || undefined,
              url: baseUrl,
              username: usuario,
              password: senha,
            });
          } else if (data?.success) {
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO VIA AI AGENT BEM-SUCEDIDA!',
              details: `✅ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n🤖 Método: ${data.method || 'AI Browser Agent'}\n\n✅ Login automático realizado com sucesso.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
              details: `❌ Painel: ${nomePainel}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${usuario}\n\n❌ ${data?.error || 'Falha no login automático.'}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `Erro inesperado: ${err.message}`,
          });
        }
        return;
      }

      const endpoint = provider?.loginEndpoint || '/api/auth/login';
      const payload = provider?.buildLoginPayload
        ? provider.buildLoginPayload(usuario, senha)
        : { username: usuario, password: senha };

      const extraHdrs: Record<string, string> = { Accept: 'application/json' };

      // Fallback: via Edge Function (outros provedores)
      const fallbackStrategy = getTestStrategy(providerId);
      const originalFrontendUrl = formData.urlPainel.trim().replace(/\/$/, '');
      const { data, error } = await supabase.functions.invoke('test-panel-connection', {
        body: {
          baseUrl, username: usuario, password: senha,
          endpointPath: endpoint,
          endpointMethod: provider?.loginMethod || 'POST',
          loginPayload: payload,
          providerId,
          testSteps: fallbackStrategy.steps,
          extraHeaders: extraHdrs,
          frontendUrl: originalFrontendUrl,
        },
      });

      if (error || !data) {
        setTestResultModal({
          isOpen: true, success: false, message: 'Erro no Teste',
          details: `Não foi possível executar o teste. ${error?.message ?? ''}`.trim(),
        });
        return;
      }

      if (data.success) {
        const account = data.account;
        if (data.data?.token) sessionStorage.setItem("auth_token", data.data.token);
        const isPartialValidation = data.data?.usernameValidated && !data.data?.credentialsValidated;
        let detailLines = [
          `✅ Painel: ${nomePainel}`,
          `🔗 Endpoint: ${data.endpoint}`,
          `👤 Usuário: ${usuario}`,
          `📡 Status: ${account?.status ?? 'Conectado com sucesso!'}`,
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
        if (isPartialValidation) {
          detailLines.push(`\n⚠️ Nota: Não foi possível obter os créditos do painel.`);
        }
        detailLines.push(`\n✅ Autenticação realizada com sucesso no painel.`);
        const detailsMsg = detailLines.join('\n');
        setTestResultModal({
          isOpen: true, success: true, message: "CONEXÃO REAL BEM-SUCEDIDA!",
          details: detailsMsg,
        });
      } else {
        setTestResultModal({
          isOpen: true, success: false, message: "FALHA NA AUTENTICAÇÃO",
          details: data.details || "Credenciais inválidas ou URL incorreta.",
        });
      }
    } catch (error: any) {
      setTestResultModal({
        isOpen: true, success: false, message: "Erro no Teste",
        details: `Erro inesperado durante o teste: ${error.message}`,
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
      const currentProviderId = panel.provedor || providerId;

      // Sigma: teste via Edge Function (evita CORS do navegador)
      if (currentProviderId === 'sigma') {
        let usuario = panel.usuario;
        let senha = panel.senha;
        if (usuario === 'vault' || senha === 'vault') {
          const { data: session } = await supabase.auth.getSession();
          if (session.session) {
            const resolved = await resolveVaultCredentials(panel.id, session.session.user.id, usuario, senha);
            usuario = resolved.usuario;
            senha = resolved.senha;
          }
        }
        if (usuario === 'vault' || senha === 'vault') {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro de Credenciais',
            details: `❌ Não foi possível recuperar as credenciais do painel "${panel.nome}". Edite o painel e salve novamente.`,
          });
          return;
        }
        try {
          const result = await testSigmaApiConnection(baseUrl, usuario, senha);
          if (result.success) {
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO REAL BEM-SUCEDIDA!',
              details: `✅ Painel: ${panel.nome}\n🔗 Endpoint: ${result.endpoint}\n👤 Usuário: ${result.account.user}\n📡 Status: ${result.account.status}\n${result.account.credits !== undefined && result.account.credits !== null ? `💰 Créditos: ${result.account.credits}\n` : ''}\n✅ Autenticação realizada com sucesso no painel.`,
            });
          } else {
            setTestResultModal({
              isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
              details: `❌ Painel: ${panel.nome}\n🔗 URL: ${baseUrl}\n\n❌ ${result.details}`,
            });
          }
        } catch (err: any) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `Erro inesperado durante o teste: ${err.message}`,
          });
        }
        return;
      }

      // Playfast: usa playfast-renew diretamente com TOKEN + secret
      if (currentProviderId === 'playfast') {
        const { data, error } = await supabase.functions.invoke('playfast-renew', {
          body: { token: panel.usuario, secret: panel.senha, action: 'profile' },
        });

        if (error) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `❌ Painel: ${panel.nome}\n\n❌ Não foi possível conectar à API Playfast.\nErro: ${error.message}`,
          });
          return;
        }

        if (data?.success) {
          setTestResultModal({
            isOpen: true, success: true, message: 'CONEXÃO REAL BEM-SUCEDIDA!',
            details: `✅ Painel: ${panel.nome}\n🔗 API: ${PLAYFAST_API_BASE}\n👤 Usuário: ${data.username || panel.usuario}\n💰 Créditos: ${data.credits ?? 'n/d'}\n📧 Email: ${data.email || 'n/d'}\n📡 Status: ${data.status === 1 ? 'Ativo' : 'Inativo'}\n\n✅ Autenticação realizada com sucesso.`,
          });
        } else {
          setTestResultModal({
            isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
            details: `❌ Painel: ${panel.nome}\n🔗 API: ${PLAYFAST_API_BASE}\n\n❌ ${data?.error || 'TOKEN ou Secret inválidos.'}`,
          });
        }
        return;
      }

      // KOffice: usa koffice-renew diretamente
      if (currentProviderId === 'koffice-api' || currentProviderId === 'koffice-v2') {
        const { data, error } = await supabase.functions.invoke('koffice-renew', {
          body: { action: 'test_connection', url: baseUrl, panelUser: panel.usuario, panelPass: panel.senha, providerId: currentProviderId },
        });

        if (error) {
          setTestResultModal({
            isOpen: true, success: false, message: 'Erro no Teste',
            details: `❌ Painel: ${panel.nome}\n\n❌ Não foi possível conectar ao painel KOffice.\nErro: ${error.message}`,
          });
          return;
        }

        if (data?.success) {
          setTestResultModal({
            isOpen: true, success: true, message: 'CONEXÃO REAL BEM-SUCEDIDA!',
            details: `✅ Painel: ${panel.nome}\n🔗 URL: ${baseUrl}\n👤 Usuário: ${panel.usuario}\n👥 Total Clientes: ${data.clients_count ?? 'n/d'}\n✅ Clientes Ativos: ${data.active_clients_count ?? 'n/d'}\n\n✅ Autenticação realizada com sucesso no painel.`,
          });
        } else {
          setTestResultModal({
            isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
            details: `❌ Painel: ${panel.nome}\n🔗 URL: ${baseUrl}\n\n❌ ${data?.error || 'Credenciais inválidas.'}`,
          });
        }
        return;
      }
      // UniTV: tenta cache → browser agent
      if (currentProviderId === 'unitv') {
        try {
          // Fase 0: Verificar sessão cacheada (instantâneo ~2s)
          console.log('⚡ UniTV: Verificando sessão cacheada...');
          const { data: cacheData, error: cacheError } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'check_cached_session', panelId: panel.id },
          });

          if (!cacheError && cacheData?.success && cacheData?.cached) {
            const account = cacheData.account;
            let detailLines = [
              `✅ Painel: ${panel.nome}`,
              `⚡ Método: ${cacheData.method || 'Sessão Cacheada'}`,
              `👤 Usuário: ${panel.usuario}`,
              `📡 Status: ${account?.status ?? 'OK'}`,
            ];
            if (account?.credits !== undefined && account?.credits !== null) {
              detailLines.push(`💰 Créditos: ${account.credits}`);
            }
            detailLines.push(`\n✅ Conexão verificada instantaneamente via cache!`);
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO VERIFICADA (CACHE)!',
              details: detailLines.join('\n'),
            });
            return;
          }
          console.log(`⚠️ Cache miss: ${cacheData?.reason || 'não disponível'}`);

          // Browser agent
          console.log('🤖 UniTV: Iniciando browser agent...');
          const { data, error } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'test_connection', panelId: panel.id },
          });
          if (error) {
            setTestResultModal({ isOpen: true, success: false, message: 'Erro', details: `❌ ${panel.nome}\n\n❌ ${error.message}` });
            return;
          }

          if (data?.success && data?.error) {
            toast({ title: "✅ Credenciais válidas!", description: "Verificação de identidade (2FA) pendente. Digite o código enviado ao seu e-mail." });
            setVerificationModal({
              isOpen: true, panelId: panel.id, panelName: panel.nome, step: 'code',
              email: data.email || undefined, token: data.browserbaseSessionId || undefined,
            });
            return;
          }

          setTestResultModal({
            isOpen: true, success: !!data?.success,
            message: data?.success ? 'CONEXÃO VIA AI AGENT OK!' : 'FALHA NO LOGIN',
            details: data?.success
              ? `✅ Painel: ${panel.nome}\n🤖 ${data.method || 'AI Browser Agent'}\n\n✅ Login automático realizado com sucesso.`
              : `❌ Painel: ${panel.nome}\n\n❌ ${cleanAgentError(data?.error || 'Falha.')}`,
          });
        } catch (err: any) {
          setTestResultModal({ isOpen: true, success: false, message: 'Erro', details: err.message });
        }
        return;
      }

      // Uniplay: tenta cache → JSON POST → browser agent
      if (currentProviderId === 'uniplay') {
        try {
          // Fase 0: Verificar sessão cacheada (instantâneo ~2s)
          console.log('⚡ Uniplay: Verificando sessão cacheada...');
          const { data: cacheData, error: cacheError } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'check_cached_session', panelId: panel.id },
          });

          if (!cacheError && cacheData?.success && cacheData?.cached) {
            const account = cacheData.account;
            let detailLines = [
              `✅ Painel: ${panel.nome}`,
              `⚡ Método: ${cacheData.method || 'Sessão Cacheada'}`,
              `👤 Usuário: ${panel.usuario}`,
              `📡 Status: ${account?.status ?? 'OK'}`,
            ];
            if (account?.credits !== undefined && account?.credits !== null) {
              detailLines.push(`💰 Créditos: ${account.credits}`);
            }
            detailLines.push(`\n✅ Conexão verificada instantaneamente via cache!`);
            setTestResultModal({
              isOpen: true, success: true, message: 'CONEXÃO VERIFICADA (CACHE)!',
              details: detailLines.join('\n'),
            });
            return;
          }
          console.log(`⚠️ Cache miss: ${cacheData?.reason || 'não disponível'}`);

          // Direto ao browser agent (JSON POST não funciona — API retorna 404)
          console.log('🤖 Uniplay: Iniciando browser agent...');
          const { data, error } = await supabase.functions.invoke('universal-panel', {
            body: { action: 'test_connection', panelId: panel.id },
          });
          if (error) {
            setTestResultModal({ isOpen: true, success: false, message: 'Erro', details: `❌ ${panel.nome}\n\n❌ Browser Agent: ${error.message}` });
            return;
          }

          if (data?.success && data?.error) {
            toast({ title: "✅ Credenciais válidas!", description: "Verificação de identidade (2FA) pendente." });
            setVerificationModal({
              isOpen: true, panelId: panel.id, panelName: panel.nome, step: 'code',
              email: data.email || undefined, token: data.browserbaseSessionId || undefined,
            });
            return;
          }

          setTestResultModal({
            isOpen: true, success: !!data?.success,
            message: data?.success ? 'CONEXÃO VIA AI AGENT OK!' : 'FALHA NO LOGIN',
            details: data?.success
              ? `✅ Painel: ${panel.nome}\n🤖 ${data.method || 'AI Browser Agent'}\n\n✅ Login automático realizado com sucesso.`
              : `❌ Painel: ${panel.nome}\n\n❌ ${cleanAgentError(data?.error || 'Falha.')}`,
          });
        } catch (err: any) {
          setTestResultModal({ isOpen: true, success: false, message: 'Erro', details: err.message });
        }
        return;
      }

      const prov = PROVEDORES.find(p => p.id === currentProviderId);
      const endpoint = prov?.loginEndpoint || '/api/auth/login';
      const payload = prov?.buildLoginPayload
        ? prov.buildLoginPayload(panel.usuario, panel.senha)
        : { username: panel.usuario, password: panel.senha };

      const strategy = getTestStrategy(currentProviderId);
      const { data, error } = await supabase.functions.invoke('test-panel-connection', {
        body: {
          baseUrl, username: panel.usuario, password: panel.senha,
          endpointPath: endpoint,
          endpointMethod: prov?.loginMethod || 'POST',
          loginPayload: payload,
          providerId: currentProviderId,
          testSteps: strategy.steps,
          extraHeaders: { Accept: 'application/json' },
        },
      });

      if (error || !data) {
        setTestResultModal({
          isOpen: true, success: false, message: 'Erro no Teste',
          details: `Não foi possível executar o teste agora. ${error?.message ?? ''}`.trim(),
        });
        return;
      }

      if (data.success) {
        const account = data.account;
        const isPartialValidation = data.data?.usernameValidated && !data.data?.credentialsValidated;

        // MundoGF: se não veio créditos, busca via mundogf-renew (login mais robusto)
        let credits = account?.credits;
        let totalClients = account?.totalClients;
        let activeClients = account?.activeClients;
        if (currentProviderId === 'mundogf' && (credits === undefined || credits === null)) {
          try {
            const { data: credData, error: credError } = await supabase.functions.invoke('mundogf-renew', {
              body: { action: 'get_credits', panelId: panel.id },
            });
            if (!credError && credData?.success && credData?.credits !== null && credData?.credits !== undefined) {
              credits = credData.credits;
            }
          } catch {
            // silently ignore - credits are optional
          }
        }

        let detailLines2 = [
          `✅ Painel: ${panel.nome}`,
          `🔗 Endpoint: ${data.endpoint}`,
          `👤 Usuário: ${panel.usuario}`,
          `📡 Status: ${account?.status ?? 'Conectado com sucesso!'}`,
        ];
        if (credits !== undefined && credits !== null) {
          detailLines2.push(`💰 Créditos: ${credits}`);
        }
        if (totalClients !== undefined) {
          detailLines2.push(`👥 Total de Clientes: ${totalClients}`);
        }
        if (activeClients !== undefined) {
          detailLines2.push(`✅ Clientes Ativos: ${activeClients}`);
        }
        if (account?.exp_date) {
          detailLines2.push(`⏱️ Expira: ${account.exp_date}`);
        }
        if (isPartialValidation && (credits === undefined || credits === null)) {
          detailLines2.push(`\n⚠️ Nota: Não foi possível obter os créditos do painel.`);
        }
        detailLines2.push(`\n✅ Autenticação realizada com sucesso no painel.`);
        const detailsMsg = detailLines2.join('\n');
        setTestResultModal({
          isOpen: true, success: true, message: 'CONEXÃO REAL BEM-SUCEDIDA!',
          details: detailsMsg,
        });
      } else {
        const logs = Array.isArray(data.logs)
          ? data.logs.slice(0, 4).map((l: any) => {
              const s = [l.status ? `status: ${l.status}` : null, l.ok !== undefined ? `ok: ${l.ok}` : null].filter(Boolean).join(', ');
              return `• ${l.url} ${s ? `(${s})` : ''}\n${(l.snippet || '').slice(0, 200)}`;
            }).join('\n\n')
          : '';
        setTestResultModal({
          isOpen: true, success: false, message: 'FALHA NA AUTENTICAÇÃO',
          details: `${data.details || 'Usuário/senha inválidos ou URL incorreta.'}${logs ? '\n\nTentativas:\n' + logs : ''}`,
        });
      }
    } catch (error: any) {
      setTestResultModal({
        isOpen: true, success: false, message: 'Erro no Teste',
        details: `Erro inesperado durante o teste: ${error.message}`,
      });
    } finally {
      setIsTestingConnection(false);
      setTestingPanelId(null);
    }
  };

  const startEditPanel = (panel: Panel) => {
    setEditForm({ id: panel.id, nome: panel.nome, url: panel.url, usuario: panel.usuario, senha: '' });
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
    if (!/^https?:\/\/.+/.test(baseUrl)) {
      setEditValidationError('Informe uma URL válida iniciando com http:// ou https://');
      return;
    }
    setEditValidationError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({ title: "Erro", description: "Você precisa estar logado" });
        return;
      }

      const { error } = await supabase
        .from('paineis_integracao' as any)
        .update({ nome: editForm.nome.trim(), url: baseUrl })
        .eq('id', editForm.id);
      if (error) throw error;

      // Update vault credentials if provided
      const userId = session.session.user.id;
      if (editForm.usuario?.trim()) {
        await supabase.rpc('store_gateway_secret', {
          p_user_id: userId, p_gateway: 'painel',
          p_secret_name: `usuario_${editForm.id}`, p_secret_value: editForm.usuario.trim(),
        });
      }
      if (editForm.senha?.trim()) {
        await supabase.rpc('store_gateway_secret', {
          p_user_id: userId, p_gateway: 'painel',
          p_secret_name: `senha_${editForm.id}`, p_secret_value: editForm.senha.trim(),
        });
      }

      setPanels((prev) => prev.map((p) => (p.id === editForm.id ? {
        ...p,
        nome: editForm.nome.trim(),
        url: baseUrl,
        ...(editForm.usuario?.trim() ? { usuario: editForm.usuario.trim() } : {}),
        ...(editForm.senha?.trim() ? { senha: editForm.senha.trim() } : {}),
      } : p)));
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

  const stats = {
    total: panels.length,
    ativos: panels.filter(p => p.status === 'Ativo').length,
    inativos: panels.filter(p => p.status === 'Inativo').length,
  };

  const openAddPanel = () => {
    const defaultUrl = providerId === 'playfast' ? PLAYFAST_API_BASE : '';
    setFormData({ nomePainel: "", urlPainel: defaultUrl, usuario: "", senha: "" });
    setAutoRenewal(false);
    setValidationError(null);
    setIsConfigModalOpen(true);
  };

  // ==================== UniTV: Verify Panel (Login + Captcha → Auto Send Code) ====================
  const handleVerifyPanel = async (panel: Panel) => {
    setVerifyingPanelId(panel.id);
    try {
      // Step 1: Login with captcha resolution
      const { data, error } = await supabase.functions.invoke('universal-panel', {
        body: { action: 'test_connection', panelId: panel.id },
      });

      if (error) {
        setTestResultModal({
          isOpen: true, success: false, message: 'Erro na Verificação',
          details: `❌ Painel: ${panel.nome}\n\n❌ ${error.message}`,
        });
        return;
      }

      if (!data?.success) {
        setTestResultModal({
          isOpen: true, success: false, message: 'FALHA NA VERIFICAÇÃO',
          details: `❌ Painel: ${panel.nome}\n\n❌ ${data?.error || 'Não foi possível verificar o painel.'}`,
        });
        return;
      }

      // Login succeeded - check if 2FA needed
      if (data.needsVerification) {
        await supabase
          .from('paineis_integracao' as any)
          .update({ verificacao_status: 'verificado' })
          .eq('id', panel.id);
        setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, verificacaoStatus: 'verificado' as const } : p));

        // Step 2: Auto-send verification code to email
        toast({ title: "Login realizado!", description: "Enviando código de verificação para o e-mail..." });

        const { data: sendData, error: sendError } = await supabase.functions.invoke('universal-panel', {
          body: { action: 'resend_2fa_code', panelId: panel.id },
        });

        if (sendError || !sendData?.success) {
          // Send failed - open modal at send step so user can retry
          setVerificationModal({
            isOpen: true, panelId: panel.id, panelName: panel.nome,
            step: 'send', email: data.email, token: data.token,
          });
          toast({ title: "Aviso", description: sendData?.error || sendError?.message || "Não foi possível enviar o código automaticamente. Tente manualmente." });
          return;
        }

        // Code sent successfully - open modal directly at code input step
        setVerificationModal({
          isOpen: true, panelId: panel.id, panelName: panel.nome,
          step: 'code', email: sendData.email || data.email, token: data.token,
        });
        toast({ title: "Código Enviado!", description: `Verifique o e-mail ${sendData.email || data.email || 'cadastrado'}` });
      } else {
        // No 2FA needed - direct success
        await supabase
          .from('paineis_integracao' as any)
          .update({ verificacao_status: 'vinculado', dispositivo_id: data.deviceId || null })
          .eq('id', panel.id);
        setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, verificacaoStatus: 'vinculado' as const, dispositivoId: data.deviceId || null } : p));
        setTestResultModal({
          isOpen: true, success: true, message: 'VERIFICAÇÃO BEM-SUCEDIDA!',
          details: `✅ Painel: ${panel.nome}\n🔗 Dispositivo vinculado com sucesso!\n🆔 ID: ${data.deviceId || 'n/d'}`,
        });
      }
    } catch (err: any) {
      setTestResultModal({
        isOpen: true, success: false, message: 'Erro na Verificação',
        details: `Erro inesperado: ${err.message}`,
      });
    } finally {
      setVerifyingPanelId(null);
    }
  };

  // ==================== UniTV: Send 2FA Code to Email ====================
  const handleSendVerifyCode = async () => {
    const { panelId, url, username, password } = verificationModal;
    setIsSendingCode(true);
    try {
      const bodyPayload: any = { action: 'resend_2fa_code' };
      if (panelId) bodyPayload.panelId = panelId;
      else { bodyPayload.url = url; bodyPayload.username = username; bodyPayload.password = password; }
      const { data, error } = await supabase.functions.invoke('universal-panel', {
        body: bodyPayload,
      });

      if (error) {
        toast({ title: "Erro", description: error.message });
        return;
      }

      if (data?.alreadyAuthorized) {
        toast({ title: "Sucesso", description: "Dispositivo já está autorizado!" });
        setVerificationModal({ isOpen: false, panelId: '', panelName: '', step: 'send' });
        return;
      }

      if (data?.success) {
        toast({ title: "Código Enviado", description: data.message || "Verifique seu e-mail" });
        setVerificationModal(prev => ({
          ...prev,
          step: 'code',
          email: data.email || prev.email,
        }));
      } else {
        toast({ title: "Erro", description: data?.error || "Falha ao enviar código" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message });
    } finally {
      setIsSendingCode(false);
    }
  };

  // ==================== UniTV: Submit Verification Code (Vincular) ====================
  const handleSubmitVerificationCode = async (code: string) => {
    const { panelId, panelName, url, username, password, token } = verificationModal;
    setIsSubmittingCode(true);
    try {
      const bodyPayload: any = { action: 'submit_2fa_code', code };
      if (panelId) bodyPayload.panelId = panelId;
      else { bodyPayload.url = url; bodyPayload.username = username; bodyPayload.password = password; }
      // Pass the browserbaseSessionId so the edge function can reconnect to the original session
      if (token) bodyPayload.browserbaseSessionId = token;

      const { data, error } = await supabase.functions.invoke('universal-panel', {
        body: bodyPayload,
      });

      if (error) {
        toast({ title: "Erro", description: error.message });
        return;
      }

      // If the session expired and a new code was sent, inform user
      if (data?.newCodeSent) {
        toast({ title: "⚠️ Novo código enviado", description: "A sessão expirou. Um novo código foi enviado para seu e-mail. Digite o novo código." });
        // Update the token to the new session ID for the next attempt
        if (data.browserbaseSessionId) {
          setVerificationModal(prev => ({ ...prev, token: data.browserbaseSessionId }));
        }
        return;
      }

      if (data?.success) {
        await supabase
          .from('paineis_integracao' as any)
          .update({ verificacao_status: 'vinculado', dispositivo_id: data.deviceId || null, dispositivo: data.deviceName || null })
          .eq('id', panelId);

        setPanels(prev => prev.map(p => p.id === panelId ? { ...p, verificacaoStatus: 'vinculado' as const, dispositivoId: data.deviceId || null, dispositivo: data.deviceName || null } : p));
        setVerificationModal({ isOpen: false, panelId: '', panelName: '', step: 'send' });

        setTestResultModal({
          isOpen: true, success: true, message: 'DISPOSITIVO VINCULADO!',
          details: `✅ Painel: ${panelName}\n🔗 Dispositivo vinculado com sucesso!\n🆔 ID: ${data.deviceId || 'n/d'}\n📱 Nome: ${data.deviceName || 'n/d'}`,
        });
      } else {
        toast({ title: "Erro", description: data?.error || 'Código inválido. Tente novamente.' });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message });
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Open vincular modal directly
  const handleVincularPanel = (panel: Panel) => {
    setVerificationModal({ isOpen: true, panelId: panel.id, panelName: panel.nome, step: 'send' });
  };

  // ==================== Check Credits ====================
  const [checkingCreditsPanelId, setCheckingCreditsPanelId] = useState<string | null>(null);

  const handleCheckCredits = async (panel: Panel) => {
    setCheckingCreditsPanelId(panel.id);
    try {
      // MundoGF uses mundogf-renew edge function
      if (panel.provedor === 'mundogf') {
        const { data, error } = await supabase.functions.invoke('mundogf-renew', {
          body: { action: 'get_credits', panelId: panel.id },
        });

        const credits = (!error && data?.success && data?.credits !== null && data?.credits !== undefined)
          ? data.credits
          : 'S/N';

        setTestResultModal({
          isOpen: true, success: true, message: 'Créditos do Painel',
          details: `✅ Painel: ${panel.nome}\n\n💰 Créditos: ${credits}`,
        });
        return;
      }

      // UniTV/Uniplay use universal-panel
      const { data, error } = await supabase.functions.invoke('universal-panel', {
        body: { action: 'check_credits', panelId: panel.id },
      });

      if (error) {
        setTestResultModal({
          isOpen: true, success: false, message: 'Erro ao consultar créditos',
          details: `❌ Painel: ${panel.nome}\n\n❌ ${error.message}`,
        });
        return;
      }

      if (data?.success && data?.creditsFound) {
        setTestResultModal({
          isOpen: true, success: true, message: 'CRÉDITOS CONSULTADOS!',
          details: `✅ Painel: ${panel.nome}\n🔗 URL: ${panel.url}\n\n💰 ${data.creditsLabel || 'Créditos'}: ${data.credits}\n${data.extraInfo ? `\n📋 ${data.extraInfo}` : ''}\n\n🤖 Método: ${data.method || 'AI Browser Agent'}`,
        });
      } else if (data?.success) {
        setTestResultModal({
          isOpen: true, success: true, message: 'LOGIN OK (Créditos não encontrados)',
          details: `✅ Painel: ${panel.nome}\n🔗 URL: ${panel.url}\n\n⚠️ Login realizado com sucesso, mas não foi possível localizar os créditos na página.\n${data.extraInfo ? `\n📋 ${data.extraInfo}` : ''}\n\n🤖 Método: ${data.method || 'AI Browser Agent'}`,
        });
      } else {
        setTestResultModal({
          isOpen: true, success: false, message: 'FALHA AO CONSULTAR CRÉDITOS',
          details: `❌ Painel: ${panel.nome}\n\n❌ ${data?.error || 'Não foi possível fazer login para consultar créditos.'}`,
        });
      }
    } catch (err: any) {
      setTestResultModal({
        isOpen: true, success: false, message: 'Erro',
        details: `Erro inesperado: ${err.message}`,
      });
    } finally {
      setCheckingCreditsPanelId(null);
    }
  };

  // ==================== Search User ====================
  const [searchUserModal, setSearchUserModal] = useState<{
    isOpen: boolean; panelId: string; panelName: string;
    isSearching: boolean; searchQuery: string;
    result: { found: boolean; user?: any; error?: string } | null;
  }>({ isOpen: false, panelId: '', panelName: '', isSearching: false, searchQuery: '', result: null });

  const openSearchUserModal = (panel: Panel) => {
    setSearchUserModal({
      isOpen: true, panelId: panel.id, panelName: panel.nome,
      isSearching: false, searchQuery: '', result: null,
    });
  };

  const handleSearchUser = async (searchUsername: string) => {
    const { panelId, panelName } = searchUserModal;
    setSearchUserModal(prev => ({ ...prev, isSearching: true, searchQuery: searchUsername, result: null }));
    try {
      const { data, error } = await supabase.functions.invoke('universal-panel', {
        body: { action: 'search_user', panelId, searchUsername },
      });

      if (error) {
        setSearchUserModal(prev => ({
          ...prev, isSearching: false,
          result: { found: false, error: error.message },
        }));
        return;
      }

      setSearchUserModal(prev => ({
        ...prev, isSearching: false,
        result: {
          found: data?.success === true,
          user: data?.user || null,
          error: data?.error || undefined,
        },
      }));
    } catch (err: any) {
      setSearchUserModal(prev => ({
        ...prev, isSearching: false,
        result: { found: false, error: err.message },
      }));
    }
  };

  return {
    provider, panels, stats,
    isConfigModalOpen, setIsConfigModalOpen,
    showPassword, setShowPassword,
    autoRenewal, setAutoRenewal,
    isTestingConnection, testingPanelId,
    verifyingPanelId,
    checkingCreditsPanelId,
    formData, setFormData,
    validationError, setValidationError,
    editValidationError, setEditValidationError,
    testResultModal, setTestResultModal,
    createResultModal, setCreateResultModal,
    deleteConfirmModal, setDeleteConfirmModal,
    isEditModalOpen, setIsEditModalOpen,
    editForm, setEditForm,
    verificationModal, setVerificationModal,
    isSubmittingCode, isSendingCode,
    searchUserModal, setSearchUserModal,
    openAddPanel,
    handleCreatePanel, handleTestConnection,
    testPanel, startEditPanel, handleSaveEditPanel,
    handleToggleStatus, openDeleteConfirm, handleDeletePanel,
    handleVerifyPanel, handleSubmitVerificationCode, handleVincularPanel, handleSendVerifyCode,
    handleCheckCredits,
    openSearchUserModal, handleSearchUser,
  };
}
