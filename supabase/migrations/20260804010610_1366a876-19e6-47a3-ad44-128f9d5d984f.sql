DROP POLICY IF EXISTS "ru_queue_select" ON public.ru_queue_reports;
CREATE POLICY "ru_queue_select_own_or_admin" ON public.ru_queue_reports
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.ru_recent_levels(_restaurant_id uuid, _limit integer DEFAULT 40)
RETURNS TABLE(level public.ru_queue_level, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.level, r.created_at
  FROM public.ru_queue_reports r
  WHERE r.restaurant_id = _restaurant_id
    AND auth.uid() IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 40), 100);
$$;

REVOKE ALL ON FUNCTION public.ru_recent_levels(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ru_recent_levels(uuid, integer) TO authenticated;