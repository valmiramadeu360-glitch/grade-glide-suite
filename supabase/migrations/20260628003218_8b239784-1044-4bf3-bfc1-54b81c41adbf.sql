
-- =============================================================
-- FASE 2: COMUNIDADES AUTOMÁTICAS
-- =============================================================

-- Tipo de comunidade
DO $$ BEGIN
  CREATE TYPE public.community_type AS ENUM ('university', 'campus', 'course', 'period');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.community_role AS ENUM ('member', 'moderator', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================================
-- COMMUNITIES
-- =============================================================
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.community_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  period_number INT,
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade por combinação relevante
CREATE UNIQUE INDEX uniq_community_university ON public.communities(university_id)
  WHERE type = 'university' AND university_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_community_campus ON public.communities(campus_id)
  WHERE type = 'campus' AND campus_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_community_course ON public.communities(course_id)
  WHERE type = 'course' AND course_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_community_period ON public.communities(course_id, period_number)
  WHERE type = 'period' AND course_id IS NOT NULL AND period_number IS NOT NULL;

GRANT SELECT ON public.communities TO authenticated, anon;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities readable by everyone" ON public.communities
  FOR SELECT USING (true);
CREATE POLICY "communities admin write" ON public.communities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_communities_updated
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- COMMUNITY MEMBERS
-- =============================================================
CREATE TABLE public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.community_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE INDEX idx_cm_user ON public.community_members(user_id);
CREATE INDEX idx_cm_community ON public.community_members(community_id);

GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members readable by everyone" ON public.community_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members manage own" ON public.community_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own" ON public.community_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "members admin all" ON public.community_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- POSTS: community_id opcional
-- =============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_community ON public.posts(community_id);

-- =============================================================
-- MEMBER COUNTER TRIGGER
-- =============================================================
CREATE OR REPLACE FUNCTION public.tg_community_member_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_community_member_count
  AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_community_member_count();

-- =============================================================
-- AUTO-JOIN: ao atualizar vínculos no profiles
-- =============================================================
CREATE OR REPLACE FUNCTION public.tg_profile_auto_communities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_community_id UUID;
  v_uni RECORD;
  v_camp RECORD;
  v_course RECORD;
BEGIN
  -- Remove vínculos antigos que não correspondem mais ao perfil
  DELETE FROM public.community_members cm
  USING public.communities c
  WHERE cm.user_id = NEW.user_id
    AND cm.community_id = c.id
    AND (
      (c.type = 'university' AND c.university_id IS DISTINCT FROM NEW.university_id) OR
      (c.type = 'campus'     AND c.campus_id     IS DISTINCT FROM NEW.campus_id)     OR
      (c.type = 'course'     AND c.course_id     IS DISTINCT FROM NEW.course_id)     OR
      (c.type = 'period'     AND (c.course_id    IS DISTINCT FROM NEW.course_id OR c.period_number IS DISTINCT FROM NEW.current_period))
    );

  -- University
  IF NEW.university_id IS NOT NULL THEN
    SELECT id, acronym, name INTO v_uni FROM public.universities WHERE id = NEW.university_id;
    SELECT id INTO v_community_id FROM public.communities WHERE type='university' AND university_id=NEW.university_id;
    IF v_community_id IS NULL THEN
      INSERT INTO public.communities (type, university_id, name, description)
      VALUES ('university', NEW.university_id, v_uni.acronym, v_uni.name)
      RETURNING id INTO v_community_id;
    END IF;
    INSERT INTO public.community_members (community_id, user_id) VALUES (v_community_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Campus
  IF NEW.campus_id IS NOT NULL THEN
    SELECT id, name INTO v_camp FROM public.campuses WHERE id = NEW.campus_id;
    SELECT id INTO v_community_id FROM public.communities WHERE type='campus' AND campus_id=NEW.campus_id;
    IF v_community_id IS NULL THEN
      INSERT INTO public.communities (type, campus_id, university_id, name, description)
      VALUES ('campus', NEW.campus_id, NEW.university_id, v_camp.name, 'Campus ' || v_camp.name)
      RETURNING id INTO v_community_id;
    END IF;
    INSERT INTO public.community_members (community_id, user_id) VALUES (v_community_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Course
  IF NEW.course_id IS NOT NULL THEN
    SELECT id, name INTO v_course FROM public.courses WHERE id = NEW.course_id;
    SELECT id INTO v_community_id FROM public.communities WHERE type='course' AND course_id=NEW.course_id;
    IF v_community_id IS NULL THEN
      INSERT INTO public.communities (type, course_id, campus_id, university_id, name, description)
      VALUES ('course', NEW.course_id, NEW.campus_id, NEW.university_id, v_course.name, 'Comunidade de ' || v_course.name)
      RETURNING id INTO v_community_id;
    END IF;
    INSERT INTO public.community_members (community_id, user_id) VALUES (v_community_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Period
  IF NEW.course_id IS NOT NULL AND NEW.current_period IS NOT NULL THEN
    SELECT id INTO v_community_id FROM public.communities
      WHERE type='period' AND course_id=NEW.course_id AND period_number=NEW.current_period;
    IF v_community_id IS NULL THEN
      INSERT INTO public.communities (type, course_id, campus_id, university_id, period_number, name, description)
      VALUES ('period', NEW.course_id, NEW.campus_id, NEW.university_id, NEW.current_period,
              NEW.current_period || 'º período',
              'Turma do ' || NEW.current_period || 'º período')
      RETURNING id INTO v_community_id;
    END IF;
    INSERT INTO public.community_members (community_id, user_id) VALUES (v_community_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profile_auto_communities ON public.profiles;
CREATE TRIGGER trg_profile_auto_communities
  AFTER INSERT OR UPDATE OF university_id, campus_id, course_id, current_period
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_auto_communities();

-- =============================================================
-- POSTS: SELECT policy considerando comunidades
-- =============================================================
DROP POLICY IF EXISTS "posts viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "posts select policy" ON public.posts;

CREATE POLICY "posts select policy" ON public.posts
  FOR SELECT USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id AND cm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Backfill: dispara auto-join para perfis já existentes que tenham vínculos
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id, university_id, campus_id, course_id, current_period
           FROM public.profiles
           WHERE university_id IS NOT NULL OR campus_id IS NOT NULL OR course_id IS NOT NULL
  LOOP
    UPDATE public.profiles SET updated_at = now() WHERE user_id = r.user_id;
  END LOOP;
END $$;
