import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, CheckCircle, XCircle, Wallet, RefreshCw, QrCode, Printer, Tag, Loader2, Gift } from "lucide-react";
import QRCode from "react-qr-code";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Fatura {
  id: string;
  cliente_nome: string;
  plano_nome: string | null;
  valor: number;
  valor_original: number | null;
  cupom_codigo: string | null;
  status: string;
  gateway: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  pix_manual_key: string | null;
  paid_at: string | null;
  created_at: string;
  nome_empresa: string | null;
  data_vencimento: string | null;
}

const POLL_INTERVAL = 5000;

export default function FaturaPublica() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ codigo: string; desconto: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  const tryRenewSigmaInBrowser = useCallback(async (faturaId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: faturaData } = await supabase
        .from("faturas")
        .select("id, user_id, cliente_id")
        .eq("id", faturaId)
        .maybeSingle();

      if (!faturaData || faturaData.user_id !== user.id || !faturaData.cliente_id) return;

      const { data: cliente } = await supabase
        .from("clientes")
        .select("id, nome, usuario, produto, acessos_adicionais")
        .eq("id", faturaData.cliente_id)
        .maybeSingle();

      if (!cliente?.usuario || !cliente.produto) return;

      let produto: any = null;
      const { data: produtoById } = await supabase
        .from("produtos")
        .select("id, nome, painel_id, provedor_iptv")
        .eq("id", cliente.produto)
        .maybeSingle();
      produto = produtoById;

      if (!produto) {
        const { data: produtoByNome } = await supabase
          .from("produtos")
          .select("id, nome, painel_id, provedor_iptv")
          .eq("nome", cliente.produto)
          .maybeSingle();
        produto = produtoByNome;
      }

      if (!produto || produto.provedor_iptv !== "sigma") return;

      let painel: any = null;
      if (produto.painel_id) {
        const { data: painelById } = await supabase
          .from("paineis_integracao")
          .select("id, nome, provedor, url, usuario, senha")
          .eq("id", produto.painel_id)
          .maybeSingle();
        painel = painelById;
      }

      if (!painel) {
        const { data: paineisSigma } = await supabase
          .from("paineis_integracao")
          .select("id, nome, provedor, url, usuario, senha")
          .eq("provedor", "sigma")
          .limit(1);
        painel = paineisSigma?.[0];
      }

      if (!painel?.url) return;

      let painelUsuario = painel.usuario;
      let painelSenha = painel.senha;

      if (painelUsuario === "vault" || painelSenha === "vault") {
        const [uRes, sRes] = await Promise.all([
          painelUsuario === "vault"
            ? supabase.rpc("get_gateway_secret", { p_user_id: user.id, p_gateway: "painel", p_secret_name: `usuario_${painel.id}` })
            : Promise.resolve({ data: painelUsuario }),
          painelSenha === "vault"
            ? supabase.rpc("get_gateway_secret", { p_user_id: user.id, p_gateway: "painel", p_secret_name: `senha_${painel.id}` })
            : Promise.resolve({ data: painelSenha }),
        ]);

        if (uRes.data) painelUsuario = uRes.data;
        if (sRes.data) painelSenha = sRes.data;
      }

      if (!painelUsuario || !painelSenha) return;

      const { sigmaLogin, fetchSigmaCustomers, renewSigmaCustomer } = await import("@/utils/sigma-api");
      const token = await sigmaLogin(painel.url, painelUsuario, painelSenha);

      const result = await fetchSigmaCustomers(painel.url, token, 1, cliente.usuario, 5);
      const found = (result.data || []).find((c: any) => c.username === cliente.usuario);
      if (!found) throw new Error(`Cliente \"${cliente.usuario}\" não encontrado no painel Sigma`);

      await renewSigmaCustomer(painel.url, token, found.id, found.package_id, found.connections || 1);

      const acessos = Array.isArray(cliente.acessos_adicionais)
        ? (cliente.acessos_adicionais as any[])
        : [];
      if (acessos.length > 0) {
        for (const acesso of acessos) {
          if (!acesso || typeof acesso !== "object" || !("usuario" in acesso) || !(acesso as any).usuario) continue;
          try {
            const adicResult = await fetchSigmaCustomers(painel.url, token, 1, (acesso as any).usuario, 5);
            const adicFound = (adicResult.data || []).find((c: any) => c.username === (acesso as any).usuario);
            if (adicFound) {
              await renewSigmaCustomer(painel.url, token, adicFound.id, adicFound.package_id, adicFound.connections || 1);
            }
          } catch (adicErr) {
            console.error("Erro ao renovar acesso adicional Sigma:", adicErr);
          }
        }
      }

      toast({
        title: "✅ Painel Sigma renovado",
        description: `Renovação no painel concluída para ${cliente.nome}.`,
      });
    } catch (err: any) {
      console.error("Erro na renovação Sigma via navegador:", err);
      toast({
        title: "⚠️ Falha no painel Sigma",
        description: err?.message || "Pagamento confirmado, mas a renovação no painel Sigma falhou.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchFatura = useCallback(async (isPolling = false) => {
    if (!id) return;
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-fatura`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-fatura", fatura_id: id }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        if (!isPolling) setError(data.error || "Fatura não encontrada");
        return;
      }
      const newFatura = data.fatura as Fatura;

      if (previousStatusRef.current === "pendente" && newFatura.status === "pago") {
        toast({ title: "✅ Pagamento confirmado!", description: "Seu plano será renovado automaticamente." });
        void tryRenewSigmaInBrowser(id);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      previousStatusRef.current = newFatura.status;
      setFatura(newFatura);

      // Initialize coupon state from fatura data
      if (newFatura.cupom_codigo && newFatura.valor_original && !couponApplied) {
        const desconto = (Number(newFatura.valor_original) - Number(newFatura.valor)).toFixed(2);
        setCouponApplied({ codigo: newFatura.cupom_codigo, desconto });
      }
    } catch {
      if (!isPolling) setError("Erro ao carregar fatura");
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [id, toast, couponApplied, tryRenewSigmaInBrowser]);

  useEffect(() => {
    fetchFatura(false);
  }, [fetchFatura]);

  useEffect(() => {
    if (!fatura || fatura.status === "pago") return;
    intervalRef.current = setInterval(() => {
      fetchFatura(true);
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fatura?.status, fetchFatura]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!", description: "Código PIX copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleGeneratePix = useCallback(async () => {
    if (!id) return;
    setGeneratingPix(true);
    try {
      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/generate-fatura`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate-pix", fatura_id: id }),
        }
      );
      const data = await resp.json();
      if (data.success && data.fatura) {
        setFatura(data.fatura as Fatura);
      } else {
        toast({ title: "Erro", description: data.error || "Não foi possível gerar o PIX.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao gerar PIX. Tente novamente.", variant: "destructive" });
    } finally {
      setGeneratingPix(false);
    }
  }, [id, toast]);

  // Always generate a new PIX charge when modal opens (except pix_manual)
  const handleOpenPix = useCallback(() => {
    setShowPix(true);
    if (fatura && fatura.gateway !== "pix_manual") {
      // Always generate a fresh PIX charge
      setGeneratingPix(true);
      setTimeout(() => handleGeneratePix(), 50);
    }
  }, [fatura, handleGeneratePix]);

  const handleApplyCoupon = useCallback(async () => {
    if (!id || !couponCode.trim()) return;
    setCouponError(null);
    setApplyingCoupon(true);
    try {
      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/generate-fatura`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply-coupon", fatura_id: id, codigo: couponCode.trim() }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setCouponError(data.error || "Cupom inválido");
        return;
      }
      setCouponApplied({ codigo: data.cupom_codigo, desconto: data.desconto });
      setFatura(data.fatura as Fatura);
      toast({ title: "✅ Cupom aplicado!", description: `Desconto de R$ ${data.desconto} aplicado à fatura.` });
    } catch {
      setCouponError("Erro ao aplicar cupom. Tente novamente.");
    } finally {
      setApplyingCoupon(false);
    }
  }, [id, couponCode, toast]);

  const handleRemoveCoupon = useCallback(async () => {
    if (!id) return;
    setApplyingCoupon(true);
    try {
      const resp = await fetch(
        `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/generate-fatura`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove-coupon", fatura_id: id }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast({ title: "Erro", description: data.error || "Erro ao remover cupom", variant: "destructive" });
        return;
      }
      setCouponApplied(null);
      setCouponCode("");
      setFatura(data.fatura as Fatura);
      toast({ title: "Cupom removido", description: "O valor original foi restaurado." });
    } catch {
      toast({ title: "Erro", description: "Erro ao remover cupom.", variant: "destructive" });
    } finally {
      setApplyingCoupon(false);
    }
  }, [id, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8edf2]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#3b9ede] border-t-transparent" />
          <p className="text-slate-500 text-sm">Carregando fatura...</p>
        </div>
      </div>
    );
  }

  if (error || !fatura) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8edf2] p-4">
        <div className="max-w-sm w-full bg-white rounded-lg p-8 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Fatura não encontrada</h2>
          <p className="text-sm text-slate-500 mt-2">{error || "O link pode estar expirado ou inválido."}</p>
        </div>
      </div>
    );
  }

  const isPaid = fatura.status === "pago";
  const isPending = fatura.status === "pendente";
  const statusLabel = isPaid ? "PAGO" : "EM ABERTO";
  const hasPix = fatura.pix_qr_code || fatura.pix_copia_cola || (fatura.gateway === "pix_manual" && fatura.pix_manual_key);
  const valorFormatted = Number(fatura.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Show discount info whenever valor_original exists (even if desconto >= valor)
  const hasDiscount = !!(fatura.valor_original && Number(fatura.valor_original) > 0);
  const valorOriginalFormatted = hasDiscount
    ? Number(fatura.valor_original).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  const descontoFormatted = hasDiscount
    ? (Number(fatura.valor_original) - Number(fatura.valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;
  const isReferralDiscount = hasDiscount && !fatura.cupom_codigo;

  return (
    <div className="min-h-screen bg-[#e8edf2] py-6 px-4 sm:py-10 print:bg-white print:py-0">
      <div className="max-w-[620px] mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden relative print:shadow-none">

          {/* Status Ribbon */}
          <div className="absolute top-0 right-0 overflow-hidden w-28 h-28 pointer-events-none z-10">
            <div className={`${isPaid ? "bg-emerald-500" : "bg-red-500"} text-white text-[11px] font-bold tracking-wider text-center py-1.5 w-40 absolute top-[26px] right-[-40px] rotate-45 shadow-md`}>
              {statusLabel}
            </div>
          </div>

          {/* Blue Header */}
          <div className="bg-[#3b9ede] px-6 py-8 text-center border-4 border-[#3b9ede] rounded-t-lg">
            <div className="border-2 border-white/30 rounded-lg py-6 px-4">
              <h1 className="text-white text-3xl font-bold tracking-wide">Fatura</h1>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-8 py-6 space-y-5">

            {/* Cliente Section */}
            <div>
              <p className="text-xs text-slate-400 italic mb-0.5">Cliente</p>
              <p className="text-base font-bold text-slate-800">{fatura.cliente_nome}</p>
            </div>

            <hr className="border-slate-200" />

            {/* Empresa / Fatura Info */}
            <div>
              <p className="text-xs text-slate-400 italic mb-0.5">Empresa</p>
              <p className="text-base font-bold text-red-500">{fatura.nome_empresa || 'Empresa'}</p>
              <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                <p>Vencimento: {(() => {
                  if (fatura.data_vencimento) {
                    try {
                      const d = new Date(fatura.data_vencimento);
                      if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
                    } catch {}
                  }
                  return new Date(fatura.created_at).toLocaleDateString("pt-BR");
                })()}</p>
                <p>Fatura: {fatura.id.slice(0, 10).toUpperCase()}</p>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead>
                  <tr className="bg-[#3b9ede] text-white">
                    <th className="text-left px-3 py-2.5 font-semibold text-xs">Descrição</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-xs">Valor</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-xs">Desconto</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-700 text-sm">{fatura.plano_nome || "Pagamento"}</td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      R$ {hasDiscount ? valorOriginalFormatted : valorFormatted}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {hasDiscount ? (
                        <span className="text-emerald-600 font-medium">- R$ {descontoFormatted}</span>
                      ) : couponApplied ? (
                        <span className="text-emerald-600 font-medium">- R$ {couponApplied.desconto}</span>
                      ) : "R$ 0,00"}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-800">R$ {valorFormatted}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="space-y-1 text-sm">
              {isReferralDiscount && (
                <p className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  Desconto por indicações aplicado: - R$ {descontoFormatted}
                </p>
              )}
              <p className="text-slate-700">
                <strong>Fatura:</strong>{" "}
                <span className={isPaid ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                  {isPaid ? "Pago" : "Em aberto"}
                </span>
              </p>
              {fatura.paid_at && (
                <p className="text-slate-700"><strong>Pago em:</strong> {new Date(fatura.paid_at).toLocaleString("pt-BR")}</p>
              )}
            </div>

            {/* PIX Payment Modal */}
            <Dialog open={showPix} onOpenChange={setShowPix}>
              <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl rounded-xl p-0 overflow-hidden bg-white">
                {/* Modal Title Bar */}
                <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold text-slate-800 uppercase tracking-wide">
                      {fatura.gateway === "pix_manual" ? "PIX Manual" : "PIX Automático"}
                    </DialogTitle>
                  </DialogHeader>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Warning text */}
                  <p className="text-sm text-slate-700 font-semibold text-center">
                    Após confirmar o pagamento, clique no botão Fechar logo abaixo!
                  </p>

                  {/* Gateway badge */}
                  {fatura.gateway && fatura.gateway !== "pix_manual" && (
                    <div className="border border-[#3b9ede] rounded-lg px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Pagamento Seguro</p>
                      <p className="text-base font-bold text-[#3b9ede]">
                        {fatura.gateway === "asaas" ? "Asaas"
                          : fatura.gateway === "mercadopago" ? "Mercado Pago"
                          : fatura.gateway === "ciabra" ? "Ciabra"
                          : fatura.gateway === "v3pay" ? "V3Pay"
                          : fatura.gateway === "woovi" ? "Woovi"
                          : fatura.gateway.toUpperCase()}
                      </p>
                    </div>
                  )}

                  {/* Loading state */}
                  {generatingPix && (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#3b9ede] border-t-transparent" />
                      <p className="text-sm text-slate-500">Gerando código PIX...</p>
                    </div>
                  )}

                  {/* QR Code */}
                  {!generatingPix && (fatura.pix_qr_code || fatura.pix_copia_cola) && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        {fatura.pix_copia_cola ? (
                          <QRCode value={fatura.pix_copia_cola} size={176} />
                        ) : fatura.pix_qr_code?.startsWith('http') ? (
                          <img src={fatura.pix_qr_code} alt="QR Code PIX" className="w-44 h-44" />
                        ) : fatura.pix_qr_code ? (
                          <img src={`data:image/png;base64,${fatura.pix_qr_code}`} alt="QR Code PIX" className="w-44 h-44" />
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Copia e Cola */}
                  {!generatingPix && fatura.pix_copia_cola && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs break-all font-mono text-slate-600 max-h-20 overflow-y-auto">
                        {fatura.pix_copia_cola}
                      </div>
                      <div className="flex justify-center">
                        <Button
                          className={`h-10 text-sm font-semibold rounded-full px-8 ${copied ? "bg-emerald-500 hover:bg-emerald-600" : "bg-[#3b9ede] hover:bg-[#2d8ace]"} text-white`}
                          onClick={() => handleCopy(fatura.pix_copia_cola!)}
                        >
                          {copied ? <><CheckCircle className="h-4 w-4 mr-2" /> Copiado!</> : <><Copy className="h-4 w-4 mr-2" /> PIX Copia e Cola</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PIX Manual */}
                  {!generatingPix && fatura.gateway === "pix_manual" && fatura.pix_manual_key && !fatura.pix_copia_cola && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm break-all font-mono text-slate-700 text-center">
                        {fatura.pix_manual_key}
                      </div>
                      <p className="text-xs text-slate-500 text-center">
                        Envie <strong className="text-[#3b9ede]">R$ {valorFormatted}</strong> para a chave acima
                      </p>
                      <div className="flex justify-center">
                        <Button
                          className={`h-10 text-sm font-semibold rounded-full px-8 ${copied ? "bg-emerald-500 hover:bg-emerald-600" : "bg-[#3b9ede] hover:bg-[#2d8ace]"} text-white`}
                          onClick={() => handleCopy(fatura.pix_manual_key!)}
                        >
                          {copied ? <><CheckCircle className="h-4 w-4 mr-2" /> Copiado!</> : <><Copy className="h-4 w-4 mr-2" /> PIX Copia e Cola</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* No PIX data */}
                  {!generatingPix && !fatura.pix_qr_code && !fatura.pix_copia_cola && !(fatura.gateway === "pix_manual" && fatura.pix_manual_key) && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-sm text-slate-500 text-center">Não foi possível gerar o PIX automaticamente.</p>
                      <Button
                        className="h-10 gap-2 text-sm px-8 bg-[#3b9ede] hover:bg-[#2d8ace] text-white rounded-full"
                        onClick={handleGeneratePix}
                      >
                        <RefreshCw className="h-4 w-4" /> Tentar novamente
                      </Button>
                    </div>
                  )}

                  {/* Polling indicator */}
                  {isPending && !generatingPix && (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Verificando pagamento automaticamente...</span>
                    </div>
                  )}

                  {/* Close button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      className="h-10 rounded-md px-6 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm"
                      onClick={() => setShowPix(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>


            {/* Paid banner */}
            {isPaid && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700 text-sm">Pagamento Confirmado</p>
                  <p className="text-xs text-emerald-600">Seu plano será renovado automaticamente.</p>
                </div>
              </div>
            )}
          </div>

           {/* Footer */}
           <div className="border-t border-slate-200 px-6 sm:px-8 py-6 space-y-4">
             <p className="text-xs text-slate-400 italic text-center">
               Obrigado por escolher nossos serviços! Entre em contato conosco se tiver alguma dúvida.
             </p>

             {/* Coupon Section */}
             {!isPaid && !couponApplied && (
               <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 print:hidden">
                 <div className="flex items-center gap-2">
                   <Tag className="h-4 w-4 text-[#3b9ede]" />
                   <span className="text-sm font-semibold text-slate-700">Cupom de Desconto</span>
                 </div>
                 <div className="flex gap-2">
                   <Input
                     value={couponCode}
                     onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                     placeholder="Digite o código do cupom"
                     className="h-10 text-sm bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 uppercase"
                   />
                   <Button
                     className="h-10 px-5 text-sm bg-[#3b9ede] hover:bg-[#2d8ace] text-white shrink-0"
                     onClick={handleApplyCoupon}
                     disabled={applyingCoupon || !couponCode.trim()}
                   >
                     {applyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                   </Button>
                 </div>
                 {couponError && (
                   <p className="text-xs text-red-500 flex items-center gap-1">
                     <XCircle className="h-3 w-3" /> {couponError}
                   </p>
                 )}
               </div>
             )}

             {/* Coupon Applied Badge */}
              {couponApplied && !isPaid && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between print:hidden">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">
                      Cupom <strong>{couponApplied.codigo}</strong> aplicado — desconto de R$ {couponApplied.desconto}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-3 text-xs"
                    onClick={handleRemoveCoupon}
                    disabled={applyingCoupon}
                  >
                    {applyingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-1" /> Remover</>}
                  </Button>
                </div>
              )}

              {couponApplied && isPaid && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 print:hidden">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-emerald-700 font-medium">
                    Cupom <strong>{couponApplied.codigo}</strong> aplicado — desconto de R$ {couponApplied.desconto}
                  </span>
                </div>
              )}

             {/* Action Buttons */}
              <div className="flex justify-center gap-3 print:hidden pt-2">
                <Button
                  variant="outline"
                  className="h-10 gap-2 text-sm rounded-full px-6"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                
                {!isPaid && (
                  <Button
                     className="h-10 gap-2 text-sm rounded-full px-6 bg-emerald-500 hover:bg-emerald-600 text-white"
                     onClick={handleOpenPix}
                   >
                     <QrCode className="h-4 w-4" />
                     Pagar com PIX
                   </Button>
                 )}

               {isPaid && (
                 <Button
                   disabled
                   className="h-10 gap-2 text-sm rounded-full px-6 bg-emerald-500 text-white"
                 >
                   <CheckCircle className="h-4 w-4" />
                   Pagamento Confirmado
                 </Button>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
