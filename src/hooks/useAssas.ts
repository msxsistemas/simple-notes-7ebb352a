import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AsaasCustomer {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

interface AsaasCharge {
  customer: AsaasCustomer;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';
  value: number;
  dueDate?: string;
  description?: string;
}

interface AsaasChargeResponse {
  id: string;
  status: string;
  value: number;
  dueDate?: string;
  description?: string;
  invoiceUrl?: string;
  customer?: AsaasCustomer;
}

// Função para criar hash simples da API key (para verificação)
const createApiKeyHash = (apiKey: string): string => {
  return btoa(apiKey.substring(0, 10) + apiKey.substring(apiKey.length - 10));
};

export const useAssas = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [charges, setCharges] = useState<AsaasChargeResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar configuração salva do banco
  const loadSavedConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('asaas_config')
        .select('*')
        .eq('is_configured', true)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar configuração:', error);
        return;
      }

      if (data) {
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  }, []);

  // Carregar configuração salva ao inicializar
  useEffect(() => {
    loadSavedConfig();
  }, [loadSavedConfig]);

  // Salvar configuração no banco
  const saveConfig = useCallback(async (apiKey: string, webhookUrl?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const apiKeyHash = createApiKeyHash(apiKey);

      // Verificar se já existe uma configuração
      const { data: existing } = await supabase
        .from('asaas_config')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('asaas_config')
          .update({
            api_key_hash: apiKeyHash,
            webhook_url: webhookUrl || null,
            is_configured: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await supabase
          .from('asaas_config')
          .insert({
            user_id: user.id,
            api_key_hash: apiKeyHash,
            webhook_url: webhookUrl || null,
            is_configured: true
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw error;
    }
  }, []);

  // Configurar Asaas
  const configureAsaas = useCallback(async (apiKey: string, webhookUrl?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'configure',
          apiKey,
          webhookUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Salvar configuração no banco
        await saveConfig(apiKey, webhookUrl);
        setIsConfigured(true);
        toast.success('Asaas configurado com sucesso!');
        return true;
      } else {
        throw new Error(data?.error || 'Erro ao configurar Asaas');
      }
    } catch (error: any) {
      console.error('Erro ao configurar Asaas:', error);
      toast.error(`Erro ao configurar Asaas: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [saveConfig]);

  // Criar cobrança
  const createCharge = useCallback(async (chargeData: AsaasCharge) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'create-charge',
          ...chargeData
        }
      });

      if (error) throw error;

      if (data?.success) {
        const newCharge = data.charge;
        setCharges(prev => [newCharge, ...prev]);
        return newCharge;
      } else {
        throw new Error(data?.error || 'Erro ao criar cobrança');
      }
    } catch (error: any) {
      console.error('Erro ao criar cobrança:', error);
      toast.error(`Erro ao criar cobrança: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar cobranças
  const getCharges = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'get-charges'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setCharges(data.charges || []);
        return data.charges;
      } else {
        throw new Error(data?.error || 'Erro ao buscar cobranças');
      }
    } catch (error: any) {
      console.error('Erro ao buscar cobranças:', error);
      // Não mostrar toast de erro para busca, apenas log
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar status de uma cobrança específica
  const getChargeStatus = useCallback(async (chargeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'get-charge-status',
          chargeId
        }
      });

      if (error) throw error;

      if (data?.success) {
        return data.charge;
      } else {
        throw new Error(data?.error || 'Erro ao buscar status da cobrança');
      }
    } catch (error: any) {
      console.error('Erro ao buscar status da cobrança:', error);
      toast.error(`Erro ao buscar status: ${error.message}`);
      throw error;
    }
  }, []);

  // Cancelar cobrança
  const cancelCharge = useCallback(async (chargeId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'cancel-charge',
          chargeId
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Atualizar lista de cobranças
        setCharges(prev => prev.map(charge => 
          charge.id === chargeId 
            ? { ...charge, status: 'DELETED' }
            : charge
        ));
        toast.success('Cobrança cancelada com sucesso!');
        return true;
      } else {
        throw new Error(data?.error || 'Erro ao cancelar cobrança');
      }
    } catch (error: any) {
      console.error('Erro ao cancelar cobrança:', error);
      toast.error(`Erro ao cancelar cobrança: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isConfigured,
    charges,
    loading,
    configureAsaas,
    createCharge,
    getCharges,
    getChargeStatus,
    cancelCharge,
    loadSavedConfig
  };
};