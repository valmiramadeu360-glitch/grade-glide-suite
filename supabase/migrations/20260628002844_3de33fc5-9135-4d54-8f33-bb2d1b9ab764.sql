
-- =============================================================
-- FASE 1: HIERARQUIA ACADÊMICA NACIONAL
-- =============================================================

-- Helper: tabela de roles (caso ainda não exista) para has_role
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'channel_admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users read own roles" ON public.user_roles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================================
-- UNIVERSITIES
-- =============================================================
CREATE TABLE public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  acronym TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT,
  kind TEXT NOT NULL DEFAULT 'public' CHECK (kind IN ('public','private')),
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (acronym, state)
);

GRANT SELECT ON public.universities TO authenticated, anon;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universities readable by everyone" ON public.universities
  FOR SELECT USING (true);
CREATE POLICY "universities admin write" ON public.universities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_universities_updated
  BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- CAMPUSES
-- =============================================================
CREATE TABLE public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

GRANT SELECT ON public.campuses TO authenticated, anon;
GRANT ALL ON public.campuses TO service_role;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campuses readable by everyone" ON public.campuses
  FOR SELECT USING (true);
CREATE POLICY "campuses admin write" ON public.campuses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_campuses_updated
  BEFORE UPDATE ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_campuses_university ON public.campuses(university_id);

-- =============================================================
-- COURSES
-- =============================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  degree TEXT NOT NULL DEFAULT 'graduacao' CHECK (degree IN ('tecnico','graduacao','especializacao','mestrado','doutorado')),
  area TEXT,
  total_periods INT DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campus_id, name, degree)
);

GRANT SELECT ON public.courses TO authenticated, anon;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses readable by everyone" ON public.courses
  FOR SELECT USING (true);
CREATE POLICY "courses admin write" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_courses_updated
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_courses_campus ON public.courses(campus_id);

-- =============================================================
-- COURSE PERIODS
-- =============================================================
CREATE TABLE public.course_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  number INT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, number)
);

GRANT SELECT ON public.course_periods TO authenticated, anon;
GRANT ALL ON public.course_periods TO service_role;
ALTER TABLE public.course_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods readable by everyone" ON public.course_periods
  FOR SELECT USING (true);
CREATE POLICY "periods admin write" ON public.course_periods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- SUBJECTS (catálogo nacional)
-- =============================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  period_number INT,
  name TEXT NOT NULL,
  code TEXT,
  workload_hours INT,
  syllabus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subjects TO authenticated, anon;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects readable by everyone" ON public.subjects
  FOR SELECT USING (true);
CREATE POLICY "subjects admin write" ON public.subjects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_subjects_updated
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_subjects_course ON public.subjects(course_id);

-- =============================================================
-- PROFILES: vínculos institucionais
-- =============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_period INT;

-- =============================================================
-- DISCIPLINES: vínculo opcional ao catálogo
-- =============================================================
ALTER TABLE public.disciplines
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- =============================================================
-- SEED: 20 universidades brasileiras de referência
-- =============================================================
INSERT INTO public.universities (name, acronym, state, city, kind, website) VALUES
  ('Universidade de São Paulo', 'USP', 'SP', 'São Paulo', 'public', 'https://www5.usp.br'),
  ('Universidade Estadual de Campinas', 'UNICAMP', 'SP', 'Campinas', 'public', 'https://www.unicamp.br'),
  ('Universidade Federal do Rio de Janeiro', 'UFRJ', 'RJ', 'Rio de Janeiro', 'public', 'https://ufrj.br'),
  ('Universidade Federal de Minas Gerais', 'UFMG', 'MG', 'Belo Horizonte', 'public', 'https://ufmg.br'),
  ('Universidade de Brasília', 'UnB', 'DF', 'Brasília', 'public', 'https://unb.br'),
  ('Universidade Federal de Pernambuco', 'UFPE', 'PE', 'Recife', 'public', 'https://ufpe.br'),
  ('Universidade Federal do Rio Grande do Sul', 'UFRGS', 'RS', 'Porto Alegre', 'public', 'https://ufrgs.br'),
  ('Universidade Federal de Santa Catarina', 'UFSC', 'SC', 'Florianópolis', 'public', 'https://ufsc.br'),
  ('Universidade Federal do Paraná', 'UFPR', 'PR', 'Curitiba', 'public', 'https://ufpr.br'),
  ('Universidade Federal da Bahia', 'UFBA', 'BA', 'Salvador', 'public', 'https://ufba.br'),
  ('Universidade Federal do Ceará', 'UFC', 'CE', 'Fortaleza', 'public', 'https://ufc.br'),
  ('Universidade Federal Fluminense', 'UFF', 'RJ', 'Niterói', 'public', 'https://uff.br'),
  ('Universidade Estadual Paulista', 'UNESP', 'SP', 'São Paulo', 'public', 'https://unesp.br'),
  ('Universidade Federal de São Paulo', 'UNIFESP', 'SP', 'São Paulo', 'public', 'https://unifesp.br'),
  ('Universidade Federal de São Carlos', 'UFSCar', 'SP', 'São Carlos', 'public', 'https://ufscar.br'),
  ('Pontifícia Universidade Católica de São Paulo', 'PUC-SP', 'SP', 'São Paulo', 'private', 'https://pucsp.br'),
  ('Pontifícia Universidade Católica do Rio de Janeiro', 'PUC-Rio', 'RJ', 'Rio de Janeiro', 'private', 'https://puc-rio.br'),
  ('Pontifícia Universidade Católica do Rio Grande do Sul', 'PUCRS', 'RS', 'Porto Alegre', 'private', 'https://pucrs.br'),
  ('Universidade Federal de Goiás', 'UFG', 'GO', 'Goiânia', 'public', 'https://ufg.br'),
  ('Universidade Federal do Pará', 'UFPA', 'PA', 'Belém', 'public', 'https://ufpa.br')
ON CONFLICT (acronym, state) DO NOTHING;
