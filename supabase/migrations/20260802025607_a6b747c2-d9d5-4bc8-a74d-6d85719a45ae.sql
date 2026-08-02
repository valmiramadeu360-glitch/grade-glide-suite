
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.ru_queue_level AS ENUM ('none','small','medium','large');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ru_meal AS ENUM ('lunch','dinner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RESTAURANTS
CREATE TABLE IF NOT EXISTS public.ru_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  lunch_start time,
  lunch_end time,
  dinner_start time,
  dinner_end time,
  is_open boolean NOT NULL DEFAULT true,
  closed_reason text,
  notice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ru_restaurants TO authenticated;
GRANT ALL ON public.ru_restaurants TO service_role;
ALTER TABLE public.ru_restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ru_restaurants_select" ON public.ru_restaurants;
CREATE POLICY "ru_restaurants_select" ON public.ru_restaurants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ru_restaurants_admin_all" ON public.ru_restaurants;
CREATE POLICY "ru_restaurants_admin_all" ON public.ru_restaurants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER ru_restaurants_updated_at BEFORE UPDATE ON public.ru_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DISTANCE HELPER (metros, haversine)
CREATE OR REPLACE FUNCTION public.ru_distance_meters(_lat1 numeric, _lon1 numeric, _lat2 numeric, _lon2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (6371000 * 2 * asin(sqrt(
    power(sin(radians(_lat2::float8 - _lat1::float8) / 2), 2) +
    cos(radians(_lat1::float8)) * cos(radians(_lat2::float8)) *
    power(sin(radians(_lon2::float8 - _lon1::float8) / 2), 2)
  )))::numeric
$$;

-- QUEUE REPORTS
CREATE TABLE IF NOT EXISTS public.ru_queue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.ru_restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level public.ru_queue_level NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  distance_meters numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ru_queue_reports_idx ON public.ru_queue_reports (restaurant_id, created_at DESC);
GRANT SELECT, INSERT ON public.ru_queue_reports TO authenticated;
GRANT ALL ON public.ru_queue_reports TO service_role;
ALTER TABLE public.ru_queue_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ru_queue_select" ON public.ru_queue_reports;
CREATE POLICY "ru_queue_select" ON public.ru_queue_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ru_queue_insert" ON public.ru_queue_reports;
CREATE POLICY "ru_queue_insert" ON public.ru_queue_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- valida geofence + rate limit no servidor
CREATE OR REPLACE FUNCTION public.tg_ru_queue_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; d numeric;
BEGIN
  SELECT * INTO r FROM public.ru_restaurants WHERE id = NEW.restaurant_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Restaurante nao encontrado'; END IF;

  d := public.ru_distance_meters(r.latitude, r.longitude, NEW.latitude, NEW.longitude);
  IF d > r.radius_meters THEN
    RAISE EXCEPTION 'Voce precisa estar proximo ao Restaurante Universitario para responder';
  END IF;
  NEW.distance_meters := d;

  IF EXISTS (
    SELECT 1 FROM public.ru_queue_reports
    WHERE user_id = NEW.user_id AND restaurant_id = NEW.restaurant_id
      AND created_at > now() - interval '3 minutes'
  ) THEN
    RAISE EXCEPTION 'Voce ja respondeu recentemente. Aguarde alguns minutos';
  END IF;

  RETURN NEW;
END; $$;
CREATE TRIGGER ru_queue_validate BEFORE INSERT ON public.ru_queue_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_ru_queue_validate();

-- MENUS
CREATE TABLE IF NOT EXISTS public.ru_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.ru_restaurants(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_date date NOT NULL DEFAULT current_date,
  meal public.ru_meal NOT NULL DEFAULT 'lunch',
  photo_url text,
  raw_text text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition jsonb,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ru_menus_idx ON public.ru_menus (restaurant_id, service_date DESC, meal);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ru_menus TO authenticated;
GRANT ALL ON public.ru_menus TO service_role;
ALTER TABLE public.ru_menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ru_menus_select" ON public.ru_menus;
CREATE POLICY "ru_menus_select" ON public.ru_menus FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ru_menus_insert" ON public.ru_menus;
CREATE POLICY "ru_menus_insert" ON public.ru_menus FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "ru_menus_update" ON public.ru_menus;
CREATE POLICY "ru_menus_update" ON public.ru_menus FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (auth.uid() = submitted_by OR public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS "ru_menus_delete" ON public.ru_menus;
CREATE POLICY "ru_menus_delete" ON public.ru_menus FOR DELETE TO authenticated
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER ru_menus_updated_at BEFORE UPDATE ON public.ru_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTICES (admin only)
CREATE TABLE IF NOT EXISTS public.ru_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.ru_restaurants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ru_notices TO authenticated;
GRANT ALL ON public.ru_notices TO service_role;
ALTER TABLE public.ru_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ru_notices_select" ON public.ru_notices;
CREATE POLICY "ru_notices_select" ON public.ru_notices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ru_notices_admin_all" ON public.ru_notices;
CREATE POLICY "ru_notices_admin_all" ON public.ru_notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER ru_notices_updated_at BEFORE UPDATE ON public.ru_notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RATINGS
CREATE TABLE IF NOT EXISTS public.ru_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.ru_restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT current_date,
  food smallint CHECK (food BETWEEN 1 AND 5),
  cleanliness smallint CHECK (cleanliness BETWEEN 1 AND 5),
  service smallint CHECK (service BETWEEN 1 AND 5),
  waiting smallint CHECK (waiting BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id, service_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ru_ratings TO authenticated;
GRANT ALL ON public.ru_ratings TO service_role;
ALTER TABLE public.ru_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ru_ratings_select_own" ON public.ru_ratings;
CREATE POLICY "ru_ratings_select_own" ON public.ru_ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS "ru_ratings_insert" ON public.ru_ratings;
CREATE POLICY "ru_ratings_insert" ON public.ru_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "ru_ratings_update_own" ON public.ru_ratings;
CREATE POLICY "ru_ratings_update_own" ON public.ru_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ru_ratings_delete_own" ON public.ru_ratings;
CREATE POLICY "ru_ratings_delete_own" ON public.ru_ratings FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER ru_ratings_updated_at BEFORE UPDATE ON public.ru_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STATUS AGREGADO COM PESO POR TEMPO
CREATE OR REPLACE FUNCTION public.ru_queue_status(_restaurant_id uuid)
RETURNS TABLE(level public.ru_queue_level, score numeric, confidence text, sample_size bigint, last_report_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (
    SELECT r.level,
           CASE
             WHEN r.created_at > now() - interval '2 minutes'  THEN 1.0
             WHEN r.created_at > now() - interval '5 minutes'  THEN 0.8
             WHEN r.created_at > now() - interval '10 minutes' THEN 0.5
             WHEN r.created_at > now() - interval '20 minutes' THEN 0.25
             ELSE 0
           END AS weight,
           r.created_at
    FROM public.ru_queue_reports r
    WHERE r.restaurant_id = _restaurant_id
      AND r.created_at > now() - interval '20 minutes'
      AND auth.uid() IS NOT NULL
  ), agg AS (
    SELECT
      SUM(weight) AS tw,
      SUM(weight * CASE level WHEN 'none' THEN 0 WHEN 'small' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END) AS ws,
      COUNT(*) FILTER (WHERE weight > 0) AS n,
      MAX(created_at) AS last_at
    FROM w
  )
  SELECT
    CASE
      WHEN COALESCE(tw,0) = 0 THEN NULL
      WHEN ws / tw < 0.5 THEN 'none'::public.ru_queue_level
      WHEN ws / tw < 1.5 THEN 'small'::public.ru_queue_level
      WHEN ws / tw < 2.4 THEN 'medium'::public.ru_queue_level
      ELSE 'large'::public.ru_queue_level
    END,
    CASE WHEN COALESCE(tw,0) = 0 THEN NULL ELSE round(ws / tw, 2) END,
    CASE WHEN COALESCE(n,0) = 0 THEN 'none' WHEN n < 3 THEN 'low' WHEN n < 8 THEN 'medium' ELSE 'high' END,
    COALESCE(n,0),
    last_at
  FROM agg;
$$;

-- HORARIOS DE PICO (media por hora nos ultimos 30 dias)
CREATE OR REPLACE FUNCTION public.ru_peak_hours(_restaurant_id uuid)
RETURNS TABLE(hour integer, avg_score numeric, reports bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(HOUR FROM (r.created_at AT TIME ZONE 'America/Maceio'))::int AS hour,
         round(AVG(CASE r.level WHEN 'none' THEN 0 WHEN 'small' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END), 2),
         COUNT(*)::bigint
  FROM public.ru_queue_reports r
  WHERE r.restaurant_id = _restaurant_id
    AND r.created_at > now() - interval '30 days'
    AND auth.uid() IS NOT NULL
  GROUP BY 1 ORDER BY 1;
$$;

-- MEDIAS DE AVALIACAO (agregado, sem exposicao individual)
CREATE OR REPLACE FUNCTION public.ru_rating_summary(_restaurant_id uuid)
RETURNS TABLE(food numeric, cleanliness numeric, service numeric, waiting numeric, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(AVG(food),2), round(AVG(cleanliness),2), round(AVG(service),2), round(AVG(waiting),2), COUNT(*)::bigint
  FROM public.ru_ratings
  WHERE restaurant_id = _restaurant_id
    AND created_at > now() - interval '30 days'
    AND auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.ru_queue_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ru_peak_hours(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ru_rating_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ru_distance_meters(numeric,numeric,numeric,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_ru_queue_validate() FROM anon, authenticated;

-- SEED: RU UFAL Campus A.C. Simoes
INSERT INTO public.ru_restaurants (campus_id, name, description, latitude, longitude, radius_meters, lunch_start, lunch_end, dinner_start, dinner_end)
SELECT c.id, 'Restaurante Universitario - UFAL', 'Campus A. C. Simoes (Maceio)', -9.551692, -35.771402, 100, '11:00', '14:00', '17:00', '19:00'
FROM public.campuses c
JOIN public.universities u ON u.id = c.university_id
WHERE u.acronym = 'UFAL' AND c.name ILIKE '%Sim%'
LIMIT 1;

INSERT INTO public.ru_restaurants (name, description, latitude, longitude, radius_meters, lunch_start, lunch_end, dinner_start, dinner_end)
SELECT 'Restaurante Universitario - UFAL', 'Campus A. C. Simoes (Maceio)', -9.551692, -35.771402, 100, '11:00', '14:00', '17:00', '19:00'
WHERE NOT EXISTS (SELECT 1 FROM public.ru_restaurants);
