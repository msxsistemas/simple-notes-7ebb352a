import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeRefPrefix(code: string) {
  // REF_xxx... where xxx is the start of uuid without hyphens
  return code.slice(4).replace(/[^0-9a-f]/gi, "").toLowerCase();
}

async function findUserIdByRefPrefix(admin: any, prefix: string): Promise<string | null> {
  // Fallback approach: list users (up to 1000) and match prefix on UUID without hyphens.
  // This avoids relying on SQL casts/expressions in PostgREST.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const users = data?.users || [];
  const hit = users.find((u: any) =>
    String(u.id || "")
      .replace(/-/g, "")
      .toLowerCase()
      .startsWith(prefix)
  );
  return hit?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autorizado" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ success: false, error: "Usuário não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const refCodeRaw = String(user.user_metadata?.referral_code ?? "").trim();
    if (!refCodeRaw) {
      return json({ success: true, processed: false, reason: "no_referral_code" });
    }

    const refCodeUpper = refCodeRaw.toUpperCase();
    const userName = String(user.user_metadata?.full_name ?? "").trim();
    const userEmail = String(user.email ?? "").trim();

    // ------------------------------
    // REF_ codes (system referrals) => indicacoes + potential N3
    // ------------------------------
    if (refCodeUpper.startsWith("REF_")) {
      const prefix = normalizeRefPrefix(refCodeRaw);
      if (prefix.length < 6) {
        return json({ success: true, processed: false, reason: "invalid_ref_prefix" });
      }

      const refUserId = await findUserIdByRefPrefix(adminClient, prefix);
      if (!refUserId || refUserId === user.id) {
        return json({ success: true, processed: false, reason: "ref_user_not_found" });
      }

      // Get bonus config (public table)
      const { data: cfg, error: cfgErr } = await adminClient
        .from("system_indicacoes_config")
        .select("valor_bonus")
        .eq("id", 1)
        .maybeSingle();
      if (cfgErr) throw cfgErr;
      const bonus = Number(cfg?.valor_bonus ?? 0);

      // Idempotent insert into indicacoes
      const { data: existingIndic, error: existIndicErr } = await adminClient
        .from("indicacoes")
        .select("id")
        .eq("user_id", refUserId)
        .eq("codigo_indicacao", refCodeRaw)
        .eq("indicado_email", userEmail)
        .limit(1)
        .maybeSingle();
      if (existIndicErr) throw existIndicErr;

      if (!existingIndic) {
        const { error: insertIndicErr } = await adminClient.from("indicacoes").insert({
          user_id: refUserId,
          codigo_indicacao: refCodeRaw,
          bonus,
          status: "pendente",
          indicado_nome: userName,
          indicado_email: userEmail,
        });
        if (insertIndicErr) throw insertIndicErr;
      }

      // If referrer is N2, create N3 under N1 owner
      const { data: parent, error: parentErr } = await adminClient
        .from("afiliados_rede")
        .select("*")
        .eq("afiliado_user_id", refUserId)
        .eq("nivel", 2)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (parentErr) throw parentErr;

      if (!parent) {
        return json({ success: true, processed: true, reason: "ref_not_n2" });
      }

      // Avoid duplicates: ensure the new user isn't already in the network
      const { data: existingAr, error: existArErr } = await adminClient
        .from("afiliados_rede")
        .select("id")
        .eq("user_id", parent.user_id)
        .eq("afiliado_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (existArErr) throw existArErr;

      if (!existingAr) {
        const { data: n3cfg, error: n3cfgErr } = await adminClient
          .from("afiliados_niveis_config")
          .select("n3_valor")
          .eq("id", 1)
          .maybeSingle();
        if (n3cfgErr) throw n3cfgErr;
        const n3Max = Number(n3cfg?.n3_valor ?? parent.comissao_valor);

        const comissaoValor = Math.min(Number(parent.comissao_valor), Number(n3Max));

        const { error: insertArErr } = await adminClient.from("afiliados_rede").insert({
          user_id: parent.user_id,
          afiliado_user_id: user.id,
          afiliado_nome: userName,
          afiliado_email: userEmail,
          pai_id: parent.id,
          nivel: 3,
          codigo_convite: `AFF_${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
          comissao_tipo: parent.comissao_tipo,
          comissao_valor: comissaoValor,
          comissao_recorrente: false,
          ativo: true,
        });
        if (insertArErr) throw insertArErr;
      }

      return json({ success: true, processed: true, reason: "ref_n3_done" });
    }

    // ------------------------------
    // AFF_ codes (affiliate onboarding)
    // ------------------------------
    // 1) Direct owner code => create N2
    const { data: ownerCfg, error: ownerErr } = await adminClient
      .from("afiliados_usuarios_config")
      .select("user_id, comissao_tipo, comissao_valor")
      .eq("codigo_convite", refCodeRaw)
      .eq("afiliados_liberado", true)
      .limit(1)
      .maybeSingle();
    if (ownerErr) throw ownerErr;

    if (ownerCfg?.user_id) {
      const { data: existingAr, error: existArErr } = await adminClient
        .from("afiliados_rede")
        .select("id")
        .eq("user_id", ownerCfg.user_id)
        .eq("afiliado_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (existArErr) throw existArErr;

      if (!existingAr) {
        const { error: insertArErr } = await adminClient.from("afiliados_rede").insert({
          user_id: ownerCfg.user_id,
          afiliado_user_id: user.id,
          afiliado_nome: userName,
          afiliado_email: userEmail,
          pai_id: null,
          nivel: 2,
          codigo_convite: `AFF_${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
          comissao_tipo: ownerCfg.comissao_tipo,
          comissao_valor: Number(ownerCfg.comissao_valor ?? 0),
          comissao_recorrente: false,
          ativo: true,
        });
        if (insertArErr) throw insertArErr;
      }

      return json({ success: true, processed: true, reason: "aff_n2_done" });
    }

    // 2) N2 invite code => create N3
    const { data: parent, error: parentErr } = await adminClient
      .from("afiliados_rede")
      .select("*")
      .eq("codigo_convite", refCodeRaw)
      .eq("nivel", 2)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (parentErr) throw parentErr;

    if (!parent) {
      return json({ success: true, processed: false, reason: "aff_code_not_found" });
    }

    const { data: existingAr, error: existArErr } = await adminClient
      .from("afiliados_rede")
      .select("id")
      .eq("user_id", parent.user_id)
      .eq("afiliado_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (existArErr) throw existArErr;

    if (!existingAr) {
      const { data: n3cfg, error: n3cfgErr } = await adminClient
        .from("afiliados_niveis_config")
        .select("n3_valor")
        .eq("id", 1)
        .maybeSingle();
      if (n3cfgErr) throw n3cfgErr;
      const n3Max = Number(n3cfg?.n3_valor ?? parent.comissao_valor);

      const comissaoValor = Math.min(Number(parent.comissao_valor), Number(n3Max));

      const { error: insertArErr } = await adminClient.from("afiliados_rede").insert({
        user_id: parent.user_id,
        afiliado_user_id: user.id,
        afiliado_nome: userName,
        afiliado_email: userEmail,
        pai_id: parent.id,
        nivel: 3,
        codigo_convite: `AFF_${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
        comissao_tipo: parent.comissao_tipo,
        comissao_valor: comissaoValor,
        comissao_recorrente: false,
        ativo: true,
      });
      if (insertArErr) throw insertArErr;
    }

    return json({ success: true, processed: true, reason: "aff_n3_done" });
  } catch (err: any) {
    console.error("process-signup-referral error:", err);
    return json({ success: false, error: err?.message || "Erro interno" }, 500);
  }
});
