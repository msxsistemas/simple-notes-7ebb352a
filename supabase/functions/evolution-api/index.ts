import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    console.log('[Evolution API] Config:', EVOLUTION_API_URL ? 'OK' : 'Missing');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Evolution API not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API não configurada no servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;
    const instanceName = `user_${user.id.replace(/-/g, '_')}`;
    const apiUrl = EVOLUTION_API_URL.replace(/\/$/, '');

    console.log(`[Evolution API] Action: ${action}, Instance: ${instanceName}`);

    const makeRequest = async (endpoint: string, method: string = 'GET', requestBody?: any) => {
      const url = `${apiUrl}${endpoint}`;
      console.log(`[Evolution API] ${method} ${url}`);
      
      // Try with 'apikey' header first (Evolution API v2 standard)
      let response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      // If unauthorized, try with 'Authorization: Bearer' header
      if (response.status === 401) {
        console.log('[Evolution API] Trying Authorization Bearer header...');
        response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EVOLUTION_API_KEY}`,
          },
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        });
      }

      // If still unauthorized, try with 'Authorization: apikey' header
      if (response.status === 401) {
        console.log('[Evolution API] Trying Authorization apikey header...');
        response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `apikey ${EVOLUTION_API_KEY}`,
          },
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        });
      }

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log('[Evolution API] Non-JSON response:', text);
        data = { message: text };
      }
      
      console.log(`[Evolution API] Response status: ${response.status}`, JSON.stringify(data));
      
      return { ok: response.ok, status: response.status, data };
    };

    let result;

    switch (action) {
      case 'connect': {
        // First check if instance exists
        const fetchResult = await makeRequest(`/instance/fetchInstances?instanceName=${instanceName}`);
        
        if (fetchResult.ok && fetchResult.data?.length > 0) {
          const instance = fetchResult.data[0];
          if (instance.instance?.state === 'open') {
            result = {
              status: 'connected',
              phoneNumber: instance.instance?.owner,
              profileName: instance.instance?.profileName,
            };
            break;
          }
          
          // Instance exists but not connected, try to connect
          const connectResult = await makeRequest(`/instance/connect/${instanceName}`);
          if (connectResult.ok) {
            const qrCode = connectResult.data.base64 || connectResult.data.qrcode?.base64;
            if (qrCode) {
              result = { status: 'connecting', qrCode };
              break;
            }
            if (connectResult.data.instance?.state === 'open') {
              result = {
                status: 'connected',
                phoneNumber: connectResult.data.instance?.owner,
                profileName: connectResult.data.instance?.profileName,
              };
              break;
            }
          }
        }

        // Create new instance
        const createResult = await makeRequest('/instance/create', 'POST', {
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        });

        console.log('[Evolution API] Create instance result:', JSON.stringify(createResult));

        if (createResult.ok && createResult.data.qrcode?.base64) {
          result = { status: 'connecting', qrCode: createResult.data.qrcode.base64 };
        } else if (createResult.status === 401) {
          result = { error: 'API Key inválida ou sem permissão. Verifique as credenciais da Evolution API.' };
        } else {
          result = { error: createResult.data.message || createResult.data.error || 'Erro ao criar instância' };
        }
        break;
      }

      case 'status': {
        const statusResult = await makeRequest(`/instance/connectionState/${instanceName}`);
        
        if (!statusResult.ok) {
          result = { status: 'disconnected' };
          break;
        }

        const state = statusResult.data.instance?.state || statusResult.data.state;
        
        if (state === 'open') {
          const fetchResult = await makeRequest(`/instance/fetchInstances?instanceName=${instanceName}`);
          const instanceInfo = fetchResult.data?.[0];
          
          result = {
            status: 'connected',
            phoneNumber: instanceInfo?.instance?.owner || statusResult.data.instance?.owner,
            profileName: instanceInfo?.instance?.profileName,
            profilePicture: instanceInfo?.instance?.profilePictureUrl,
          };
        } else if (state === 'connecting') {
          result = { status: 'connecting' };
        } else {
          result = { status: 'disconnected' };
        }
        break;
      }

      case 'disconnect': {
        try {
          await makeRequest(`/instance/logout/${instanceName}`, 'DELETE');
        } catch (e) {
          console.log('Logout failed, continuing with delete');
        }
        
        try {
          await makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
        } catch (e) {
          console.log('Delete failed:', e);
        }
        
        result = { status: 'disconnected' };
        break;
      }

      case 'sendMessage': {
        const { phone, message } = body;
        const formattedPhone = phone.replace(/\D/g, '');
        
        const sendResult = await makeRequest(`/message/sendText/${instanceName}`, 'POST', {
          number: formattedPhone,
          text: message,
          delay: 1200,
          linkPreview: false,
        });

        if (sendResult.ok) {
          result = { success: true, data: sendResult.data };
        } else {
          // Check if error is connection related
          const errorMsg = JSON.stringify(sendResult.data);
          const isConnectionError = errorMsg.includes('Connection Closed') || 
            errorMsg.includes('Not Connected') || 
            errorMsg.includes('Connection Failure');
          
          if (isConnectionError) {
            // Update session status in database
            const serviceClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            await serviceClient
              .from('whatsapp_sessions')
              .update({ status: 'disconnected' })
              .eq('user_id', user.id);
            
            console.log(`[Evolution API] Connection lost for ${instanceName}, updated DB status`);
            result = { error: 'WhatsApp desconectado. Reconecte em "Parear WhatsApp".', connectionLost: true };
          } else {
            result = { error: sendResult.data?.response?.message?.[0] || sendResult.data.message || 'Erro ao enviar mensagem' };
          }
        }
        break;
      }

      case 'sendMedia': {
        const { phone: mediaPhone, message: mediaCaption, mediaUrl } = body;
        const formattedMediaPhone = mediaPhone.replace(/\D/g, '');
        
        console.log(`[Evolution API] Sending media to ${formattedMediaPhone}, URL: ${mediaUrl}`);
        
        const sendMediaResult = await makeRequest(`/message/sendMedia/${instanceName}`, 'POST', {
          number: formattedMediaPhone,
          media: mediaUrl,
          mediatype: 'image',
          caption: mediaCaption || '',
          delay: 1200,
        });

        if (sendMediaResult.ok) {
          result = { success: true, data: sendMediaResult.data };
        } else {
          const errorMsg = JSON.stringify(sendMediaResult.data);
          const isConnectionError = errorMsg.includes('Connection Closed') || 
            errorMsg.includes('Not Connected') || 
            errorMsg.includes('Connection Failure');
          
          if (isConnectionError) {
            const serviceClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            await serviceClient
              .from('whatsapp_sessions')
              .update({ status: 'disconnected' })
              .eq('user_id', user.id);
            
            console.log(`[Evolution API] Connection lost for ${instanceName}, updated DB status`);
            result = { error: 'WhatsApp desconectado. Reconecte em "Parear WhatsApp".', connectionLost: true };
          } else {
            result = { error: sendMediaResult.data?.response?.message?.[0] || sendMediaResult.data.message || 'Erro ao enviar mídia' };
          }
        }
        break;
      }

      default:
        result = { error: 'Ação inválida' };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evolution-api function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no processamento da requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
