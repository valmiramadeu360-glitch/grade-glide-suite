
ALTER TABLE public.news_channels
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS editorial_line text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS team_note text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE UNIQUE INDEX IF NOT EXISTS news_channels_handle_key ON public.news_channels (lower(handle)) WHERE handle IS NOT NULL;

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS read_minutes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.news_channel_members (
  channel_id uuid NOT NULL REFERENCES public.news_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'writer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_channel_members TO authenticated;
GRANT ALL ON public.news_channel_members TO service_role;
ALTER TABLE public.news_channel_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.news_post_likes (
  post_id uuid NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.news_post_likes TO authenticated;
GRANT ALL ON public.news_post_likes TO service_role;
ALTER TABLE public.news_post_likes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_news_channel_editor(_channel uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM news_channels c WHERE c.id = _channel AND c.created_by = _user)
      OR EXISTS (SELECT 1 FROM news_channel_members m WHERE m.channel_id = _channel AND m.user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.can_publish_news(_channel uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(_user, 'admin') OR (
    NOT is_user_banned(_user)
    AND EXISTS (SELECT 1 FROM news_channels c WHERE c.id = _channel AND c.status = 'approved' AND c.is_active)
    AND is_news_channel_editor(_channel, _user)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_news_channel_editor(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_publish_news(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_news_channel_editor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_publish_news(uuid, uuid) TO authenticated;

-- Channels: non-admins always start pending, in their own university; cannot self-approve
CREATE OR REPLACE FUNCTION public.tg_news_channels_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.terms_accepted_at IS NULL THEN
      RAISE EXCEPTION 'É necessário aceitar o termo editorial';
    END IF;
    NEW.created_by := auth.uid();
    NEW.status := 'pending';
    NEW.scope := 'university';
    NEW.university_id := my_university_id();
    NEW.campus_id := NULL; NEW.course_id := NULL;
    NEW.member_count := 0; NEW.is_active := true;
    NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.review_note := NULL;
    IF (SELECT count(*) FROM news_channels WHERE created_by = auth.uid() AND status = 'pending') >= 2 THEN
      RAISE EXCEPTION 'Você já tem solicitações em análise';
    END IF;
  ELSE
    NEW.created_by := OLD.created_by; NEW.status := OLD.status;
    NEW.scope := OLD.scope; NEW.university_id := OLD.university_id;
    NEW.campus_id := OLD.campus_id; NEW.course_id := OLD.course_id;
    NEW.member_count := OLD.member_count; NEW.is_active := OLD.is_active;
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    NEW.review_note := OLD.review_note; NEW.terms_accepted_at := OLD.terms_accepted_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_news_channels_guard() FROM public, anon, authenticated;
CREATE TRIGGER trg_news_channels_guard BEFORE INSERT OR UPDATE ON public.news_channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_news_channels_guard();

-- Notify founder on review
CREATE OR REPLACE FUNCTION public.tg_news_channel_review_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type)
    VALUES (NEW.created_by,
      CASE NEW.status WHEN 'approved' THEN 'Sua redação foi aprovada!'
                      WHEN 'rejected' THEN 'Solicitação de redação recusada'
                      WHEN 'suspended' THEN 'Sua redação foi suspensa'
                      ELSE 'Status da redação atualizado' END,
      CASE NEW.status WHEN 'approved' THEN NEW.name || ' já pode publicar a primeira matéria.'
                      ELSE coalesce(NEW.review_note, NEW.name) END,
      'news');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_news_channel_review_notify() FROM public, anon, authenticated;
CREATE TRIGGER trg_news_channel_review_notify AFTER UPDATE ON public.news_channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_news_channel_review_notify();

-- Channel visibility: pending/rejected only to team/admin
CREATE POLICY news_channels_team_read ON public.news_channels FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (SELECT is_admin()));
CREATE POLICY news_channels_approved_only ON public.news_channels AS RESTRICTIVE FOR SELECT TO authenticated
  USING (status = 'approved' OR created_by = auth.uid() OR (SELECT is_admin())
         OR is_news_channel_editor(id, auth.uid()));

-- Members
CREATE POLICY ncm_read ON public.news_channel_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM news_channels c WHERE c.id = channel_id));
CREATE POLICY ncm_manage ON public.news_channel_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM news_channels c WHERE c.id = channel_id AND c.created_by = auth.uid()) OR (SELECT is_admin())
         OR user_id = auth.uid())
  WITH CHECK ((EXISTS (SELECT 1 FROM news_channels c WHERE c.id = channel_id AND c.created_by = auth.uid()) OR (SELECT is_admin()))
         AND same_university(auth.uid(), user_id) OR (SELECT is_admin()));

-- Posts
DROP POLICY IF EXISTS news_posts_author_write ON public.news_posts;
CREATE POLICY news_posts_author_write ON public.news_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND can_publish_news(channel_id, auth.uid()));
DROP POLICY IF EXISTS news_posts_author_update ON public.news_posts;
CREATE POLICY news_posts_author_update ON public.news_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'admin') OR is_news_channel_editor(channel_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') OR can_publish_news(channel_id, auth.uid()));
CREATE POLICY news_posts_drafts_private ON public.news_posts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (status = 'published' OR author_id = auth.uid() OR is_news_channel_editor(channel_id, auth.uid()) OR (SELECT is_admin()));

-- Likes
CREATE POLICY npl_read ON public.news_post_likes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM news_posts p WHERE p.id = post_id));
CREATE POLICY npl_insert ON public.news_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM news_posts p WHERE p.id = post_id AND p.status = 'published'));
CREATE POLICY npl_delete ON public.news_post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_news_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE news_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSE UPDATE news_posts SET like_count = greatest(like_count - 1, 0) WHERE id = OLD.post_id; END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_news_like_count() FROM public, anon, authenticated;
CREATE TRIGGER trg_news_like_count AFTER INSERT OR DELETE ON public.news_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.tg_news_like_count();
