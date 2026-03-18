
-- Clean up duplicate pending faturas: keep only the most recent per client
DELETE FROM faturas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, cliente_id ORDER BY created_at DESC) as rn
    FROM faturas
    WHERE status = 'pendente' AND cliente_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);
