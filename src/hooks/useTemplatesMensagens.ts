import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';
import { logPainel } from '@/utils/logger';

export interface TemplateMensagem {
  id: string;
  nome: string;
  mensagem: string;
  midia: boolean;
  padrao: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

const defaultTemplates: Omit<TemplateMensagem, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  
  { nome: "Confirmação de Pagamento", mensagem: "Olá, *{nome_cliente}*. {br}{br} ✅ *Seu pagamento foi realizado!*", midia: false, padrao: false },
  { nome: "Plano Venceu Ontem", mensagem: "{saudacao}. *{nome_cliente}*. {br}{br} 🟥 *SEU PLANO VENCEU*", midia: false, padrao: false },
  { nome: "Plano Vencendo Hoje", mensagem: "{saudacao}. *{nome_cliente}*. {br}{br} ⚠️ *SEU VENCIMENTO É HOJE!*", midia: false, padrao: false },
  { nome: "Plano Vencendo Amanhã", mensagem: "{saudacao}. *{nome_cliente}*. {br}{br} 📅 *SEU PLANO VENCE AMANHÃ!*", midia: false, padrao: false },
  { nome: "Fatura Criada", mensagem: "{saudacao}. *{nome_cliente}*. {br}{br}* 📄 Sua fatura foi gerada com sucesso!*", midia: false, padrao: false },
  { nome: "Bem vindo", mensagem: "{saudacao} *{nome_cliente}*. {br}{br}🎉 Seja bem-vindo(a) à *Tech Play!*", midia: false, padrao: false },
];

export const useTemplatesMensagens = () => {
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useCurrentUser();

  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('templates_mensagens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createDefaultTemplates = async (showToast = true) => {
    if (!userId) return;

    try {
      const templatesWithUserId = defaultTemplates.map(t => ({
        ...t,
        user_id: userId,
      }));

      const { data, error } = await supabase
        .from('templates_mensagens')
        .insert(templatesWithUserId)
        .select();

      if (error) throw error;
      
      if (data) {
        setTemplates(data);
        if (showToast) {
          toast.success('Templates padrões criados!');
        }
      }
    } catch (error) {
      console.error('Erro ao criar templates padrões:', error);
    }
  };

  const createTemplate = async (template: Pick<TemplateMensagem, 'nome' | 'mensagem' | 'midia' | 'padrao'>) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('templates_mensagens')
        .insert({
          ...template,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setTemplates(prev => [...prev, data]);
        toast.success('Template criado com sucesso!');
        logPainel(`Template criado: ${template.nome}`, "success");
        return data;
      }
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error('Erro ao criar template');
    }
    return null;
  };

  const updateTemplate = async (id: string, updates: Partial<Pick<TemplateMensagem, 'nome' | 'mensagem' | 'midia' | 'padrao'>>) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('templates_mensagens')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success('Template atualizado com sucesso!');
      logPainel(`Template atualizado`, "success");
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      toast.error('Erro ao atualizar template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('templates_mensagens')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template excluído com sucesso!');
      logPainel(`Template excluído`, "warning");
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error('Erro ao excluir template');
    }
  };

  const duplicateTemplate = async (template: TemplateMensagem) => {
    await createTemplate({
      nome: `${template.nome} (cópia)`,
      mensagem: template.mensagem,
      midia: template.midia,
      padrao: false,
    });
  };

  const restoreDefaults = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      // Deletar todos os templates do usuário
      const { error: deleteError } = await supabase
        .from('templates_mensagens')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Limpar a lista local
      setTemplates([]);
      toast.success('Templates removidos com sucesso!');
    } catch (error) {
      console.error('Erro ao restaurar templates:', error);
      toast.error('Erro ao restaurar templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTemplates();
    }
  }, [userId, fetchTemplates]);

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    restoreDefaults,
    refetch: fetchTemplates,
  };
};
