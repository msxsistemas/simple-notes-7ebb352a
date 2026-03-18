UPDATE user_subscriptions 
SET expira_em = inicio + interval '1 month', updated_at = now() 
WHERE id = '99d92067-7b5d-4b25-a0ad-4930dfb2048d';