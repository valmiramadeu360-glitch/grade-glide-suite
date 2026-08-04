-- 1. community_members roster exposure
CREATE OR REPLACE FUNCTION public.is_community_member(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = _community_id AND cm.user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_community_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "members readable by everyone" ON public.community_members;

CREATE POLICY "members readable by same community"
ON public.community_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_member(community_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. discipline_community_messages cross-institution code collision
CREATE OR REPLACE FUNCTION public.shares_institution(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _a IS NULL OR _b IS NULL THEN false
    WHEN _a = _b THEN true
    ELSE COALESCE((
      SELECT (pa.course_id IS NOT NULL AND pa.course_id = pb.course_id)
          OR (pa.course_id IS NULL AND pb.course_id IS NULL
              AND pa.university_id IS NOT NULL AND pa.university_id = pb.university_id)
      FROM public.profiles pa, public.profiles pb
      WHERE pa.user_id = _a AND pb.user_id = _b
    ), false)
  END
$$;

REVOKE ALL ON FUNCTION public.shares_institution(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_institution(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Apenas alunos da turma podem ler as mensagens" ON public.discipline_community_messages;

CREATE POLICY "Apenas alunos da turma podem ler as mensagens"
ON public.discipline_community_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.owns_discipline_code(auth.uid(), discipline_code)
    AND public.shares_institution(auth.uid(), user_id)
  )
);

-- 3. Public bucket allows listing (campus-photos)
DROP POLICY IF EXISTS "Qualquer um vê as fotos dos prédios do campus" ON storage.objects;

CREATE POLICY "campus_photos_list_admin_only"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'campus-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
