-- 1) Remove hardcoded admin email backdoor
-- Ensure official admin keeps admin through user_roles before dropping the backdoor
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'eduflow.adm.academy@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Recreate the campus admin policy on the role-table based has_role before dropping the backdoor
DROP POLICY IF EXISTS campus_admin_policy ON public.campus_buildings;

DROP FUNCTION IF EXISTS public.has_role(uuid, text);

CREATE POLICY campus_admin_policy
ON public.campus_buildings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Revoke anon/public EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.ru_queue_status(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ru_peak_hours(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ru_rating_summary(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_ru_queue_validate() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_or_create_discipline_community(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_or_create_class_community(uuid, integer, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_atestado_import(uuid, uuid, uuid, uuid, integer, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_feedbacks_scrub_anonymous() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ru_distance_meters(numeric, numeric, numeric, numeric) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.ru_queue_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ru_peak_hours(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ru_rating_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_discipline_community(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_class_community(uuid, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_atestado_import(uuid, uuid, uuid, uuid, integer, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ru_distance_meters(numeric, numeric, numeric, numeric) TO authenticated, service_role;

-- 3) Pin search_path on remaining non-trigger helper (already pinned elsewhere)
ALTER FUNCTION public.ru_distance_meters(numeric, numeric, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 4) Public buckets: restrict listing to authenticated users
DROP POLICY IF EXISTS "Leitura pública das fotos do campus" ON storage.objects;
CREATE POLICY "campus_media_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'campus-media');

DROP POLICY IF EXISTS "ru_menus_read" ON storage.objects;
CREATE POLICY "ru_menus_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ru-menus');