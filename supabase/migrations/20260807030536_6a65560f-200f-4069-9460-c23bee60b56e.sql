-- ============ BIBLIOTECA: SALAS DE ESTUDO ============
CREATE TABLE public.library_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  has_power BOOLEAN NOT NULL DEFAULT true,
  has_whiteboard BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_rooms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.library_rooms TO authenticated;
GRANT ALL ON public.library_rooms TO service_role;
ALTER TABLE public.library_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_rooms_read" ON public.library_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "library_rooms_admin_write" ON public.library_rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.library_room_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.library_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('free','partial','full')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_library_room_reports_room ON public.library_room_reports(room_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_room_reports TO authenticated;
GRANT ALL ON public.library_room_reports TO service_role;
ALTER TABLE public.library_room_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_reports_read" ON public.library_room_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "library_reports_insert_own" ON public.library_room_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "library_reports_delete_own" ON public.library_room_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ TRANSPORTE CIRCULAR ============
CREATE TABLE public.transport_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'amber',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;
GRANT ALL ON public.transport_routes TO service_role;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_routes_read" ON public.transport_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_routes_admin_write" ON public.transport_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.transport_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_stops TO authenticated;
GRANT ALL ON public.transport_stops TO service_role;
ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_stops_read" ON public.transport_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_stops_admin_write" ON public.transport_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.transport_departures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES public.transport_stops(id) ON DELETE CASCADE,
  departure_time TIME NOT NULL,
  weekdays INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transport_departures_route ON public.transport_departures(route_id, departure_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_departures TO authenticated;
GRANT ALL ON public.transport_departures TO service_role;
ALTER TABLE public.transport_departures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_departures_read" ON public.transport_departures FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_departures_admin_write" ON public.transport_departures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.transport_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('on_time','delayed','crowded','no_show')),
  delay_minutes INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transport_reports_route ON public.transport_reports(route_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_reports TO authenticated;
GRANT ALL ON public.transport_reports TO service_role;
ALTER TABLE public.transport_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_reports_read" ON public.transport_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_reports_insert_own" ON public.transport_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transport_reports_delete_own" ON public.transport_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ EDITAIS DE BOLSAS / MONITORIAS ============
CREATE TABLE public.scholarship_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  organization TEXT,
  kind TEXT NOT NULL DEFAULT 'bolsa' CHECK (kind IN ('bolsa','monitoria','iniciacao_cientifica','extensao','estagio','outro')),
  description TEXT,
  courses TEXT[] NOT NULL DEFAULT '{}',
  stipend NUMERIC,
  workload_hours INTEGER,
  deadline DATE,
  official_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scholarship_calls_deadline ON public.scholarship_calls(is_active, deadline);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarship_calls TO authenticated;
GRANT ALL ON public.scholarship_calls TO service_role;
ALTER TABLE public.scholarship_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scholarship_calls_read" ON public.scholarship_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "scholarship_calls_admin_write" ON public.scholarship_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.scholarship_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.scholarship_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarship_saves TO authenticated;
GRANT ALL ON public.scholarship_saves TO service_role;
ALTER TABLE public.scholarship_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scholarship_saves_own" ON public.scholarship_saves FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ANTI-SPAM ============
CREATE OR REPLACE FUNCTION public.tg_campus_report_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'library_room_reports' THEN
    SELECT count(*) INTO recent_count FROM public.library_room_reports
      WHERE user_id = NEW.user_id AND created_at > now() - interval '2 minutes';
  ELSE
    SELECT count(*) INTO recent_count FROM public.transport_reports
      WHERE user_id = NEW.user_id AND created_at > now() - interval '2 minutes';
  END IF;

  IF recent_count > 0 THEN
    RAISE EXCEPTION 'Aguarde alguns minutos antes de enviar um novo relato.';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_campus_report_rate_limit() FROM anon, public;

CREATE TRIGGER tg_library_reports_rate_limit BEFORE INSERT ON public.library_room_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_campus_report_rate_limit();
CREATE TRIGGER tg_transport_reports_rate_limit BEFORE INSERT ON public.transport_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_campus_report_rate_limit();

-- ============ TRIGGERS updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_library_rooms_updated_at BEFORE UPDATE ON public.library_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_library_room_reports_updated_at BEFORE UPDATE ON public.library_room_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_routes_updated_at BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_stops_updated_at BEFORE UPDATE ON public.transport_stops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_departures_updated_at BEFORE UPDATE ON public.transport_departures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_reports_updated_at BEFORE UPDATE ON public.transport_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scholarship_calls_updated_at BEFORE UPDATE ON public.scholarship_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scholarship_saves_updated_at BEFORE UPDATE ON public.scholarship_saves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.library_room_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_reports;