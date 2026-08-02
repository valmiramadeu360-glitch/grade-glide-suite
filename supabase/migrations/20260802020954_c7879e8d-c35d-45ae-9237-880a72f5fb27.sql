DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedbacks;

CREATE POLICY "Users can view own feedback"
ON public.feedbacks FOR SELECT TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
ON public.feedbacks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can insert own or anonymous feedback"
ON public.feedbacks FOR INSERT TO authenticated
WITH CHECK (
  (is_anonymous = false AND auth.uid() = user_id)
  OR (is_anonymous = true AND user_id IS NULL AND email IS NULL)
);

CREATE OR REPLACE FUNCTION public.tg_feedbacks_scrub_anonymous()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_anonymous THEN
    NEW.user_id := NULL;
    NEW.email := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedbacks_scrub_anonymous ON public.feedbacks;
CREATE TRIGGER trg_feedbacks_scrub_anonymous
BEFORE INSERT OR UPDATE ON public.feedbacks
FOR EACH ROW EXECUTE FUNCTION public.tg_feedbacks_scrub_anonymous();