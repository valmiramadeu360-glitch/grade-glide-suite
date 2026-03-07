
-- Fix the overly permissive insert policy on feedbacks
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedbacks;
CREATE POLICY "Authenticated users can insert feedback" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR is_anonymous = true);
