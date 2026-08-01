-- 1. Torna a criação de perfil idempotente (dois triggers duplicados em auth.users causavam duplicate key -> 500 ao criar usuário)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, current_semester_label)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', '2026.1')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2. Blindagem: perfil da conta administrativa oficial nunca pode ser excluído
CREATE OR REPLACE FUNCTION public.tg_protect_official_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = OLD.user_id;
  IF v_email = 'eduflow.adm.academy@gmail.com' THEN
    RAISE EXCEPTION 'O perfil administrativo oficial do EduFlow nao pode ser excluido';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS protect_official_admin_profile ON public.profiles;
CREATE TRIGGER protect_official_admin_profile
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_official_admin_profile();

-- 3. Blindagem: papel de admin da conta oficial nunca pode ser removido
CREATE OR REPLACE FUNCTION public.tg_protect_official_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF OLD.role = 'admin'::public.app_role THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = OLD.user_id;
    IF v_email = 'eduflow.adm.academy@gmail.com' THEN
      RAISE EXCEPTION 'O papel de administrador da conta oficial do EduFlow nao pode ser removido';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS protect_official_admin_role ON public.user_roles;
CREATE TRIGGER protect_official_admin_role
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_official_admin_role();

REVOKE ALL ON FUNCTION public.tg_protect_official_admin_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_protect_official_admin_role() FROM PUBLIC, anon, authenticated;