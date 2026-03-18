import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Cliente, Aplicativo, Plano, Produto, TemplateCobranca, MensagensPadroes } from '@/types/database';
import { logPainel } from '@/utils/logger';
import { useCurrentUser } from './useCurrentUser';

// Hook para Clientes
export const useClientes = () => {
  const { userId } = useCurrentUser();
  const criar = async (cliente: Omit<Cliente, 'id' | 'created_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          ...cliente,
          user_id: userId
        }])
        .select()
        .single();

      if (error || !data) throw error || new Error('Falha ao criar cliente');
      logPainel(`Cliente criado: ${cliente.nome}`, "success");
      return data;
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast.error('Erro ao criar cliente');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
  };

  const buscarPorId = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar cliente por ID:', error);
      return null;
    }
  };

  const editar = async (id: string, cliente: Partial<Omit<Cliente, 'id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(cliente)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Cliente atualizado`, "success");
      // toast.success('Cliente atualizado com sucesso!'); // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
      throw error;
    }
  };

  const deletar = async (id: string) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      logPainel(`Cliente excluído`, "warning");
      toast.success('Cliente excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
      throw error;
    }
  };

  return { criar, buscar, buscarPorId, editar, deletar };
};

// Hook para Aplicativos
export const useAplicativos = () => {
  const { userId } = useCurrentUser();
  const criar = async (aplicativo: Omit<Aplicativo, 'id' | 'created_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('aplicativos')
        .insert([{ ...aplicativo, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Aplicativo criado: ${aplicativo.nome}`, "success");
      // toast.success('Aplicativo criado com sucesso!'); // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao criar aplicativo:', error);
      toast.error('Erro ao criar aplicativo');
      throw error;
    }
  };

  const atualizar = async (id: string, aplicativo: Partial<Omit<Aplicativo, 'id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('aplicativos')
        .update(aplicativo)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Aplicativo atualizado`, "success");
      // toast.success('Aplicativo atualizado com sucesso!'); // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao atualizar aplicativo:', error);
      toast.error('Erro ao atualizar aplicativo');
      throw error;
    }
  };

  const deletar = async (id: string) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('aplicativos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      logPainel(`Aplicativo excluído`, "warning");
      toast.success('Aplicativo excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir aplicativo:', error);
      toast.error('Erro ao excluir aplicativo');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      const { data, error } = await supabase
        .from('aplicativos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar aplicativos:', error);
      return [];
    }
  };

  const buscarPorId = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('aplicativos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar aplicativo por ID:', error);
      return null;
    }
  };

  return { criar, atualizar, buscar, buscarPorId, deletar };
};

// Hook para Planos
export const usePlanos = () => {
  const { userId } = useCurrentUser();
  const criar = async (plano: Omit<Plano, 'id' | 'created_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('planos')
        .insert([{ ...plano, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Plano criado: ${plano.nome}`, "success");
      // toast.success('Plano criado com sucesso!') // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      toast.error('Erro ao criar plano');
      throw error;
    }
  };

  const atualizar = async (id: string, plano: Partial<Omit<Plano, 'id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .update(plano)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Plano atualizado`, "success");
      // toast.success('Plano atualizado com sucesso!') // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      toast.error('Erro ao atualizar plano');
      throw error;
    }
  };

  const deletar = async (id: string) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      logPainel(`Plano excluído`, "warning");
      // toast.success('Plano excluído com sucesso!') // desativado para exibir apenas o modal de sucesso
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      toast.error('Erro ao excluir plano');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      return [];
    }
  };

  const buscarPorId = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar plano por ID:', error);
      return null;
    }
  };

  return { criar, atualizar, buscar, buscarPorId, deletar };
};

// Hook para Produtos
export const useProdutos = () => {
  const { userId } = useCurrentUser();
  const criar = async (produto: Omit<Produto, 'id' | 'created_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('produtos')
        .insert([{ ...produto, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Produto criado: ${produto.nome}`, "success");
      // toast.success('Produto criado com sucesso!') // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      toast.error('Erro ao criar produto');
      throw error;
    }
  };

  const atualizar = async (id: string, produto: Partial<Omit<Produto, 'id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .update(produto)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logPainel(`Produto atualizado`, "success");
      // toast.success('Produto atualizado com sucesso!') // desativado para exibir apenas o modal de sucesso
      return data;
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto');
      throw error;
    }
  };

  const deletar = async (id: string) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      logPainel(`Produto excluído`, "warning");
      // toast.success('Produto excluído com sucesso!') // desativado para exibir apenas o modal de sucesso
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      return [];
    }
  };

  const buscarPorId = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar produto por ID:', error);
      return null;
    }
  };

  return { criar, atualizar, buscar, buscarPorId, deletar };
};

// Hook para Templates de Cobrança
export const useTemplatesCobranca = () => {
  const { userId } = useCurrentUser();
  const SEED_DISABLED_KEY = 'templates_cobranca_seed_disabled';

  const isSeedDisabled = () => {
    try {
      return localStorage.getItem(SEED_DISABLED_KEY) === '1';
    } catch {
      return false;
    }
  };

  const disableSeed = () => {
    try {
      localStorage.setItem(SEED_DISABLED_KEY, '1');
    } catch {
      // ignore (ex: privacy mode)
    }
  };

  const criar = async (template: Omit<TemplateCobranca, 'id' | 'created_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('templates_cobranca')
        .insert([{ ...template, user_id: userId }])
        .select()
        .single();

      if (error) throw error;

      logPainel(`Template cobrança criado: ${template.nome}`, "success");
      toast.success('Template criado com sucesso!');
      return data;
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error('Erro ao criar template');
      throw error;
    }
  };

  const atualizar = async (id: string, template: Partial<Omit<TemplateCobranca, 'id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('templates_cobranca')
        .update(template)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      logPainel(`Template cobrança atualizado`, "success");
      toast.success('Template atualizado com sucesso!');
      return data;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      toast.error('Erro ao atualizar template');
      throw error;
    }
  };

  const criarTemplatesPadroes = async (uid?: string) => {
    const usuarioAlvo = uid || userId;
    if (!usuarioAlvo) return;

    const templatesPadroes = [
      {
        nome: 'Dados de acesso do cliente',
        mensagem: `Olá! {cliente}\n\n🔰 Seguem seus dados de acesso:\n\nUsuário: {usuario}\nSenha: {senha}\n\nQualquer dúvida, estamos à disposição!`,
        incluir_cartao: false,
        incluir_chave_pix: false,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Confirmação de Pagamento',
        mensagem: `Olá, {nome}.\n\n✅ Seu pagamento foi realizado e o seu acesso será renovado em alguns minutos!.\n\nPróximo vencimento: {vencimento} ❗\n\nQualquer dúvida, estamos por aqui!\n\nObrigado!`,
        incluir_cartao: false,
        incluir_chave_pix: false,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Plano Venceu Ontem',
        mensagem: `{saudacao}, {nome}\n\n🟥 SEU PLANO VENCEU ONTEM\n\nPra continuar aproveitando seus canais, realize o pagamento o quanto antes.\n\nDADOS DA FATURA:\n\n🔹 Vencimento: {vencimento}\n🔸 {plano}: {valor_plano}\n🔹 Desconto: ~{desconto}~\n🔸 Total a pagar: {total}\n\n👉🏼 Pagamento rápido em 1 clique: copie o pix e cole no aplicativo do banco. \n\nNome: SEUNOME\nBanco: SEUBANCO\nPix: COLOQUE SEU PIX\n\n⚠️ Qualquer dúvida ou dificuldade, é só nos avisar aqui no mesmo instante!`,
        incluir_cartao: false,
        incluir_chave_pix: true,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Plano Vencendo Hoje',
        mensagem: `{saudacao}, {nome}\n\n⚠️ SEU VENCIMENTO É HOJE! Pra continuar aproveitando seus canais, realize o pagamento o quanto antes.\n\nDADOS DA FATURA:\n\n🔹 Vencimento: {vencimento}\n🔸 {plano}: {valor_plano}\n🔹 Desconto: ~{desconto}~\n🔸 Total a pagar: {total}\n\n👉🏼 Pagamento rápido em 1 clique: copie o pix e cole no aplicativo do banco. \n\nNome: SEUNOME\nBanco: SEUBANCO\nPix: COLOQUE SEU PIX\n\n⚠️ Qualquer dúvida ou dificuldade, é só nos avisar aqui no mesmo instante!`,
        incluir_cartao: false,
        incluir_chave_pix: true,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Plano Vencendo Amanhã',
        mensagem: `{saudacao}, {nome}\n\n⚠️ Passando so pra avisar que seu Plano vence amanha!\n\nDADOS DA FATURA:\n\n🔹 Vencimento: {vencimento}\n🔸 {plano}: {valor_plano}\n🔹 Desconto: ~{desconto}~\n🔸 Total a pagar: {total}\n\n👉🏼 Pagamento rápido em 1 clique: copie o pix e cole no aplicativo do banco. \n\nNome: SEUNOME\nBanco: SEUBANCO\nPix: COLOQUE SEU PIX\n\n⚠️ Qualquer dúvida ou dificuldade, é só nos avisar aqui no mesmo instante!`,
        incluir_cartao: false,
        incluir_chave_pix: true,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Fatura Criada',
        mensagem: `{saudacao}, {nome}\n\n📜 Sua fatura foi gerada com sucesso!\n\nDADOS DA FATURA:\n\n🔹 Vencimento: {vencimento}\n🔸 {plano}: {valor_plano}\n🔹 Desconto: ~{desconto}~\n🔸 Total a pagar: {total}\n\n👉🏼 Pagamento rápido em 1 clique: copie o pix e cole no aplicativo do banco. \n\nNome: SEUNOME\nBanco: SEUBANCO\nPix: COLOQUE SEU PIX\n\n⚠️ Qualquer dúvida ou dificuldade, é só nos avisar aqui no mesmo instante!`,
        incluir_cartao: false,
        incluir_chave_pix: true,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
      {
        nome: 'Bem vindo',
        mensagem: `{saudacao} {nome}. \n\n🎉 Seja bem-vindo(a) à COLOQUESUAMARCA !\n\nAqui você tem acesso ao melhor do entretenimento: filmes, séries, canais e muito mais, tudo em alta qualidade\n\n⚠️ Qualquer dúvida ou problema, é só nos chamar aqui no mesmo instante!`,
        incluir_cartao: false,
        incluir_chave_pix: false,
        chave_pix: '',
        user_id: usuarioAlvo,
      },
    ];

    try {
      await supabase.from('templates_cobranca').insert(templatesPadroes);
    } catch (error) {
      console.error('Erro ao criar templates padrões:', error);
    }
  };

  const buscar = async () => {
    try {
      let uid = userId;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id || null;
      }
      if (!uid) return [];

      const { data, error } = await supabase
        .from('templates_cobranca')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      return [];
    }
  };

  const deletar = async (id: string) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('templates_cobranca')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Template excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error('Erro ao excluir template');
      throw error;
    }
  };

  // OBS: botão "Restaurar Padrão" no app, na prática, deve LIMPAR a lista
  const restaurarPadroes = async () => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');

      const { error: deleteError } = await supabase
        .from('templates_cobranca')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Evita recriar padrões automaticamente após o usuário optar por deixar vazio
      disableSeed();

      toast.success('Templates removidos com sucesso!');
    } catch (error) {
      console.error('Erro ao restaurar templates:', error);
      toast.error('Erro ao restaurar templates');
      throw error;
    }
  };

  return { criar, atualizar, buscar, deletar, restaurarPadroes };
};


// Hook para Mensagens Padrões
export const useMensagensPadroes = () => {
  const { userId } = useCurrentUser();
  const salvar = async (mensagens: Omit<MensagensPadroes, 'id' | 'updated_at' | 'user_id'>) => {
    try {
      if (!userId) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('mensagens_padroes')
        .upsert({
          id: 1,
          confirmacao_cliente: mensagens.confirmacao_cliente,
          expiracao_app: mensagens.expiracao_app,
          aniversario_cliente: mensagens.aniversario_cliente,
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Mensagens salvas com sucesso!');
      return data;
    } catch (error) {
      console.error('Erro ao salvar mensagens:', error);
      toast.error('Erro ao salvar mensagens');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('mensagens_padroes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return null;
    }
  };

  return { salvar, buscar };
};

// Hook para Configurações (singleton)
export const useConfiguracoes = () => {
  const salvarCobrancasStatus = async (ativo: boolean) => {
    try {
      localStorage.setItem('cobrancas_ativas', JSON.stringify(ativo));
      toast.success(ativo ? 'Cobranças ativadas' : 'Cobranças desativadas');
      return { cobrancas_ativas: ativo } as { cobrancas_ativas: boolean };
    } catch (error) {
      console.error('Erro ao atualizar configuração de cobranças:', error);
      toast.error('Erro ao atualizar cobranças');
      throw error;
    }
  };

  const buscar = async () => {
    try {
      const raw = localStorage.getItem('cobrancas_ativas');
      return raw ? ({ cobrancas_ativas: JSON.parse(raw) } as { cobrancas_ativas: boolean }) : null;
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      return null;
    }
  };

  return { salvarCobrancasStatus, buscar };
};

