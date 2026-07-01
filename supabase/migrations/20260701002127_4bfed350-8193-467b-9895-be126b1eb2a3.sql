
-- Extra courses (cursos extracurriculares)
CREATE TABLE public.extra_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  workload_hours INTEGER,
  certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_courses TO authenticated;
GRANT ALL ON public.extra_courses TO service_role;
ALTER TABLE public.extra_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_extra_courses" ON public.extra_courses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER extra_courses_updated_at BEFORE UPDATE ON public.extra_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Polls
CREATE TABLE public.post_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE UNIQUE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_polls TO authenticated;
GRANT SELECT ON public.post_polls TO anon;
GRANT ALL ON public.post_polls TO service_role;
ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls_read" ON public.post_polls FOR SELECT USING (true);
CREATE POLICY "polls_write_own" ON public.post_polls FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "polls_delete_own" ON public.post_polls FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);

CREATE TABLE public.post_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_poll_votes TO authenticated;
GRANT ALL ON public.post_poll_votes TO service_role;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_read" ON public.post_poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_own_insert" ON public.post_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_own_delete" ON public.post_poll_votes FOR DELETE USING (auth.uid() = user_id);

-- Extend posts for multiple media types
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Privacy settings on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_profile TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS privacy_dm TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS privacy_posts TEXT NOT NULL DEFAULT 'public';
