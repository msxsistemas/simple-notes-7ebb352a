import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const action = body.action;

      // ── User panel actions (require auth) ──────────────────────────
      if (action === "check" || action === "configure") {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "check") {
          const { data } = await adminClient
            .from("woovi_config")
            .select("is_configured")
            .eq("user_id", user.id)
            .maybeSingle();
          return new Response(JSON.stringify({ configured: !!(data as any)?.is_configured }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "configure") {
          const appId = body.app_id;
          if (!appId) {
            return new Response(JSON.stringify({ error: "app_id é obrigatório" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Store App ID securely in vault
          const { error: vaultError } = await userClient.rpc("store_gateway_secret", {
            p_user_id: user.id,
            p_gateway: "woovi",
            p_secret_name: "app_id",
            p_secret_value: appId,
          });
          if (vaultError) {
            console.error("vault store error:", vaultError.message);
            return new Response(JSON.stringify({ error: vaultError.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Save config record to woovi_config table (same pattern as other gateways)
          const appIdHash = btoa(appId.substring(0, 8) + appId.substring(appId.length - 8));
          const { error: upsertError } = await adminClient
            .from("woovi_config")
            .upsert({
              user_id: user.id,
              app_id_hash: appIdHash,
              is_configured: true,
              webhook_url: `${supabaseUrl}/functions/v1/woovi-integration`,
            }, { onConflict: "user_id" });

          if (upsertError) {
            console.error("woovi_config upsert error:", upsertError.message);
            return new Response(JSON.stringify({ error: upsertError.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ ok: true, configured: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── Webhook handler (from Woovi servers) ──────────────────────
      console.log("Woovi webhook received:", JSON.stringify(body).substring(0, 500));

      const eventType = body.event || body.type || "";
      const charge = body.charge || body.data?.charge || body;
      const correlationID = charge?.correlationID || body.correlationID || null;
      const status = (charge?.status || "").toUpperCase();

      // Woovi sends test webhooks with "evento": "teste_webhook" — always return 200
      if (body.evento === "teste_webhook") {
        console.log("Woovi test webhook received — returning 200 OK");
        return new Response(JSON.stringify({ ok: true, test: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!correlationID || typeof correlationID !== "string" || correlationID.length < 5) {
        console.warn("Woovi webhook: missing or invalid correlationID");
        return new Response(JSON.stringify({ error: "Invalid correlationID" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (correlationID && (["COMPLETED", "PAID", "CONFIRMED"].includes(status) || eventType.includes("COMPLETED") || eventType.includes("PAID"))) {
        console.log(`Woovi payment confirmed for correlationID: ${correlationID}`);

        const nowIso = new Date().toISOString();

        const { data: cobranca } = await adminClient
          .from("cobrancas")
          .select("id, user_id, cliente_whatsapp, status")
          .eq("gateway_charge_id", correlationID)
          .eq("gateway", "woovi")
          .maybeSingle();

        const { data: fatura } = await adminClient
          .from("faturas")
          .select("id, user_id, cliente_whatsapp, status")
          .eq("gateway_charge_id", correlationID)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cobranca && !fatura) {
          console.warn(`Woovi webhook: no matching records found for correlationID: ${correlationID}`);
          return new Response(JSON.stringify({ error: "Unknown charge" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const ownerUserId = cobranca?.user_id || fatura?.user_id;
        const clienteWhatsapp = cobranca?.cliente_whatsapp || fatura?.cliente_whatsapp;

        // Verify the webhook origin by checking the user's Woovi App ID exists
        const { data: wooviConfig } = await adminClient
          .from("woovi_config")
          .select("id")
          .eq("user_id", ownerUserId)
          .eq("is_configured", true)
          .maybeSingle();

        if (!wooviConfig) {
          console.warn(`Woovi webhook: no active woovi config for user ${ownerUserId}`);
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let shouldTriggerAutoRenew = false;

        if (cobranca && cobranca.status !== "pago") {
          const { data: updatedCobranca, error: updateCobrancaError } = await adminClient
            .from("cobrancas")
            .update({ status: "pago", renovado: true, updated_at: nowIso })
            .eq("id", cobranca.id)
            .eq("status", "pendente")
            .select("id")
            .maybeSingle();

          if (updateCobrancaError) {
            console.error(`Woovi webhook: failed to update cobranca ${cobranca.id}: ${updateCobrancaError.message}`);
          } else if (updatedCobranca) {
            shouldTriggerAutoRenew = true;
            console.log(`✅ Cobranca ${cobranca.id} marked as paid (atomic)`);
          }
        }

        if (fatura && fatura.status !== "pago") {
          const { data: updatedFatura, error: updateFaturaError } = await adminClient
            .from("faturas")
            .update({ status: "pago", paid_at: nowIso, updated_at: nowIso })
            .eq("id", fatura.id)
            .eq("status", "pendente")
            .select("id")
            .maybeSingle();

          if (updateFaturaError) {
            console.error(`Woovi webhook: failed to update fatura ${fatura.id}: ${updateFaturaError.message}`);
          } else if (updatedFatura) {
            shouldTriggerAutoRenew = true;
            console.log(`✅ Fatura ${fatura.id} marked as paid via Woovi webhook`);
          }
        }

        if (shouldTriggerAutoRenew && ownerUserId && clienteWhatsapp) {
          fetch(`${supabaseUrl}/functions/v1/auto-renew-client`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: ownerUserId,
              cliente_whatsapp: clienteWhatsapp,
              gateway: "woovi",
              gateway_charge_id: correlationID,
            }),
          }).catch((e: any) => console.error("Auto-renewal trigger error:", e.message));
        } else {
          console.log(`Woovi webhook: charge ${correlationID} already processed`);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Woovi error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // GET requests: Woovi sends a validation ping when registering the webhook
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
