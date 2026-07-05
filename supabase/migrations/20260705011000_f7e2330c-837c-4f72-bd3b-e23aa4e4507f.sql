
-- Backfill: garante papel admin para a conta oficial existente
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'eduflow.adm.academy@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger: concede admin automaticamente ao criar/confirmar essa conta
CREATE OR REPLACE FUNCTION public.grant_admin_for_official_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'eduflow.adm.academy@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_official_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_official_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_official_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_official_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_official_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_official_email();
