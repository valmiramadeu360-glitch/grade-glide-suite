-- 1. community_members: prevent self-assigned elevated roles
DROP POLICY IF EXISTS "members manage own" ON public.community_members;
DROP POLICY IF EXISTS "members join as member only" ON public.community_members;
DROP POLICY IF EXISTS "members leave own" ON public.community_members;
DROP POLICY IF EXISTS "members update own" ON public.community_members;

CREATE POLICY "members join as member only"
ON public.community_members FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND role = 'member'::public.community_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "members leave own"
ON public.community_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "only admins change member roles"
ON public.community_members FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. materials bucket storage policies: scope to authenticated role
DROP POLICY IF EXISTS "Users can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own materials files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own materials files" ON storage.objects;

CREATE POLICY "Users can upload materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own materials files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own materials files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);