
-- Add semester_label column to disciplines for named semesters like "2026.1"
ALTER TABLE public.disciplines ADD COLUMN IF NOT EXISTS semester_label TEXT;

-- Add profile fields for social/academic profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS career_goal TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS study_plans TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_semester_label TEXT DEFAULT '2026.1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_push BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_start_time TEXT DEFAULT '09:00';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_end_time TEXT DEFAULT '18:00';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'daily';

-- Create feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert feedback
CREATE POLICY "Users can insert feedback" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (true);
-- Users can view own feedback only
CREATE POLICY "Users can view own feedback" ON public.feedbacks FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_anonymous = true);
