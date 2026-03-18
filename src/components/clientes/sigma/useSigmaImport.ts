import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { sigmaLogin, fetchSigmaCustomers } from "@/utils/sigma-api";
import { useToast } from "@/hooks/use-toast";
import type { SigmaCustomer, PainelIntegracao } from "./types";

const PER_PAGE = 20;

export function useSigmaImport(open: boolean, onImportComplete: () => void, onClose: () => void) {
  const { toast } = useToast();
  const [step, setStep] = useState<'select-panel' | 'loading' | 'select-clients' | 'importing'>('select-panel');
  const [paineis, setPaineis] = useState<PainelIntegracao[]>([]);
  const [selectedPainelId, setSelectedPainelId] = useState("");
  const [customers, setCustomers] = useState<SigmaCustomer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingPaineis, setLoadingPaineis] = useState(false);
  const [importingCount, setImportingCount] = useState(0);
  const [existingUsernames, setExistingUsernames] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    if (!open) {
      setStep('select-panel');
      setSelectedPainelId("");
      setCustomers([]);
      setSelectedIds(new Set());
      setPage(1);
      setExistingUsernames(new Set());
      return;
    }
    loadPaineis();
    loadExistingUsernames();
  }, [open]);

  const loadPaineis = async () => {
    setLoadingPaineis(true);
    const { data } = await supabase
      .from('paineis_integracao')
      .select('id, nome, url, usuario, senha, provedor')
      .eq('provedor', 'sigma')
      .eq('status', 'Ativo');
    setPaineis((data as PainelIntegracao[]) || []);
    setLoadingPaineis(false);
  };

  const loadExistingUsernames = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('usuario')
      .not('usuario', 'is', null);
    if (data) {
      setExistingUsernames(new Set(data.map(c => c.usuario).filter(Boolean)));
    }
  };

  const resolveCredentials = async (painel: PainelIntegracao) => {
    let { usuario, senha } = painel;
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;
    if (currentUserId && (usuario === 'vault' || senha === 'vault')) {
      const [uRes, sRes] = await Promise.all([
        usuario === 'vault'
          ? supabase.rpc('get_gateway_secret', { p_user_id: currentUserId, p_gateway: 'painel', p_secret_name: `usuario_${painel.id}` })
          : { data: usuario },
        senha === 'vault'
          ? supabase.rpc('get_gateway_secret', { p_user_id: currentUserId, p_gateway: 'painel', p_secret_name: `senha_${painel.id}` })
          : { data: senha },
      ]);
      if (uRes.data) usuario = uRes.data;
      if (sRes.data) senha = sRes.data;
    }
    return { usuario, senha };
  };

  const handleLoadClients = async (pageNum = 1, statusOverride?: string) => {
    const painel = paineis.find(p => p.id === selectedPainelId);
    if (!painel) return;

    const filterToUse = statusOverride ?? statusFilter;
    if (statusOverride !== undefined) setStatusFilter(statusOverride);

    setStep('loading');
    try {
      const { usuario, senha } = await resolveCredentials(painel);
      const token = await sigmaLogin(painel.url, usuario, senha);
      const sigmaStatus = filterToUse === 'all' ? '' : 'ACTIVE';
      const result = await fetchSigmaCustomers(painel.url, token, pageNum, '', PER_PAGE, sigmaStatus);

      const normalized: SigmaCustomer[] = (result.data || []).map((c: any) => ({
        id: c.id,
        username: c.username,
        password: c.password,
        name: c.name,
        expires_at: c.expires_at_tz || c.expires_at || undefined,
        status: c.status,
        connections: c.connections,
        package_id: c.package_id,
        package: c.package,
        whatsapp: c.whatsapp,
        email: c.email,
        mac_address: c.mac_address,
        server: c.server,
      }));
      setCustomers(normalized);
      setTotal(result.total);
      setPage(pageNum);
      setStep('select-clients');
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
      setStep('select-panel');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (customers.every(c => selectedIds.has(c.id))) {
      const next = new Set(selectedIds);
      customers.forEach(c => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      customers.forEach(c => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setStep('importing');
    setImportingCount(0);

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      setStep('select-clients');
      return;
    }

    const selected = customers.filter(c => selectedIds.has(c.id));
    const painel = paineis.find(p => p.id === selectedPainelId);

    // Batch insert (chunks of 50)
    let imported = 0;
    let skipped = 0;
    const BATCH = 50;

    for (let i = 0; i < selected.length; i += BATCH) {
      const batch = selected.slice(i, i + BATCH);
      const newClients = batch.filter(c => !existingUsernames.has(c.username));
      skipped += batch.length - newClients.length;

      if (newClients.length > 0) {
        const rows = newClients.map(customer => ({
          nome: customer.name || customer.username,
          whatsapp: customer.whatsapp || '',
          email: customer.email || null,
          usuario: customer.username,
          senha: customer.password || '',
          data_vencimento: customer.expires_at || null,
          telas: customer.connections || 1,
          plano: customer.package || null,
          produto: painel ? painel.nome : null,
          mac: customer.mac_address || null,
          tipo_painel: 'sigma',
          user_id: userId,
          observacao: customer.server ? `Servidor: ${customer.server}` : null,
        }));

        const { data, error } = await supabase.from('clientes').insert(rows).select('id');
        if (!error && data) imported += data.length;
      }
      setImportingCount(Math.min(i + BATCH, selected.length));
    }

    const desc = skipped > 0
      ? `${imported} importados, ${skipped} ignorados (já existem).`
      : `${imported} clientes importados com sucesso.`;

    toast({ title: "Importação concluída", description: desc });
    onImportComplete();
    onClose();
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const allPageSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id));

  return {
    step, setStep,
    paineis, selectedPainelId, setSelectedPainelId,
    customers, selectedIds, page, total, totalPages,
    loadingPaineis, importingCount,
    existingUsernames,
    allPageSelected,
    statusFilter, setStatusFilter,
    handleLoadClients, toggleSelect, toggleAll, handleImport,
  };
}
