
-- Create public bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload post media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to view post media (public bucket)
CREATE POLICY "Anyone can view post media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'post-media');

-- Allow users to delete their own media
CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
