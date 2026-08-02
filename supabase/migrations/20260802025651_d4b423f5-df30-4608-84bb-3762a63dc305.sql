
DROP POLICY IF EXISTS "ru_menus_read" ON storage.objects;
CREATE POLICY "ru_menus_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ru-menus');

DROP POLICY IF EXISTS "ru_menus_upload_own" ON storage.objects;
CREATE POLICY "ru_menus_upload_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ru-menus' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "ru_menus_update_own" ON storage.objects;
CREATE POLICY "ru_menus_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ru-menus' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "ru_menus_delete_own" ON storage.objects;
CREATE POLICY "ru_menus_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ru-menus' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::public.app_role)));
