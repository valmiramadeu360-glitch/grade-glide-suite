
-- Add display name customization to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS hide_name BOOLEAN NOT NULL DEFAULT false;

-- Admin announcements (used in dashboard carousel: news, polls, notices)
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'notice',
  cta_label TEXT,
  cta_url TEXT,
  poll_options JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_announcements TO authenticated;
GRANT ALL ON public.admin_announcements TO service_role;

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone authenticated can read active announcements"
  ON public.admin_announcements FOR SELECT
  TO authenticated
  USING (active = true AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Admins can insert announcements"
  ON public.admin_announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
  ON public.admin_announcements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
  ON public.admin_announcements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_admin_announcements_updated
  BEFORE UPDATE ON public.admin_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Poll votes for announcements
CREATE TABLE IF NOT EXISTS public.announcement_poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.announcement_poll_votes TO authenticated;
GRANT ALL ON public.announcement_poll_votes TO service_role;

ALTER TABLE public.announcement_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all votes"
  ON public.announcement_poll_votes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can vote once"
  ON public.announcement_poll_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote"
  ON public.announcement_poll_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
