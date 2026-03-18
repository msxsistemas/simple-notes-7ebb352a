
-- Create storage bucket for system logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Only admins can upload logos
CREATE POLICY "Admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can update logos
CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can delete logos
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'logos' 
  AND public.has_role(auth.uid(), 'admin')
);
