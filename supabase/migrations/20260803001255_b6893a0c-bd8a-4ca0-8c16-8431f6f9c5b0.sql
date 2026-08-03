-- ============ 1) Admin access ============
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Admins manage roles (official admin account still protected by existing triggers)
DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins grant roles" ON public.user_roles;
CREATE POLICY "admins grant roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins revoke roles" ON public.user_roles;
CREATE POLICY "admins revoke roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ 2) RU menus: dedup + meal detection metadata ============
ALTER TABLE public.ru_menus
  ADD COLUMN IF NOT EXISTS photo_hash text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.ru_menus(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmations integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nutrition_source text,
  ADD COLUMN IF NOT EXISTS detected_meal text,
  ADD COLUMN IF NOT EXISTS detected_date date;

CREATE INDEX IF NOT EXISTS ru_menus_hash_idx
  ON public.ru_menus (restaurant_id, service_date, meal, photo_hash);

-- Returns the canonical menu for a photo fingerprint, if already submitted
CREATE OR REPLACE FUNCTION public.ru_find_menu_by_hash(_restaurant_id uuid, _photo_hash text)
RETURNS TABLE(id uuid, service_date date, meal public.ru_meal, raw_text text, items jsonb, nutrition jsonb, confirmations integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.service_date, m.meal, m.raw_text, m.items, m.nutrition, m.confirmations
  FROM public.ru_menus m
  WHERE m.restaurant_id = _restaurant_id
    AND _photo_hash IS NOT NULL
    AND m.photo_hash = _photo_hash
    AND m.duplicate_of IS NULL
    AND auth.uid() IS NOT NULL
  ORDER BY m.created_at ASC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.ru_find_menu_by_hash(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ru_find_menu_by_hash(uuid, text) TO authenticated, service_role;

-- Submits a menu: identical photo => confirms canonical entry and reuses its nutrition,
-- different photo for same meal => stored as a variation linked to the canonical entry.
CREATE OR REPLACE FUNCTION public.ru_submit_menu(
  _restaurant_id uuid,
  _service_date date,
  _meal public.ru_meal,
  _photo_url text,
  _photo_hash text,
  _raw_text text,
  _items jsonb,
  _nutrition jsonb,
  _detected_meal text DEFAULT NULL,
  _detected_date date DEFAULT NULL
)
RETURNS TABLE(menu_id uuid, was_duplicate boolean, confirmations integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _canonical public.ru_menus;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado para enviar o cardápio';
  END IF;

  -- Same photo already registered: just confirm it (keeps one nutrition estimate)
  IF _photo_hash IS NOT NULL THEN
    SELECT * INTO _canonical FROM public.ru_menus
    WHERE restaurant_id = _restaurant_id AND photo_hash = _photo_hash AND duplicate_of IS NULL
    ORDER BY created_at ASC LIMIT 1;

    IF _canonical.id IS NOT NULL THEN
      UPDATE public.ru_menus
      SET confirmations = confirmations + 1, updated_at = now()
      WHERE id = _canonical.id
      RETURNING id, confirmations INTO menu_id, confirmations;
      was_duplicate := true;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Another photo for the same meal: keep it, but link as a variation
  SELECT * INTO _canonical FROM public.ru_menus
  WHERE restaurant_id = _restaurant_id AND service_date = _service_date
    AND meal = _meal AND duplicate_of IS NULL
  ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.ru_menus (
    restaurant_id, submitted_by, service_date, meal, photo_url, photo_hash,
    raw_text, items, nutrition, nutrition_source, detected_meal, detected_date,
    duplicate_of
  ) VALUES (
    _restaurant_id, _uid, _service_date, _meal, _photo_url, _photo_hash,
    _raw_text, COALESCE(_items, '[]'::jsonb),
    COALESCE(_nutrition, _canonical.nutrition),
    CASE WHEN _nutrition IS NULL AND _canonical.nutrition IS NOT NULL THEN 'reused' ELSE 'ai' END,
    _detected_meal, _detected_date,
    _canonical.id
  ) RETURNING id INTO _new_id;

  menu_id := _new_id;
  was_duplicate := _canonical.id IS NOT NULL;
  confirmations := 1;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ru_submit_menu(uuid, date, public.ru_meal, text, text, text, jsonb, jsonb, text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ru_submit_menu(uuid, date, public.ru_meal, text, text, text, jsonb, jsonb, text, date) TO authenticated, service_role;

-- ============ 3) RU admin management ============
DROP POLICY IF EXISTS "admins manage ru notices" ON public.ru_notices;
CREATE POLICY "admins manage ru notices" ON public.ru_notices
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins manage ru restaurants" ON public.ru_restaurants;
CREATE POLICY "admins manage ru restaurants" ON public.ru_restaurants
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));