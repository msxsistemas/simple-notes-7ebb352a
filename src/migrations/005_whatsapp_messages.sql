-- Criar tabela para tracking de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    message_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_id ON whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas suas próprias mensagens
CREATE POLICY "Users can view own WhatsApp messages" 
    ON whatsapp_messages FOR SELECT 
    USING (auth.uid() = user_id);

-- Política para usuários criarem suas próprias mensagens
CREATE POLICY "Users can insert own WhatsApp messages" 
    ON whatsapp_messages FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Política para usuários atualizarem suas próprias mensagens
CREATE POLICY "Users can update own WhatsApp messages" 
    ON whatsapp_messages FOR UPDATE 
    USING (auth.uid() = user_id);

-- Criar tabela para sessões WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'failed')),
    qr_code TEXT,
    phone_number TEXT,
    device_name TEXT,
    connected_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para a tabela de sessões
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id ON whatsapp_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);

-- RLS para sessões WhatsApp
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para sessões
CREATE POLICY "Users can view own WhatsApp sessions" 
    ON whatsapp_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp sessions" 
    ON whatsapp_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp sessions" 
    ON whatsapp_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp sessions" 
    ON whatsapp_sessions FOR DELETE 
    USING (auth.uid() = user_id);