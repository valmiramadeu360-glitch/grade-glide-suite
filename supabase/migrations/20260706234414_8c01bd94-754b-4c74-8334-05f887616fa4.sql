
-- 1) Ban helper + protection trigger --------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE user_id = _user_id), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_profiles_protect_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      NEW.is_banned := OLD.is_banned;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_protect_ban() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_profiles_protect_ban ON public.profiles;
CREATE TRIGGER trg_profiles_protect_ban
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_ban();

-- 2) Fix search_path & revoke on existing SECURITY DEFINER functions ------
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_new_like_notification() SET search_path = public;
ALTER FUNCTION public.handle_new_comment_notification() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.tg_profile_auto_communities() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_community_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_news_sub_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_auto_subscribe_news() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_like_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_comment_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_official_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 3) Profiles SELECT restrict + public view ------------------------------
DROP POLICY IF EXISTS "Authenticated users can view any profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins can view any profile" ON public.profiles;
CREATE POLICY "Admins can view any profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  user_id,
  CASE
    WHEN COALESCE(hide_name, false) THEN 'Estudante'
    ELSE COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), 'Estudante')
  END AS display_name,
  avatar_url,
  bio,
  university_id,
  course_id,
  current_period,
  COALESCE(privacy_profile, 'public') AS privacy_profile
FROM public.profiles
WHERE COALESCE(privacy_profile, 'public') <> 'private';

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 4) Ban gate on write policies -------------------------------------------
DROP POLICY IF EXISTS "Usuários podem criar seus próprios posts" ON public.posts;
CREATE POLICY "Usuários podem criar seus próprios posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios posts" ON public.posts;
CREATE POLICY "Usuários podem atualizar seus próprios posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Usuários podem criar comentários" ON public.post_comments;
CREATE POLICY "Usuários podem criar comentários"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Usuários podem dar like" ON public.post_likes;
CREATE POLICY "Usuários podem dar like"
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Usuários podem seguir outros" ON public.follows;
CREATE POLICY "Usuários podem seguir outros"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "followers_self_insert" ON public.followers;
CREATE POLICY "followers_self_insert"
  ON public.followers FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "votes_own_insert" ON public.post_poll_votes;
CREATE POLICY "votes_own_insert"
  ON public.post_poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can vote once" ON public.announcement_poll_votes;
CREATE POLICY "Users can vote once"
  ON public.announcement_poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "news_posts_author_write" ON public.news_posts;
CREATE POLICY "news_posts_author_write"
  ON public.news_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND NOT public.is_user_banned(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.news_channels c WHERE c.id = news_posts.channel_id AND c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuários podem denunciar" ON public.post_reports;
CREATE POLICY "Usuários podem denunciar"
  ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "saved_self_insert" ON public.saved_posts;
CREATE POLICY "saved_self_insert"
  ON public.saved_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_user_banned(auth.uid()));

-- 5) Post comments/likes: scope to visible parent post -------------------
DROP POLICY IF EXISTS "Qualquer pessoa logada pode ver comentários" ON public.post_comments;
CREATE POLICY "Comments visible when post visible"
  ON public.post_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND (
        p.community_id IS NULL
        OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = p.community_id AND cm.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  ));

DROP POLICY IF EXISTS "Qualquer pessoa logada pode ver likes" ON public.post_likes;
CREATE POLICY "Likes visible when post visible"
  ON public.post_likes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id
      AND (
        p.community_id IS NULL
        OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = p.community_id AND cm.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  ));

-- 6) Poll votes: read own only + aggregate RPCs -------------------------
DROP POLICY IF EXISTS "votes_read" ON public.post_poll_votes;
CREATE POLICY "votes_read_own"
  ON public.post_poll_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read all votes" ON public.announcement_poll_votes;
CREATE POLICY "announcement_votes_read_own"
  ON public.announcement_poll_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_post_poll_totals(_poll_id uuid)
RETURNS TABLE(option_index int, votes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT option_index, COUNT(*)::bigint AS votes
  FROM public.post_poll_votes
  WHERE poll_id = _poll_id
  GROUP BY option_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_post_poll_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_poll_totals(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_announcement_poll_totals(_announcement_id uuid)
RETURNS TABLE(option_index int, votes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT option_index, COUNT(*)::bigint AS votes
  FROM public.announcement_poll_votes
  WHERE announcement_id = _announcement_id
  GROUP BY option_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_announcement_poll_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_announcement_poll_totals(uuid) TO authenticated, service_role;

-- 7) Followers/follows read scoping -------------------------------------
DROP POLICY IF EXISTS "followers_read_all" ON public.followers;
CREATE POLICY "followers_read_scoped"
  ON public.followers FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = followers.following_id
        AND COALESCE(p.privacy_profile,'public') = 'public'
    )
  );

DROP POLICY IF EXISTS "Qualquer pessoa logada pode ver follows" ON public.follows;
CREATE POLICY "follows_read_scoped"
  ON public.follows FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = follows.following_id
        AND COALESCE(p.privacy_profile,'public') = 'public'
    )
  );

-- 8) Storage: post-documents ownership read -----------------------------
DROP POLICY IF EXISTS "post_docs_read" ON storage.objects;
CREATE POLICY "post_docs_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 9) Remove broad listing on public buckets -----------------------------
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
