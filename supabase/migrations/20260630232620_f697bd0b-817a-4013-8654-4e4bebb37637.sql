
-- ============================================================
-- FASE 3 — CENTRAL DE NOTÍCIAS
-- ============================================================

CREATE TYPE public.news_channel_scope AS ENUM ('global', 'university', 'campus', 'course');

CREATE TABLE public.news_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope public.news_channel_scope NOT NULL DEFAULT 'global',
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  icon TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_channels TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_channels TO authenticated;
GRANT ALL ON public.news_channels TO service_role;
ALTER TABLE public.news_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_read_all" ON public.news_channels
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "channels_admin_write" ON public.news_channels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.news_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_url TEXT,
  link_url TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_news_posts_channel ON public.news_posts(channel_id, published_at DESC);
GRANT SELECT ON public.news_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_posts_read_all" ON public.news_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.news_channels c WHERE c.id = channel_id AND c.is_active = TRUE)
  );
CREATE POLICY "news_posts_author_write" ON public.news_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.news_channels c WHERE c.id = channel_id AND c.created_by = auth.uid())
    )
  );
CREATE POLICY "news_posts_author_update" ON public.news_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "news_posts_author_delete" ON public.news_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.news_subscriptions (
  channel_id UUID NOT NULL REFERENCES public.news_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.news_subscriptions TO authenticated;
GRANT ALL ON public.news_subscriptions TO service_role;
ALTER TABLE public.news_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_self_read" ON public.news_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subs_self_insert" ON public.news_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "subs_self_delete" ON public.news_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger: ao entrar numa community, cria/garante canal correspondente e inscreve o usuário
CREATE OR REPLACE FUNCTION public.tg_auto_subscribe_news()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community RECORD;
  v_channel_id UUID;
  v_scope news_channel_scope;
  v_channel_name TEXT;
BEGIN
  SELECT * INTO v_community FROM public.communities WHERE id = NEW.community_id;
  IF v_community IS NULL THEN RETURN NEW; END IF;

  -- Mapeia tipo de comunidade para escopo de canal (period não vira canal de notícias)
  IF v_community.type = 'university' THEN
    v_scope := 'university'::news_channel_scope;
    v_channel_name := COALESCE(v_community.name, 'Notícias Universidade');
  ELSIF v_community.type = 'campus' THEN
    v_scope := 'campus'::news_channel_scope;
    v_channel_name := COALESCE(v_community.name, 'Notícias Campus');
  ELSIF v_community.type = 'course' THEN
    v_scope := 'course'::news_channel_scope;
    v_channel_name := COALESCE(v_community.name, 'Notícias Curso');
  ELSE
    RETURN NEW;
  END IF;

  -- Garante canal
  SELECT id INTO v_channel_id FROM public.news_channels
    WHERE scope = v_scope
      AND COALESCE(university_id::text,'') = COALESCE(v_community.university_id::text,'')
      AND COALESCE(campus_id::text,'') = COALESCE(v_community.campus_id::text,'')
      AND COALESCE(course_id::text,'') = COALESCE(v_community.course_id::text,'');

  IF v_channel_id IS NULL THEN
    INSERT INTO public.news_channels (scope, university_id, campus_id, course_id, name, description)
    VALUES (v_scope, v_community.university_id, v_community.campus_id, v_community.course_id,
            v_channel_name, 'Canal oficial de notícias')
    RETURNING id INTO v_channel_id;
  END IF;

  INSERT INTO public.news_subscriptions (channel_id, user_id)
  VALUES (v_channel_id, NEW.user_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_community_members_news
AFTER INSERT ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_subscribe_news();

-- Contador de inscritos
CREATE OR REPLACE FUNCTION public.tg_news_sub_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_channels SET member_count = member_count + 1 WHERE id = NEW.channel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news_channels SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.channel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER tg_news_subs_count
AFTER INSERT OR DELETE ON public.news_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_news_sub_count();

-- updated_at triggers
CREATE TRIGGER tg_news_channels_updated BEFORE UPDATE ON public.news_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_news_posts_updated BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CORREÇÃO DE SEGURANÇA — RLS nas tabelas abertas
-- ============================================================

-- followers
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
CREATE POLICY "followers_read_all" ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers_self_insert" ON public.followers FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());
CREATE POLICY "followers_self_delete" ON public.followers FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
CREATE POLICY "notifications_self_read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_self_delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- saved_posts
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
CREATE POLICY "saved_self_read" ON public.saved_posts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "saved_self_insert" ON public.saved_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_self_delete" ON public.saved_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());
