-- ============================================================
-- EduConect - Correção do acesso do fundador à redação
-- ============================================================
--
-- Problema corrigido:
--
-- Quando um estudante cria um jornal e o administrador aprova
-- a solicitação, o fundador precisa automaticamente receber
-- acesso editorial à redação.
--
-- Esta migration:
--
-- 1. Corrige redações antigas que já estão aprovadas;
-- 2. Garante que o fundador seja editor-chefe;
-- 3. Cria um trigger para novas aprovações;
-- 4. É idempotente e pode ser executada sem duplicar membros.
--
-- Não remove jornais recusados.
-- ============================================================


-- ============================================================
-- 1. Corrigir redações que já foram aprovadas
-- ============================================================

INSERT INTO public.news_channel_members (
  channel_id,
  user_id,
  role
)
SELECT
  id,
  created_by,
  'editor_in_chief'
FROM public.news_channels
WHERE status = 'approved'
  AND created_by IS NOT NULL
ON CONFLICT (channel_id, user_id)
DO UPDATE SET
  role = 'editor_in_chief';


-- ============================================================
-- 2. Função executada automaticamente após aprovação
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_news_channel_approved_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  /*
   * Quando uma redação é aprovada, o fundador passa a ser
   * automaticamente o editor-chefe.
   *
   * Também funciona para INSERT caso uma redação seja criada
   * diretamente com status approved por uma operação autorizada.
   */
  IF NEW.status = 'approved'
     AND NEW.created_by IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR TG_OP = 'INSERT'
     )
  THEN

    INSERT INTO public.news_channel_members (
      channel_id,
      user_id,
      role
    )
    VALUES (
      NEW.id,
      NEW.created_by,
      'editor_in_chief'
    )

    ON CONFLICT (channel_id, user_id)
    DO UPDATE SET
      role = 'editor_in_chief';

  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 3. Restringir execução direta da função
-- ============================================================

REVOKE EXECUTE
ON FUNCTION public.tg_news_channel_approved_membership()
FROM public, anon, authenticated;


-- ============================================================
-- 4. Criar/recriar trigger
-- ============================================================

DROP TRIGGER IF EXISTS
  trg_news_channel_approved_membership
ON public.news_channels;


CREATE TRIGGER
  trg_news_channel_approved_membership
AFTER INSERT OR UPDATE OF status
ON public.news_channels
FOR EACH ROW
EXECUTE FUNCTION
  public.tg_news_channel_approved_membership();
