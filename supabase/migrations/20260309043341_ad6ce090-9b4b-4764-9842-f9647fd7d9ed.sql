
-- Allow authenticated users to read any profile (needed for social feed)
CREATE POLICY "Authenticated users can view any profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
