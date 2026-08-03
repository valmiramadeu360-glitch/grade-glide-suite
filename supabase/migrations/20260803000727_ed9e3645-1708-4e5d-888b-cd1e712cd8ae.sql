DROP POLICY IF EXISTS "campus_media_read_authenticated" ON storage.objects;

CREATE POLICY "campus_media_list_admin_only"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'campus-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));