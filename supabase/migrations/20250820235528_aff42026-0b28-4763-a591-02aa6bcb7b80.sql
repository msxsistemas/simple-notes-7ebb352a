-- Adicionar colunas user_id nas tabelas
ALTER TABLE public.clientes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.aplicativos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.planos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.templates_cobranca ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.mensagens_padroes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Atualizar políticas RLS para isolar dados por usuário
DROP POLICY IF EXISTS "Permitir todas as operações clientes" ON public.clientes;
DROP POLICY IF EXISTS "Permitir todas as operações aplicativos" ON public.aplicativos;
DROP POLICY IF EXISTS "Permitir todas as operações planos" ON public.planos;
DROP POLICY IF EXISTS "Permitir todas as operações produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir todas as operações templates" ON public.templates_cobranca;
DROP POLICY IF EXISTS "Permitir todas as operações mensagens" ON public.mensagens_padroes;

-- Políticas para clientes
CREATE POLICY "Users can view their own clientes" ON public.clientes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clientes" ON public.clientes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clientes" ON public.clientes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clientes" ON public.clientes
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para aplicativos
CREATE POLICY "Users can view their own aplicativos" ON public.aplicativos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own aplicativos" ON public.aplicativos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own aplicativos" ON public.aplicativos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own aplicativos" ON public.aplicativos
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para planos
CREATE POLICY "Users can view their own planos" ON public.planos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own planos" ON public.planos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planos" ON public.planos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planos" ON public.planos
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para produtos
CREATE POLICY "Users can view their own produtos" ON public.produtos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own produtos" ON public.produtos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own produtos" ON public.produtos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own produtos" ON public.produtos
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para templates_cobranca
CREATE POLICY "Users can view their own templates" ON public.templates_cobranca
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates" ON public.templates_cobranca
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON public.templates_cobranca
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON public.templates_cobranca
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para mensagens_padroes
CREATE POLICY "Users can view their own mensagens" ON public.mensagens_padroes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mensagens" ON public.mensagens_padroes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mensagens" ON public.mensagens_padroes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mensagens" ON public.mensagens_padroes
    FOR DELETE USING (auth.uid() = user_id);