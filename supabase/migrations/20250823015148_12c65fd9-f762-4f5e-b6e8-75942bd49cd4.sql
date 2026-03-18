-- Create checkout_config table to store payment method configurations
CREATE TABLE public.checkout_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pix_enabled BOOLEAN NOT NULL DEFAULT false,
  credit_card_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkout_config_single_user UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.checkout_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own checkout config" 
ON public.checkout_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkout config" 
ON public.checkout_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkout config" 
ON public.checkout_config 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE TRIGGER update_checkout_config_updated_at
BEFORE UPDATE ON public.checkout_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();