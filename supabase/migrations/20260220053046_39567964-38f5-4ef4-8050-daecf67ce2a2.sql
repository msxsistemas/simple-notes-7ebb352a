-- Add referral goal message template column
ALTER TABLE public.mensagens_padroes
ADD COLUMN indicacao_meta TEXT DEFAULT 'Parabéns {nome}! 🎉{br}{br}Você atingiu a meta de indicações e ganhou um desconto de {desconto} na sua próxima fatura!{br}{br}Continue indicando para ganhar mais descontos! 💰';