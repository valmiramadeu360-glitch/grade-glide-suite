CREATE TABLE public.weekly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  week_start DATE NOT NULL DEFAULT (date_trunc('week', now())::date),
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
GRANT ALL ON public.weekly_goals TO service_role;

ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_goals_select_own" ON public.weekly_goals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "weekly_goals_insert_own" ON public.weekly_goals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "weekly_goals_update_own" ON public.weekly_goals
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "weekly_goals_delete_own" ON public.weekly_goals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX weekly_goals_user_week_idx ON public.weekly_goals (user_id, week_start);

CREATE TRIGGER update_weekly_goals_updated_at
  BEFORE UPDATE ON public.weekly_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();