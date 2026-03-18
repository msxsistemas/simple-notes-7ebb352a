import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function replaceTemplateVariables(
  template: string,
  clientData: Record<string, string>,
): string {
  if (!template) return '';

  const nomeCompleto = clientData.nome || '';
  const partes = nomeCompleto.trim().split(' ');
  const primeiroNome = partes[0] || '';
  const sobrenome = partes.length > 1 ? partes.slice(1).join(' ') : '';

  let vencimentoFormatado = '';
  if (clientData.data_vencimento) {
    try {
      // Remove time portion if present (e.g. "2026-03-02T23:59:59.999" -> "2026-03-02")
      const dateOnly = clientData.data_vencimento.split('T')[0];
      const parts = dateOnly.split('-');
      if (parts.length === 3) {
        vencimentoFormatado = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        vencimentoFormatado = clientData.data_vencimento;
      }
    } catch {
      vencimentoFormatado = clientData.data_vencimento;
    }
  }

  // Use Brazil timezone for greeting
  const brTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = brTime.getHours();
  const saudacao = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Calculate total (valor_plano - desconto)
  let totalValue = '';
  if (clientData.valor_plano) {
    const valorNum = parseFloat(clientData.valor_plano.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const descontoNum = parseFloat((clientData.desconto || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const total = Math.max(0, valorNum - descontoNum);
    totalValue = `R$ ${total.toFixed(2).replace('.', ',')}`;
  }

  // Format data_venc_app
  let dataVencAppFormatado = '';
  if (clientData.data_venc_app) {
    try {
      const dateOnly = clientData.data_venc_app.split('T')[0];
      const parts = dateOnly.split('-');
      if (parts.length === 3) {
        dataVencAppFormatado = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        dataVencAppFormatado = clientData.data_venc_app;
      }
    } catch {
      dataVencAppFormatado = clientData.data_venc_app;
    }
  }

  // Format aniversario
  let aniversarioFormatado = clientData.aniversario || '';

  const replacements: Record<string, string> = {
    '{saudacao}': saudacao,
    '{nome_cliente}': nomeCompleto,
    '{nome}': primeiroNome,
    '{cliente}': nomeCompleto,
    '{sobrenome}': sobrenome,
    '{whatsapp}': clientData.whatsapp || '',
    '{email}': clientData.email || '',
    '{usuario}': clientData.usuario || '',
    '{senha}': clientData.senha || '',
    '{vencimento}': vencimentoFormatado,
    '{data_vencimento}': vencimentoFormatado,
    '{data_venc_app}': dataVencAppFormatado,
    '{nome_plano}': clientData.plano_nome || '',
    '{plano}': clientData.plano_nome || '',
    '{valor_plano}': clientData.valor_plano || '',
    '{valor}': clientData.valor_plano || '',
    '{desconto}': clientData.desconto || '',
    '{total}': totalValue,
    '{obs}': clientData.observacao || '',
    '{app}': clientData.app || '',
    '{dispositivo}': clientData.dispositivo || '',
    '{telas}': clientData.telas || '',
    '{mac}': clientData.mac || '',
    '{pix}': clientData.pix || '',
    '{link_fatura}': clientData.link_fatura || '',
    '{fatura_pdf}': clientData.fatura_pdf || '',
    '{nome_empresa}': clientData.nome_empresa || '',
    '{produto}': clientData.produto || '',
    '{aniversario}': aniversarioFormatado,
    '{codigo_indicacao}': clientData.codigo_indicacao || '',
    '{valor_indicacao}': clientData.valor_indicacao || '',
    '{nome_cliente_indicado}': clientData.nome_cliente_indicado || '',
    '{ciclo}': clientData.ciclo || '',
    '{min_indicacoes}': clientData.min_indicacoes || '',
    '{valor_desconto_indicacao}': clientData.valor_desconto_indicacao || '',
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  result = result.replace(/{br}/g, '\n');
  return result;
}

async function sendNotification(
  supabase: any,
  evolutionUrl: string,
  evolutionKey: string,
  sessionId: string,
  userId: string,
  cliente: any,
  templateMsg: string,
  tipoNotificacao: string,
  planosMap: Map<string, any>,
  extraData: Record<string, string>,
): Promise<'sent' | 'error' | 'skipped'> {
  // Use Brazil timezone for dedup check
  const brTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const todayStart = new Date(brTodayStr + 'T00:00:00-03:00');
  const todayEnd = new Date(brTodayStr + 'T23:59:59-03:00');

  // Insert a placeholder FIRST to act as a lock against concurrent calls
  // Use a unique combo: user_id + cliente_id + session_id + today
  const clienteId = cliente.id || cliente.whatsapp;
  const lockSessionId = `auto_${tipoNotificacao}_${clienteId}`;
  const { data: inserted, error: insertErr } = await supabase
    .from('whatsapp_messages')
    .insert({
      user_id: userId,
      phone: cliente.whatsapp,
      message: '__lock__',
      session_id: lockSessionId,
      status: 'pending',
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) {
    // Check if a record already exists for today (race condition guard)
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', cliente.whatsapp)
      .eq('session_id', lockSessionId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .limit(1);

    if (existing && existing.length > 0) return 'skipped';
    // If insert failed for other reasons, skip
    console.error(`Insert lock error for ${cliente.whatsapp}:`, insertErr.message);
    return 'error';
  }

  // Now check if another record already existed BEFORE ours
  const { data: allToday } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', cliente.whatsapp)
    .eq('session_id', lockSessionId)
    .gte('created_at', todayStart.toISOString())
    .lte('created_at', todayEnd.toISOString())
    .order('created_at', { ascending: true });

  // If our record is NOT the first one, it's a duplicate — delete it and skip
  if (allToday && allToday.length > 1 && allToday[0].id !== inserted.id) {
    await supabase.from('whatsapp_messages').delete().eq('id', inserted.id);
    return 'skipped';
  }

  const plano = cliente.plano ? planosMap.get(cliente.plano) : null;
  const planoNome = (plano as any)?.nome || cliente.plano || '';
  const valorPlano = (plano as any)?.valor || '';

  // Auto-create fatura for billing notifications (proximo_vencer, vence_hoje, vencido)
  let linkFatura = '';
  let faturaPdf = '';
  let fatura: { id: string; status?: string } | null = null;

  const isBillingNotification = ['proximo_vencer', 'vence_hoje', 'vencido'].includes(tipoNotificacao);

  // Check for existing pending/aberta fatura first
  if (cliente.id) {
    const { data: byClientId } = await supabase
      .from('faturas')
      .select('id, status')
      .eq('cliente_id', cliente.id)
      .eq('user_id', userId)
      .in('status', ['pendente', 'aberta'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    fatura = byClientId ?? null;
  }

  // Removed fallback by cliente_whatsapp to avoid mixing up clients with same number

  // If no pending fatura exists and it's a billing notification, create one
  if (!fatura && isBillingNotification) {
    const plano = cliente.plano ? planosMap.get(cliente.plano) : null;
    const valorStr = (plano as any)?.valor || '0';
    const valorNum = parseFloat(String(valorStr).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const descontoNum = parseFloat((cliente.desconto || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const valorFinal = Math.max(0, valorNum - descontoNum);

    if (valorFinal > 0) {
      const { data: novaFatura, error: createErr } = await supabase
        .from('faturas')
        .insert({
          user_id: userId,
          cliente_id: cliente.id || null,
          cliente_nome: cliente.nome,
          cliente_whatsapp: cliente.whatsapp,
          valor: valorFinal,
          valor_original: valorNum,
          plano_nome: (plano as any)?.nome || cliente.plano || '',
          status: 'pendente',
          pix_manual_key: extraData.pix || null,
        })
        .select('id, status')
        .single();

      if (createErr) {
        console.error(`❌ Error creating fatura for ${cliente.nome}: ${createErr.message}`);
      } else if (novaFatura) {
        fatura = novaFatura;
        console.log(`🧾 Fatura created for ${cliente.nome}: ${novaFatura.id} (R$ ${valorFinal.toFixed(2)})`);
      }
    } else {
      console.log(`⚠️ Skipping fatura creation for ${cliente.nome}: valor is 0`);
    }
  }

  // If still no fatura, try to get the most recent one regardless of status
  if (!fatura) {
    if (cliente.id) {
      const { data: anyFatura } = await supabase
        .from('faturas')
        .select('id, status')
        .eq('cliente_id', cliente.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      fatura = anyFatura ?? null;
    }
    // Removed fallback by cliente_whatsapp to avoid mixing up clients with same number
  }

  if (fatura?.id) {
    linkFatura = `https://gestormsx.pro/fatura/${fatura.id}`;
    faturaPdf = `https://gestormsx.pro/fatura/${fatura.id}`;
    console.log(`🔗 Fatura for ${cliente.nome}: ${fatura.id} (status: ${fatura.status ?? 'n/a'})`);
  } else {
    console.log(`⚠️ No fatura for ${cliente.nome}`);
  }

  const message = replaceTemplateVariables(templateMsg, {
    nome: cliente.nome || '',
    whatsapp: cliente.whatsapp || '',
    email: cliente.email || '',
    usuario: cliente.usuario || '',
    senha: cliente.senha || '',
    data_vencimento: cliente.data_vencimento || '',
    data_venc_app: cliente.data_venc_app || '',
    plano_nome: planoNome,
    valor_plano: valorPlano ? `R$ ${valorPlano}` : '',
    desconto: cliente.desconto || '',
    observacao: cliente.observacao || '',
    app: cliente.app || '',
    dispositivo: cliente.dispositivo || '',
    telas: cliente.telas?.toString() || '',
    mac: cliente.mac || '',
    produto: cliente.produto || '',
    aniversario: cliente.aniversario || '',
    pix: extraData.pix || '',
    nome_empresa: extraData.nome_empresa || '',
    link_fatura: linkFatura,
    fatura_pdf: faturaPdf,
    codigo_indicacao: '',
    valor_indicacao: '',
    nome_cliente_indicado: '',
    ciclo: '',
    min_indicacoes: '',
    valor_desconto_indicacao: '',
  });

  try {
    const phone = cliente.whatsapp.replace(/\D/g, '');
    const normalizedPhone = !phone.startsWith('55') && phone.length >= 10 ? '55' + phone : phone;

    const sendResp = await fetch(`${evolutionUrl}/message/sendText/${sessionId}`, {
      method: 'POST',
      headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: normalizedPhone, text: message, linkPreview: false }),
    });

    const status = sendResp.ok ? 'sent' : 'failed';

    // Update the lock record with actual message and status
    await supabase.from('whatsapp_messages')
      .update({ message, status, sent_at: new Date().toISOString() })
      .eq('id', inserted.id);

    if (sendResp.ok) {
      console.log(`✅ [${tipoNotificacao}] Sent to ${cliente.nome} (${normalizedPhone})`);
      return 'sent';
    } else {
      const errText = await sendResp.text().catch(() => 'unknown');
      console.error(`❌ [${tipoNotificacao}] Failed for ${cliente.nome}: ${sendResp.status} - ${errText}`);
      return 'error';
    }
  } catch (sendErr: any) {
    console.error(`❌ Send error for ${cliente.nome}:`, sendErr.message);

    await supabase.from('whatsapp_messages')
      .update({ message, status: 'failed', error_message: sendErr.message })
      .eq('id', inserted.id);

    return 'error';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!evolutionUrl || !evolutionKey) {
      console.log('⚠️ Evolution API not configured, skipping auto-notify');
      return new Response(JSON.stringify({ message: 'Evolution API not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all users who have mensagens_padroes configured
    const { data: allMensagens, error: msgErr } = await supabase
      .from('mensagens_padroes')
      .select('user_id, vencido, vence_hoje, proximo_vencer, fatura_criada, aniversario_cliente, confirmacao_pagamento');

    if (msgErr) throw msgErr;
    if (!allMensagens || allMensagens.length === 0) {
      console.log('No mensagens_padroes configured for any user');
      return new Response(JSON.stringify({ message: 'No templates configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use Brazil timezone for date comparisons
    const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
    const hoje = new Date(hojeStr + 'T00:00:00');

    let totalSent = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    // Current time in Brazil
    const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const brHour = brNow.getHours();
    const brMinute = brNow.getMinutes();

    for (const msg of allMensagens) {
      if (!msg.user_id) continue;
      const userId = msg.user_id;

      // Load user's notification config
      const { data: notifConfig } = await supabase
        .from('notificacoes_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Check if current time matches the user's configured notification hour
      // hora_notificacoes is stored as "HH:MM" (e.g. "08:00")
      const horaConfig = notifConfig?.hora_notificacoes ?? '08:00';
      const [configHour, configMinute] = horaConfig.split(':').map(Number);
      
      // Allow a 30-minute window to account for cron timing variations
      const configTotalMin = configHour * 60 + (configMinute || 0);
      const currentTotalMin = brHour * 60 + brMinute;
      const diffMin = currentTotalMin - configTotalMin;
      
      if (diffMin < 0 || diffMin >= 30) {
        console.log(`User ${userId}: not in notification window (configured ${horaConfig}, current ${brHour}:${brMinute.toString().padStart(2, '0')}), skipping`);
        continue;
      }

      console.log(`User ${userId}: within notification window (configured ${horaConfig}), processing...`);

      const diasProximoVencer = notifConfig?.dias_proximo_vencer ?? 3;
      const diasAposVencimento = notifConfig?.dias_apos_vencimento ?? 2;
      const notifVencendoHoje = notifConfig?.notif_vencendo_hoje ?? true;

      // Check if user has connected WhatsApp session
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('session_id')
        .eq('user_id', userId)
        .eq('status', 'connected')
        .limit(1);

      if (!sessions || sessions.length === 0) {
        console.log(`User ${userId}: no connected WhatsApp session, skipping`);
        continue;
      }

      // Convert session_id to Evolution API instance name format (underscores instead of hyphens)
      const sessionId = `user_${userId.replace(/-/g, '_')}`;

      // Get user's clients with lembretes enabled
      const { data: clientes, error: clientErr } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId)
        .eq('lembretes', true)
        .not('data_vencimento', 'is', null);

      if (clientErr) {
        console.error(`Error fetching clientes for ${userId}:`, clientErr.message);
      }

      // Get ALL clients for birthday check
      const { data: allClientes } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId);

      // Get user's planos
      const { data: planos } = await supabase
        .from('planos')
        .select('id, nome, valor')
        .eq('user_id', userId);

      const planosMap = new Map((planos || []).map((p: any) => [p.id, p]));
      // Also map by name for fallback
      (planos || []).forEach((p: any) => planosMap.set(p.nome, p));

      // Get user profile for nome_empresa
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_empresa')
        .eq('user_id', userId)
        .maybeSingle();

      // Get user checkout config for pix key
      const { data: checkoutConfig } = await supabase
        .from('checkout_config')
        .select('pix_manual_key')
        .eq('user_id', userId)
        .maybeSingle();

      const extraData: Record<string, string> = {
        pix: checkoutConfig?.pix_manual_key || '',
        nome_empresa: profile?.nome_empresa || '',
      };

      // --- Expiration notifications ---
      if (clientes && clientes.length > 0) {
        const limiteProximoVencer = new Date(hoje);
        limiteProximoVencer.setDate(limiteProximoVencer.getDate() + diasProximoVencer);

        const limiteVencido = new Date(hoje);
        limiteVencido.setDate(limiteVencido.getDate() - diasAposVencimento);

        for (const cliente of clientes) {
          if (!cliente.whatsapp || !cliente.data_vencimento) continue;

          // Status is determined purely by data_vencimento vs today:
          // - Vencimento > hoje → "Ativo" → no notification
          // - Vencimento == hoje → "Vence Hoje" → send vence_hoje
          // - Vencimento < hoje → "Vencido" → send vencido
          // - Vencimento within X days → "Próximo a vencer" → send proximo_vencer
          // The date comparison logic below already handles this correctly.

          let templateMsg: string | null = null;
          let tipoNotificacao: string | null = null;

          if (cliente.fixo) {
            // Fixed day billing: use day-of-month comparison
            // BUT first check if the actual data_vencimento is in the future — if so, client is active
            const dataVenc = new Date(cliente.data_vencimento);
            dataVenc.setHours(0, 0, 0, 0);

            // If the real expiry date is in the future, skip vencido/vence_hoje notifications
            if (dataVenc > hoje) {
              // Only check proximo_vencer based on day-of-month
              const fixedDay = dataVenc.getUTCDate();
              const hojeDay = hoje.getDate();
              const hojeMonth = hoje.getMonth();
              const hojeYear = hoje.getFullYear();
              const lastDayThisMonth = new Date(hojeYear, hojeMonth + 1, 0).getDate();
              const effectiveDay = Math.min(fixedDay, lastDayThisMonth);
              const diffDays = effectiveDay - hojeDay;

              if (diasProximoVencer > 0 && diffDays > 0 && diffDays <= diasProximoVencer && msg.proximo_vencer) {
                templateMsg = msg.proximo_vencer;
                tipoNotificacao = 'proximo_vencer';
              }
            } else {
              // data_vencimento is today or in the past — use day-of-month logic
              const fixedDay = new Date(cliente.data_vencimento).getUTCDate();
              const hojeDay = hoje.getDate();
              const hojeMonth = hoje.getMonth();
              const hojeYear = hoje.getFullYear();
              const lastDayThisMonth = new Date(hojeYear, hojeMonth + 1, 0).getDate();
              const effectiveDay = Math.min(fixedDay, lastDayThisMonth);
              const diffDays = effectiveDay - hojeDay;

              if (diffDays < 0 && Math.abs(diffDays) <= diasAposVencimento && msg.vencido) {
                templateMsg = msg.vencido;
                tipoNotificacao = 'vencido';
              } else if (diffDays === 0 && notifVencendoHoje && msg.vence_hoje) {
                templateMsg = msg.vence_hoje;
                tipoNotificacao = 'vence_hoje';
              } else if (diasProximoVencer > 0 && diffDays > 0 && diffDays <= diasProximoVencer && msg.proximo_vencer) {
                templateMsg = msg.proximo_vencer;
                tipoNotificacao = 'proximo_vencer';
              }
            }
          } else {
            // Normal: absolute date comparison
            const dataVenc = new Date(cliente.data_vencimento);
            dataVenc.setHours(0, 0, 0, 0);

            if (dataVenc < hoje && dataVenc >= limiteVencido && msg.vencido) {
              templateMsg = msg.vencido;
              tipoNotificacao = 'vencido';
            } else if (dataVenc.getTime() === hoje.getTime() && notifVencendoHoje && msg.vence_hoje) {
              templateMsg = msg.vence_hoje;
              tipoNotificacao = 'vence_hoje';
            } else if (diasProximoVencer > 0 && dataVenc > hoje && dataVenc <= limiteProximoVencer && msg.proximo_vencer) {
              templateMsg = msg.proximo_vencer;
              tipoNotificacao = 'proximo_vencer';
            }
          }

          if (!templateMsg || !tipoNotificacao) continue;

          const result = await sendNotification(supabase, evolutionUrl, evolutionKey, sessionId, userId, cliente, templateMsg, tipoNotificacao, planosMap, extraData);
          if (result === 'sent') totalSent++;
          else if (result === 'error') totalErrors++;
          else totalSkipped++;
        }
      }

      // --- Birthday notifications ---
      const notifAniversario = notifConfig?.notif_aniversario ?? true;
      if (notifAniversario && msg.aniversario_cliente && allClientes && allClientes.length > 0) {
        const hojeMonth = hoje.getMonth() + 1;
        const hojeDay = hoje.getDate();

        for (const cliente of allClientes) {
          if (!cliente.whatsapp || !cliente.aniversario) continue;

          let bDay: number | null = null;
          let bMonth: number | null = null;
          const aniv = cliente.aniversario.trim();

          if (aniv.includes('/')) {
            const parts = aniv.split('/');
            bDay = parseInt(parts[0], 10);
            bMonth = parseInt(parts[1], 10);
          } else if (aniv.includes('-')) {
            const parts = aniv.split('-');
            if (parts[0].length === 4) {
              bMonth = parseInt(parts[1], 10);
              bDay = parseInt(parts[2], 10);
            } else {
              bDay = parseInt(parts[0], 10);
              bMonth = parseInt(parts[1], 10);
            }
          }

          if (!bDay || !bMonth) continue;
          if (bMonth !== hojeMonth || bDay !== hojeDay) continue;

          const result = await sendNotification(supabase, evolutionUrl, evolutionKey, sessionId, userId, cliente, msg.aniversario_cliente, 'aniversario', planosMap, extraData);
          if (result === 'sent') totalSent++;
          else if (result === 'error') totalErrors++;
          else totalSkipped++;
        }
      }
    }

    const summary = { totalSent, totalErrors, totalSkipped, timestamp: new Date().toISOString() };
    console.log('📊 Auto-notify summary:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('🚨 Auto-notify error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
