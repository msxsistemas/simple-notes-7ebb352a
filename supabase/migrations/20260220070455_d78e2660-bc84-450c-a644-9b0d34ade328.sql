-- Fix the existing discount log and client discount to match new config
UPDATE indicacoes_descontos_log SET valor_desconto = 10, valor_final = 19.90 WHERE id = '7d1da904-331b-4fd5-b284-578ccf7832ad';
UPDATE clientes SET desconto = '10.00' WHERE id = '5f8df95a-ec99-4cb0-a232-2036865678dd';
-- Delete the old fatura so a fresh one can be generated
DELETE FROM faturas WHERE id = '02a70e9a-2d08-4dab-91f8-79d988c16e6f';