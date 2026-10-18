-- =============================================================
-- EDUCONNECT
-- FASE 1 — ESTRUTURA ACADÊMICA E BASE PARA COMUNIDADES
-- =============================================================
--
-- Esta migration é ADITIVA.
-- Não remove tabelas, colunas ou políticas existentes.
-- A estrutura atual do aplicativo continua funcionando.
--
-- Hierarquia planejada:
--
-- Instituição
--   └── Campus
--       └── Unidade acadêmica
--           └── Curso
--               └── Coorte/Turma
--
-- Comunidades oficiais poderão posteriormente apontar
-- para qualquer um desses níveis.
-- =============================================================


-- =============================================================
-- 1. UNIDADES ACADÊMICAS
-- =============================================================
--
-- Exemplos:
-- FEAC
-- Instituto de Matemática
-- Instituto de Computação
-- Centro de Ciências Agrárias
--
-- Uma unidade pertence a um campus.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.academic_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campus_id UUID NOT NULL
    REFERENCES public.campuses(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  acronym TEXT,

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT academic_units_name_not_empty
    CHECK (length(trim(name)) > 0)
);


-- Evita duas unidades com o mesmo nome dentro do mesmo campus.
CREATE UNIQUE INDEX IF NOT EXISTS
  uniq_academic_units_campus_name
ON public.academic_units (
  campus_id,
  lower(trim(name))
);


-- Busca rápida das unidades de um campus.
CREATE INDEX IF NOT EXISTS
  idx_academic_units_campus
ON public.academic_units(campus_id);


-- =============================================================
-- 2. COORTES / TURMAS
-- =============================================================
--
-- "Período atual" e "turma/coorte" são coisas diferentes.
--
-- Exemplo:
--
-- Curso: Ciências Econômicas
--
-- Entrada 2025.1
-- Turma A
--
-- Entrada 2025.1
-- Turma B
--
-- O estudante pode estar no 4º período atualmente,
-- mas isso não significa que todos os estudantes do 4º
-- período pertençam à mesma turma.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.academic_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  course_id UUID NOT NULL
    REFERENCES public.courses(id)
    ON DELETE CASCADE,

  -- Semestre em que a coorte entrou.
  -- Exemplos: 2025.1, 2025.2, 2026.1
  entry_semester TEXT,

  -- Identificação opcional da turma.
  -- Exemplos: A, B, Noturno, 01.
  class_section TEXT,

  name TEXT NOT NULL,

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT academic_cohorts_name_not_empty
    CHECK (length(trim(name)) > 0)
);


-- Evita duplicação da mesma coorte/turma.
CREATE UNIQUE INDEX IF NOT EXISTS
  uniq_academic_cohort
ON public.academic_cohorts (
  course_id,
  entry_semester,
  class_section
);


-- Busca rápida das coortes de um curso.
CREATE INDEX IF NOT EXISTS
  idx_academic_cohorts_course
ON public.academic_cohorts(course_id);


-- =============================================================
-- 3. NOVOS VÍNCULOS ACADÊMICOS NO PERFIL
-- =============================================================
--
-- IMPORTANTE:
-- Todas estas informações são opcionais.
--
-- O usuário pode utilizar o EduConect mesmo sem preencher
-- tudo.
--
-- NULL significa "ainda não informado".
--
-- Não vamos transformar isso em obrigação nesta migration.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_unit_id UUID
    REFERENCES public.academic_units(id)
    ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cohort_id UUID
    REFERENCES public.academic_cohorts(id)
    ON DELETE SET NULL;

-- Semestre em que o usuário entrou na instituição/curso.
-- Mantemos como texto para suportar formatos como:
-- 2025.1
-- 2025.2
-- 2026.1
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entry_semester TEXT;

-- Identificação da turma, quando conhecida.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_section TEXT;


-- Índices para consultas de agrupamento.
CREATE INDEX IF NOT EXISTS
  idx_profiles_academic_unit
ON public.profiles(academic_unit_id);

CREATE INDEX IF NOT EXISTS
  idx_profiles_cohort
ON public.profiles(cohort_id);

CREATE INDEX IF NOT EXISTS
  idx_profiles_entry_semester
ON public.profiles(entry_semester);


-- =============================================================
-- 4. VÍNCULOS ACADÊMICOS NAS COMUNIDADES
-- =============================================================
--
-- Não vamos substituir os campos atuais.
--
-- university_id, campus_id e course_id continuam existindo.
--
-- Apenas acrescentamos níveis novos.
-- =============================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS academic_unit_id UUID
    REFERENCES public.academic_units(id)
    ON DELETE CASCADE;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS cohort_id UUID
    REFERENCES public.academic_cohorts(id)
    ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS
  idx_communities_academic_unit
ON public.communities(academic_unit_id);

CREATE INDEX IF NOT EXISTS
  idx_communities_cohort
ON public.communities(cohort_id);


-- =============================================================
-- 5. METADADOS INSTITUCIONAIS DA COMUNIDADE
-- =============================================================
--
-- Essas informações serão utilizadas posteriormente
-- pela administração institucional.
--
-- Não ativamos ainda a administração institucional.
-- Apenas criamos os campos necessários.
-- =============================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN
    NOT NULL DEFAULT false;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
    NOT NULL DEFAULT false;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS allow_member_posts BOOLEAN
    NOT NULL DEFAULT true;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS allow_member_discussions BOOLEAN
    NOT NULL DEFAULT true;


-- =============================================================
-- 6. CONFIGURAÇÕES BÁSICAS DA COMUNIDADE
-- =============================================================
--
-- Mantemos configurações separadas da tabela principal.
-- Isso evita transformar "communities" em uma tabela gigante
-- cheia de configurações.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.community_settings (
  community_id UUID PRIMARY KEY
    REFERENCES public.communities(id)
    ON DELETE CASCADE,

  -- A comunidade oficial não terá um chat geral obrigatório.
  -- Este campo permitirá habilitar/desabilitar conversas
  -- quando necessário.
  chat_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Discussões organizadas são diferentes de chat.
  discussions_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Permite que administradores institucionais publiquem.
  announcements_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Permite eventos.
  events_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Permite notícias/canais relacionados.
  news_enabled BOOLEAN NOT NULL DEFAULT true,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================
-- 7. FUNÇÃO PARA CRIAR CONFIGURAÇÕES PADRÃO
-- =============================================================

CREATE OR REPLACE FUNCTION public.tg_create_community_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  INSERT INTO public.community_settings (
    community_id
  )
  VALUES (
    NEW.id
  )
  ON CONFLICT (community_id) DO NOTHING;

  RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_create_community_settings
ON public.communities;

CREATE TRIGGER trg_create_community_settings
AFTER INSERT ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.tg_create_community_settings();


-- =============================================================
-- 8. CRIA CONFIGURAÇÕES PARA COMUNIDADES JÁ EXISTENTES
-- =============================================================

INSERT INTO public.community_settings (
  community_id
)
SELECT id
FROM public.communities
ON CONFLICT (community_id) DO NOTHING;


-- =============================================================
-- 9. ADMINISTRADORES DE COMUNIDADES
-- =============================================================
--
-- Diferente de user_roles.
--
-- user_roles controla funções globais do EduConect.
--
-- community_admins controla quem administra UMA determinada
-- comunidade.
--
-- Exemplo:
--
-- UFAL
--   └── administrador institucional da UFAL
--
-- FEAC
--   └── administrador institucional da FEAC
--
-- Um administrador da FEAC não recebe automaticamente
-- poderes sobre toda a UFAL.
-- =============================================================

DO $$
BEGIN

  CREATE TYPE public.community_admin_role AS ENUM (
    'owner',
    'admin',
    'moderator',
    'editor'
  );

EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;


CREATE TABLE IF NOT EXISTS public.community_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  community_id UUID NOT NULL
    REFERENCES public.communities(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  role public.community_admin_role NOT NULL DEFAULT 'moderator',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (community_id, user_id)
);


CREATE INDEX IF NOT EXISTS
  idx_community_admins_user
ON public.community_admins(user_id);

CREATE INDEX IF NOT EXISTS
  idx_community_admins_community
ON public.community_admins(community_id);


-- =============================================================
-- 10. RLS — UNIDADES
-- =============================================================

ALTER TABLE public.academic_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "academic_units_read_authenticated"
ON public.academic_units;

CREATE POLICY
  "academic_units_read_authenticated"
ON public.academic_units
FOR SELECT
TO authenticated
USING (true);


-- Somente administradores globais do EduConect podem
-- cadastrar/alterar a estrutura acadêmica nesta primeira fase.

DROP POLICY IF EXISTS
  "academic_units_admin_write"
ON public.academic_units;

CREATE POLICY
  "academic_units_admin_write"
ON public.academic_units
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================================
-- 11. RLS — COORTES
-- =============================================================

ALTER TABLE public.academic_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "academic_cohorts_read_authenticated"
ON public.academic_cohorts;

CREATE POLICY
  "academic_cohorts_read_authenticated"
ON public.academic_cohorts
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS
  "academic_cohorts_admin_write"
ON public.academic_cohorts;

CREATE POLICY
  "academic_cohorts_admin_write"
ON public.academic_cohorts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================================
-- 12. RLS — CONFIGURAÇÕES DA COMUNIDADE
-- =============================================================

ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS
  "community_settings_read_members"
ON public.community_settings;

CREATE POLICY
  "community_settings_read_members"
ON public.community_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.community_id = community_settings.community_id
      AND cm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);


-- Por enquanto somente administradores globais alteram.
-- A próxima etapa adicionará administradores institucionais
-- com permissões específicas.

DROP POLICY IF EXISTS
  "community_settings_admin_write"
ON public.community_settings;

CREATE POLICY
  "community_settings_admin_write"
ON public.community_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================================
-- 13. RLS — ADMINISTRADORES DA COMUNIDADE
-- =============================================================

ALTER TABLE public.community_admins ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS
  "community_admins_read_members"
ON public.community_admins;

CREATE POLICY
  "community_admins_read_members"
ON public.community_admins
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.community_id = community_admins.community_id
      AND cm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);


-- Nesta primeira migration, somente administrador global
-- pode conceder administração institucional.
--
-- Na próxima etapa vamos criar a função segura que permitirá
-- ao EduConect delegar a administração para uma instituição.

DROP POLICY IF EXISTS
  "community_admins_global_admin_write"
ON public.community_admins;

CREATE POLICY
  "community_admins_global_admin_write"
ON public.community_admins
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================================
-- 14. TRIGGER DE updated_at
-- =============================================================

DROP TRIGGER IF EXISTS
  trg_academic_units_updated
ON public.academic_units;

CREATE TRIGGER
  trg_academic_units_updated
BEFORE UPDATE ON public.academic_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS
  trg_academic_cohorts_updated
ON public.academic_cohorts;

CREATE TRIGGER
  trg_academic_cohorts_updated
BEFORE UPDATE ON public.academic_cohorts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS
  trg_community_settings_updated
ON public.community_settings;

CREATE TRIGGER
  trg_community_settings_updated
BEFORE UPDATE ON public.community_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- 15. GARANTIAS DE ACESSO
-- =============================================================

GRANT SELECT ON public.academic_units
TO authenticated;

GRANT SELECT ON public.academic_cohorts
TO authenticated;

GRANT SELECT ON public.community_settings
TO authenticated;

GRANT SELECT ON public.community_admins
TO authenticated;

GRANT ALL ON public.academic_units
TO service_role;

GRANT ALL ON public.academic_cohorts
TO service_role;

GRANT ALL ON public.community_settings
TO service_role;

GRANT ALL ON public.community_admins
TO service_role;


-- =============================================================
-- FIM DA FASE 1
-- =============================================================
--
-- Nenhuma comunidade existente é apagada.
-- Nenhum membro existente é removido.
-- Nenhum post existente é alterado.
-- Nenhuma mensagem existente é alterada.
-- Nenhuma tela existente é modificada.
--
-- A próxima etapa poderá começar a preencher a hierarquia
-- acadêmica e conectar o onboarding a ela.
-- =============================================================
