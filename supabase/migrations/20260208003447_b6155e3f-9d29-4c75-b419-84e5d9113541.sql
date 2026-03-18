-- Add DELETE policy for whatsapp_messages table
CREATE POLICY "Users can delete their own messages"
ON public.whatsapp_messages
FOR DELETE
USING (auth.uid() = user_id);