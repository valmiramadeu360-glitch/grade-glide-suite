-- 1) Enquetes respeitam a privacidade da publicação
DROP POLICY IF EXISTS "polls_read_secure" ON public.post_polls;
CREATE POLICY "polls_read_secure" ON public.post_polls
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_polls.post_id
    AND (
      p.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        public.can_view_user_posts(auth.uid(), p.user_id)
        AND (
          p.community_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.community_members cm
            WHERE cm.community_id = p.community_id AND cm.user_id = auth.uid()
          )
        )
      )
    )
));

-- 2) search_path fixo na função duplicada de papéis
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
END;
$function$;

-- 3) Revoga execução de funções privilegiadas para visitantes anônimos
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_following(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_dm_user(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_user_posts(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.owns_discipline_code(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_post_poll_totals(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_announcement_poll_totals(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_dm_user(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_user_posts(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_discipline_code(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_post_poll_totals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_announcement_poll_totals(uuid) TO authenticated, service_role;