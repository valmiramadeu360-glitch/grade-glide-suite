-- =========================================
-- 1) RU: relatos colaborativos de fila
-- =========================================
CREATE TABLE IF NOT EXISTS public.ru_status_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  status_level text NOT NULL CHECK (status_level IN ('fast','moderate','slow')),
  estimated_minutes integer NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0 AND estimated_minutes <= 240),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ru_status_reports_created_at_idx ON public.ru_status_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS ru_status_reports_campus_idx ON public.ru_status_reports (campus_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.ru_status_reports TO authenticated;
GRANT ALL ON public.ru_status_reports TO service_role;

ALTER TABLE public.ru_status_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alunos logados podem ver o status do RU"
ON public.ru_status_reports FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Alunos podem relatar o status do RU"
ON public.ru_status_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

CREATE POLICY "Autor ou admin pode remover o relato"
ON public.ru_status_reports FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================
-- 2) Comunidade da turma: isolamento por código SIGA
-- =========================================
CREATE OR REPLACE FUNCTION public.owns_discipline_code(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.disciplines d
    WHERE d.user_id = _user_id
      AND COALESCE(d.archived, false) = false
      AND upper(btrim(d.code)) = upper(btrim(_code))
  )
$$;
REVOKE ALL ON FUNCTION public.owns_discipline_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_discipline_code(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Leitura de mensagens da turma" ON public.discipline_community_messages;
DROP POLICY IF EXISTS "Envio de mensagens da turma" ON public.discipline_community_messages;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='discipline_community_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.discipline_community_messages', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Apenas alunos da turma podem ler as mensagens"
ON public.discipline_community_messages FOR SELECT TO authenticated
USING (
  public.owns_discipline_code(auth.uid(), discipline_code)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Apenas alunos da turma podem enviar mensagens"
ON public.discipline_community_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_user_banned(auth.uid())
  AND public.owns_discipline_code(auth.uid(), discipline_code)
);

CREATE POLICY "Autor ou admin pode apagar a mensagem"
ON public.discipline_community_messages FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Relação com profiles para exibir codinome/nome (embed do Data API)
ALTER TABLE public.discipline_community_messages
  DROP CONSTRAINT IF EXISTS discipline_community_messages_profile_fkey;
ALTER TABLE public.discipline_community_messages
  ADD CONSTRAINT discipline_community_messages_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;