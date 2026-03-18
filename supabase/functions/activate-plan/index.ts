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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, plan_id, charge_id, installment_id } = body;

    if (action === "activate") {
      // Get plan details
      const { data: plan, error: planError } = await adminClient
        .from("system_plans")
        .select("*")
        .eq("id", plan_id)
        .eq("ativo", true)
        .maybeSingle();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: "Plano não encontrado ou inativo" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Free plan - activate directly
      if (plan.valor === 0) {
        await activateSubscription(adminClient, user.id, plan);
        return new Response(
          JSON.stringify({ activated: true, message: "Plano gratuito ativado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get active system gateway
      const { data: gateway } = await adminClient
        .from("system_gateways")
        .select("*")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!gateway) {
        // No gateway configured - activate directly (admin manages manually)
        await activateSubscription(adminClient, user.id, plan);
        return new Response(
          JSON.stringify({
            activated: true,
            message: "Plano ativado (sem gateway configurado, pagamento será gerenciado manualmente)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate payment via gateway
      const paymentResult = await generatePayment(adminClient, gateway, plan, user);

      if (paymentResult.error) {
        return new Response(JSON.stringify({ error: paymentResult.error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store pending subscription activation
      const { data: existingSub } = await adminClient
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSub) {
        await adminClient.from("user_subscriptions").update({
          plan_id: plan.id,
          status: "pendente",
          gateway_subscription_id: paymentResult.charge_id,
          updated_at: new Date().toISOString(),
        }).eq("id", existingSub.id);
      } else {
        await adminClient.from("user_subscriptions").insert({
          user_id: user.id,
          plan_id: plan.id,
          status: "pendente",
          gateway_subscription_id: paymentResult.charge_id,
        });
      }
      
      console.log(`📋 Subscription saved with gateway_subscription_id: ${paymentResult.charge_id}`);

      return new Response(
        JSON.stringify({
          payment: {
            pix_qr_code: paymentResult.pix_qr_code,
            pix_copia_cola: paymentResult.pix_copia_cola,
            payment_url: paymentResult.payment_url,
            gateway_charge_id: paymentResult.charge_id,
            installment_id: paymentResult.installment_id,
            gateway: gateway.provedor,
            status: "pending",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-pix") {
      if (!installment_id) {
        return new Response(JSON.stringify({ error: "installment_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: gateway } = await adminClient
        .from("system_gateways")
        .select("*")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!gateway || gateway.provedor?.toLowerCase() !== "ciabra") {
        return new Response(JSON.stringify({ pix_copia_cola: null, pix_qr_code: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const secretKey = gateway.api_key_hash;
      const publicKey = gateway.public_key_hash || "";
      const basicToken = btoa(`${publicKey}:${secretKey}`);
      const pixHeaders = {
        Authorization: `Basic ${basicToken}`,
        "Content-Type": "application/json",
      };

      const payResp = await fetch(`https://api.az.center/payments/applications/installments/${installment_id}`, {
        method: "GET",
        headers: pixHeaders,
      });
      const payText = await payResp.text();
      console.log(`PIX fetch for ${installment_id}: ${payText.substring(0, 500)}`);
      let payData: any = {};
      try { payData = JSON.parse(payText); } catch { /* */ }

      const payment = Array.isArray(payData) ? payData[0] : payData;
      const pixObj = payment?.pix || payment;
      const emv = pixObj?.emv || pixObj?.brCode || pixObj?.pixCode || null;
      const qr = pixObj?.qrCode || null;
      const generating = pixObj?.status === "GENERATING";

      return new Response(JSON.stringify({
        pix_copia_cola: emv,
        pix_qr_code: qr,
        generating,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check-payment") {
      if (!charge_id) {
        return new Response(JSON.stringify({ error: "charge_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check subscription status
      const { data: sub } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("gateway_subscription_id", charge_id)
        .maybeSingle();

      if (sub?.status === "ativa") {
        return new Response(JSON.stringify({ paid: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check payment status on gateway
      const { data: gateway } = await adminClient
        .from("system_gateways")
        .select("*")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (gateway) {
        const paid = await checkPaymentStatus(gateway, charge_id);
        if (paid && sub) {
          // Activate subscription
          const { data: plan } = await adminClient
            .from("system_plans")
            .select("*")
            .eq("id", sub.plan_id)
            .maybeSingle();

          if (plan) {
            await activateSubscription(adminClient, user.id, plan);
          }
          return new Response(JSON.stringify({ paid: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ paid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao processar plano" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function activateSubscription(client: any, userId: string, plan: any) {
  const expiration = calculateExpiration(plan.intervalo);
  const now = new Date().toISOString();
  
  console.log(`🔄 Activating subscription, plan ${plan.id} (${plan.intervalo}), expira_em: ${expiration}`);

  // Check if user has existing subscription
  const { data: existing, error: fetchErr } = await client
    .from("user_subscriptions")
    .select("id, expira_em")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    console.error("❌ Error fetching existing subscription:", fetchErr);
  }

  if (existing) {
    const updatePayload = {
      plan_id: plan.id,
      status: "ativa",
      inicio: now,
      expira_em: expiration,
      updated_at: now,
    };
    console.log(`📝 Updating subscription ${existing.id}, old expira_em: ${existing.expira_em}, new payload:`, JSON.stringify(updatePayload));
    
    const { error: updateErr } = await client
      .from("user_subscriptions")
      .update(updatePayload)
      .eq("id", existing.id);
    
    if (updateErr) {
      console.error("❌ Error updating subscription:", updateErr);
      throw new Error(`Erro ao atualizar assinatura: ${updateErr.message}`);
    }
    console.log(`✅ Subscription ${existing.id} activated successfully, expira_em: ${expiration}`);
  } else {
    const insertPayload = {
      user_id: userId,
      plan_id: plan.id,
      status: "ativa",
      inicio: now,
      expira_em: expiration,
    };
    console.log(`📝 Inserting new subscription:`, JSON.stringify(insertPayload));
    
    const { error: insertErr } = await client.from("user_subscriptions").insert(insertPayload);
    
    if (insertErr) {
      console.error("❌ Error inserting subscription:", insertErr);
      throw new Error(`Erro ao criar assinatura: ${insertErr.message}`);
    }
    console.log(`✅ New subscription created for user ${userId}, expira_em: ${expiration}`);
  }
}

function calculateExpiration(intervalo: string): string {
  const now = new Date();
  switch (intervalo) {
    case "mensal":
      now.setMonth(now.getMonth() + 1);
      break;
    case "trimestral":
      now.setMonth(now.getMonth() + 3);
      break;
    case "semestral":
      now.setMonth(now.getMonth() + 6);
      break;
    case "anual":
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}

async function generatePayment(
  client: any,
  gateway: any,
  plan: any,
  user: any
): Promise<any> {
  try {
    const provedor = gateway.provedor?.toLowerCase();

    if (provedor === "asaas") {
      return await generateAsaasPayment(gateway, plan, user);
    }

    if (provedor === "mercadopago") {
      return await generateMercadoPagoPayment(gateway, plan, user);
    }

    if (provedor === "ciabra") {
      return await generateCiabraPayment(gateway, plan, user);
    }

    if (provedor === "v3pay") {
      return await generateV3PayPayment(gateway, plan, user);
    }

    if (provedor === "woovi") {
      return await generateWooviPayment(gateway, plan, user);
    }

    // Fallback: no specific gateway handler
    return { error: `Gateway "${gateway.provedor}" não suportado para pagamentos de plano` };
  } catch (err: any) {
    console.error("Payment generation error:", err);
    return { error: err.message || "Erro ao gerar pagamento" };
  }
}

async function generateAsaasPayment(gateway: any, plan: any, user: any) {
  const apiKey = gateway.api_key_hash;
  if (!apiKey) return { error: "Gateway Asaas sem API key configurada" };

  const baseUrl = gateway.ambiente === "producao"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  // Find or create customer
  const customerResp = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(user.email)}`, {
    headers: { access_token: apiKey },
  });
  const customerData = await customerResp.json();

  let customerId: string;
  if (customerData.data?.length > 0) {
    customerId = customerData.data[0].id;
  } else {
    const createBody = {
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente",
      email: user.email,
      phone: user.user_metadata?.whatsapp || user.phone || null,
      cpfCnpj: user.user_metadata?.cpf || null,
      notificationDisabled: true,
    };
    console.log("Creating Asaas customer:", JSON.stringify(createBody));
    const createResp = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify(createBody),
    });
    const created = await createResp.json();
    console.log("Asaas customer response:", JSON.stringify(created));
    if (!created.id) return { error: created.errors?.[0]?.description || "Erro ao criar cliente no Asaas: " + JSON.stringify(created) };
    customerId = created.id;
  }

  // Create PIX charge
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const chargeResp = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: plan.valor,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Plano ${plan.nome} - Gestor Msx`,
    }),
  });

  const charge = await chargeResp.json();
  if (!charge.id) return { error: charge.errors?.[0]?.description || "Erro ao criar cobrança" };

  // Get PIX QR Code
  const pixResp = await fetch(`${baseUrl}/payments/${charge.id}/pixQrCode`, {
    headers: { access_token: apiKey },
  });
  const pixData = await pixResp.json();

  return {
    charge_id: charge.id,
    pix_qr_code: pixData.encodedImage,
    pix_copia_cola: pixData.payload,
  };
}

async function generateMercadoPagoPayment(gateway: any, plan: any, user: any) {
  const accessToken = gateway.api_key_hash;
  if (!accessToken) return { error: "Gateway MercadoPago sem access token" };

  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      transaction_amount: plan.valor,
      description: `Plano ${plan.nome} - Gestor Msx`,
      payment_method_id: "pix",
      external_reference: `plan_${plan.id}_${user.id}`,
      payer: { email: user.email },
    }),
  });

  const data = await resp.json();
  if (!data.id) return { error: data.message || "Erro ao criar pagamento" };

  return {
    charge_id: String(data.id),
    pix_qr_code: data.point_of_interaction?.transaction_data?.qr_code_base64,
    pix_copia_cola: data.point_of_interaction?.transaction_data?.qr_code,
  };
}

async function generateCiabraPayment(gateway: any, plan: any, user: any) {
  const secretKey = gateway.api_key_hash;
  const publicKey = gateway.public_key_hash || "";
  if (!secretKey) return { error: "Gateway Ciabra sem chave secreta configurada" };

  const CIABRA_BASE_URL = "https://api.az.center";
  const basicToken = btoa(`${publicKey}:${secretKey}`);
  const headers = {
    Authorization: `Basic ${basicToken}`,
    "Content-Type": "application/json",
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  try {
    // Step 1: Create customer with document (CPF) like generate-fatura does
    const customerName = (user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente").trim();
    const safeName = customerName.length >= 3 ? customerName : customerName.padEnd(3, "_");
    const userPhone = user.user_metadata?.whatsapp || user.phone || "+5500000000000";

    // Generate a valid CPF
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const cpfDigits = Array.from({ length: 9 }, () => rnd(9));
    for (let j = 0; j < 2; j++) {
      const len = cpfDigits.length;
      let sum = 0;
      for (let i = 0; i < len; i++) sum += cpfDigits[i] * (len + 1 - i);
      const rest = sum % 11;
      cpfDigits.push(rest < 2 ? 0 : 11 - rest);
    }
    const cpfFormatted = cpfDigits.join("").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    let customerId = "";
    try {
      const customerResp = await fetch(`${CIABRA_BASE_URL}/invoices/applications/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ fullName: safeName, phone: userPhone, document: cpfFormatted }),
      });
      const custText = await customerResp.text();
      console.log("Ciabra customer response:", customerResp.status, custText.substring(0, 300));
      try { customerId = String(JSON.parse(custText).id || ""); } catch { /* */ }
    } catch (e: any) {
      console.error("Ciabra customer error:", e.message);
    }

    if (!customerId) {
      return { error: "Erro ao criar cliente na Ciabra" };
    }

    // Step 2: Create invoice with same structure as generate-fatura (including webhooks, notifications, externalId)
    const webhookUrl = `${supabaseUrl}/functions/v1/ciabra-integration`;
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const priceVal = parseFloat(String(plan.valor));
    const externalId = `plan-${plan.id.substring(0, 8)}-${Date.now()}`;

    const invoicePayload: any = {
      description: `Plano ${plan.nome} - Gestor Msx`,
      dueDate,
      installmentCount: 1,
      invoiceType: "SINGLE",
      items: [],
      price: priceVal,
      externalId,
      paymentTypes: ["PIX"],
      customerId,
      webhooks: [
        { hookType: "INVOICE_CREATED", url: webhookUrl },
        { hookType: "PAYMENT_GENERATED", url: webhookUrl },
        { hookType: "PAYMENT_CONFIRMED", url: webhookUrl },
      ],
      notifications: [],
    };

    console.log("Ciabra invoice payload:", JSON.stringify(invoicePayload));
    const chargeResp = await fetch(`${CIABRA_BASE_URL}/invoices/applications/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoicePayload),
    });

    const chargeText = await chargeResp.text();
    let chargeData: any = {};
    try { chargeData = JSON.parse(chargeText); } catch { /* */ }
    console.log("Ciabra invoice response:", chargeResp.status, chargeText.substring(0, 500));

    if (!chargeResp.ok) {
      return { error: chargeData.message || chargeData.error || `Erro Ciabra (${chargeResp.status}): ${chargeText}` };
    }

    const chargeId = String(chargeData.id || "");
    const paymentUrl = chargeData.url || null;
    const installmentId = chargeData.installments?.[0]?.id || null;

    return {
      charge_id: chargeId,
      pix_qr_code: null,
      pix_copia_cola: null,
      payment_url: paymentUrl,
      installment_id: installmentId,
    };
  } catch (err: any) {
    console.error("Ciabra payment error:", err);
    return { error: err.message || "Erro ao criar pagamento Ciabra" };
  }
}

async function generateV3PayPayment(gateway: any, plan: any, user: any) {
  const apiToken = gateway.api_key_hash;
  if (!apiToken) return { error: "Gateway V3Pay sem token configurado" };

  try {
    const resp = await fetch("https://api.v3pay.com.br/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        amount: Math.round(plan.valor * 100),
        description: `Plano ${plan.nome} - Gestor Msx`,
        payment_method: "pix",
        payer: { email: user.email },
      }),
    });

    const data = await resp.json();
    if (!data.id) return { error: data.message || "Erro ao criar pagamento V3Pay" };

    return {
      charge_id: String(data.id),
      pix_qr_code: data.pix?.qr_code_base64 || data.qr_code_base64 || null,
      pix_copia_cola: data.pix?.qr_code || data.pix_copia_cola || null,
    };
  } catch (err: any) {
    return { error: err.message || "Erro ao criar pagamento V3Pay" };
  }
}

async function generateWooviPayment(gateway: any, plan: any, user: any) {
  const appId = gateway.api_key_hash;
  if (!appId) return { error: "Gateway Woovi sem App ID configurado" };

  const baseUrl = "https://api.openpix.com.br";

  try {
    const correlationID = `plan-${plan.id.substring(0, 8)}-${Date.now()}`;
    const valorCentavos = Math.round(plan.valor * 100);

    const resp = await fetch(`${baseUrl}/api/openpix/v1/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: appId,
      },
      body: JSON.stringify({
        correlationID,
        value: valorCentavos,
        comment: `Plano ${plan.nome} - Gestor Msx`,
      }),
    });

    const data = await resp.json();
    console.log("Woovi charge response:", JSON.stringify(data).substring(0, 500));
    const charge = data.charge || data;

    if (!charge?.correlationID && !data.brCode) {
      return { error: data.error || data.message || "Erro ao criar cobrança Woovi" };
    }

    const chargeId = charge.correlationID || correlationID;
    const brCode = charge.brCode || data.brCode || null;
    const qrCodeImage = charge.qrCodeImage || null;
    const paymentLinkUrl = charge.paymentLinkUrl || null;

    return {
      charge_id: chargeId,
      pix_qr_code: qrCodeImage,
      pix_copia_cola: brCode,
      payment_url: paymentLinkUrl,
    };
  } catch (err: any) {
    console.error("Woovi payment error:", err);
    return { error: err.message || "Erro ao criar pagamento Woovi" };
  }
}

async function checkPaymentStatus(gateway: any, chargeId: string): Promise<boolean> {
  try {
    const provedor = gateway.provedor?.toLowerCase();

    if (provedor === "asaas") {
      const baseUrl = gateway.ambiente === "producao"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

      const resp = await fetch(`${baseUrl}/payments/${chargeId}`, {
        headers: { access_token: gateway.api_key_hash },
      });
      const data = await resp.json();
      return ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(data.status);
    }

    if (provedor === "mercadopago") {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${chargeId}`, {
        headers: { Authorization: `Bearer ${gateway.api_key_hash}` },
      });
      const data = await resp.json();
      return data.status === "approved";
    }

    if (provedor === "ciabra") {
      const secretKey = gateway.api_key_hash;
      const publicKey = gateway.public_key_hash || "";
      const basicToken = btoa(`${publicKey}:${secretKey}`);

      const resp = await fetch(`https://api.az.center/invoices/applications/invoices/${chargeId}`, {
        headers: { Authorization: `Basic ${basicToken}` },
      });
      const data = await resp.json();
      console.log("Ciabra check-payment full response:", JSON.stringify(data).substring(0, 2000));
      const status = (data.status || data._status || "").toUpperCase();
      if (["PAID", "CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "COMPLETED"].includes(status)) return true;
      // Check installments - Ciabra uses _status field and also paidAt
      const installments = data.installments || [];
      for (const inst of installments) {
        const instStatus = (inst._status || inst.status || "").toUpperCase();
        if (["PAID", "CONFIRMED", "PAYMENT_CONFIRMED", "COMPLETED"].includes(instStatus)) return true;
        // Also check if paidAt or paymentReceivedAt is set
        if (inst.paidAt || inst.paymentReceivedAt) return true;
      }
      return false;
    }

    if (provedor === "v3pay") {
      const resp = await fetch(`https://api.v3pay.com.br/v1/payments/${chargeId}`, {
        headers: { Authorization: `Bearer ${gateway.api_key_hash}` },
      });
      const data = await resp.json();
      return data.status === "approved" || data.status === "paid";
    }

    if (provedor === "woovi") {
      const resp = await fetch(`https://api.openpix.com.br/api/openpix/v1/charge/${chargeId}`, {
        headers: { Authorization: gateway.api_key_hash },
      });
      const data = await resp.json();
      const charge = data.charge || data;
      const status = (charge?.status || "").toUpperCase();
      return ["COMPLETED", "PAID", "CONFIRMED"].includes(status);
    }

    return false;
  } catch {
    return false;
  }
}
