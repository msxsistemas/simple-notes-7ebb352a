-- Atualizar números de WhatsApp que não começam com 55
UPDATE clientes 
SET whatsapp = '55' || whatsapp 
WHERE whatsapp NOT LIKE '55%' 
  AND whatsapp IS NOT NULL 
  AND whatsapp != ''
  AND LENGTH(whatsapp) >= 10;