
CREATE POLICY "post_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-documents');
CREATE POLICY "post_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
