-- Allow authenticated users to upload to their own folder in the logos bucket
CREATE POLICY "Users can upload to own folder in logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files in logos bucket
CREATE POLICY "Users can update own files in logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files in logos bucket
CREATE POLICY "Users can delete own files in logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);