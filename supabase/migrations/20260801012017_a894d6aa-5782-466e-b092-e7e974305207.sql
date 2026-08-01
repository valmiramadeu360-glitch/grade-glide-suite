-- helper: seguidor?
CREATE OR REPLACE FUNCTION public.is_following(_follower uuid, _following uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _follower AND following_id = _following)
      OR EXISTS (SELECT 1 FROM public.followers WHERE follower_id = _follower AND following_id = _following)
$$;
REVOKE ALL ON FUNCTION public.is_following(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO authenticated, service_role;

-- helper: pode ver posts do autor (privacy_posts)
CREATE OR REPLACE FUNCTION public.can_view_user_posts(_viewer uuid, _author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _viewer IS NULL THEN false
    WHEN _viewer = _author THEN true
    WHEN public.has_role(_viewer, 'admin'::public.app_role) THEN true
    ELSE COALESCE((
      SELECT CASE p.privacy_posts
        WHEN 'private' THEN false
        WHEN 'followers' THEN public.is_following(_viewer, _author)
        ELSE true
      END
      FROM public.profiles p WHERE p.user_id = _author
    ), true)
  END
$$;
REVOKE ALL ON FUNCTION public.can_view_user_posts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_user_posts(uuid, uuid) TO authenticated, service_role;

-- helper: pode enviar DM (privacy_dm)
CREATE OR REPLACE FUNCTION public.can_dm_user(_sender uuid, _receiver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _sender IS NULL THEN false
    WHEN _sender = _receiver THEN true
    ELSE COALESCE((
      SELECT CASE p.privacy_dm
        WHEN 'private' THEN false
        WHEN 'followers' THEN public.is_following(_receiver, _sender) OR public.is_following(_sender, _receiver)
        ELSE true
      END
      FROM public.profiles p WHERE p.user_id = _receiver
    ), true)
  END
$$;
REVOKE ALL ON FUNCTION public.can_dm_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_dm_user(uuid, uuid) TO authenticated, service_role;

-- 1) POSTS: remover política permissiva e aplicar escopo + privacidade
DROP POLICY IF EXISTS "Leitura segura de posts" ON public.posts;
DROP POLICY IF EXISTS "posts select policy" ON public.posts;
CREATE POLICY "Posts visíveis conforme comunidade e privacidade"
ON public.posts FOR SELECT TO authenticated
USING (
  (
    community_id IS NULL
    OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = posts.community_id AND cm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  AND public.can_view_user_posts(auth.uid(), posts.user_id)
);

DROP POLICY IF EXISTS "Usuários podem deletar seus próprios posts" ON public.posts;
CREATE POLICY "Usuários podem deletar seus próprios posts"
ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) DIRECT MESSAGES: respeitar privacy_dm do destinatário
DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND NOT public.is_user_banned(auth.uid())
  AND public.can_dm_user(auth.uid(), receiver_id)
);

-- 3) POST_REPORTS: leitura explícita para admins
DROP POLICY IF EXISTS "Apenas admin e quem denunciou pode ver" ON public.post_reports;
CREATE POLICY "Admins e autor da denúncia podem ver"
ON public.post_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins podem atualizar denúncias"
ON public.post_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) PROFILES: bloquear auto-desbanimento com erro explícito
CREATE OR REPLACE FUNCTION public.tg_profiles_protect_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar o status de banimento';
  END IF;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_ban ON public.profiles;
CREATE TRIGGER trg_profiles_protect_ban
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_ban();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 5) Funções agregadoras: exigir autenticação
CREATE OR REPLACE FUNCTION public.get_post_poll_totals(_poll_id uuid)
RETURNS TABLE(option_index integer, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.option_index, COUNT(*)::bigint
  FROM public.post_poll_votes v
  WHERE v.poll_id = _poll_id AND auth.uid() IS NOT NULL
  GROUP BY v.option_index;
$$;

CREATE OR REPLACE FUNCTION public.get_announcement_poll_totals(_announcement_id uuid)
RETURNS TABLE(option_index integer, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.option_index, COUNT(*)::bigint
  FROM public.announcement_poll_votes v
  WHERE v.announcement_id = _announcement_id AND auth.uid() IS NOT NULL
  GROUP BY v.option_index;
$$;

REVOKE ALL ON FUNCTION public.get_post_poll_totals(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_announcement_poll_totals(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_post_poll_totals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_announcement_poll_totals(uuid) TO authenticated, service_role;