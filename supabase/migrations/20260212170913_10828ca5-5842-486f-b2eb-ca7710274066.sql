
-- Allow users to insert their own subscription (for trial auto-creation)
CREATE POLICY "Users can insert own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own subscription
CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);
