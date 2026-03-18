-- Atualizar números de WhatsApp nas mensagens que não começam com 55
UPDATE whatsapp_messages 
SET phone = '55' || phone 
WHERE phone NOT LIKE '55%' 
  AND phone IS NOT NULL 
  AND phone != ''
  AND LENGTH(phone) >= 10;