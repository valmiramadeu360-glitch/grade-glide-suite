import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ---------------- Tipos ---------------- */
export type RoomStatus = "free" | "partial" | "full";
export type TransportStatus = "on_time" | "delayed" | "crowded" | "no_show";

export interface LibraryRoom {
  id: string;
  name: string;
  floor: string | null;
  capacity: number;
  has_power: boolean;
  has_whiteboard: boolean;
  description: string | null;
  is_active: boolean;
}

export interface RoomReport {
  id: string;
  room_id: string;
  status: RoomStatus;
  note: string | null;
  created_at: string;
}

export interface TransportRoute {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
}

export interface TransportStop {
  id: string;
  route_id: string;
  name: string;
  position: number;
}

export interface TransportDeparture {
  id: string;
  route_id: string;
  stop_id: string | null;
  departure_time: string;
  weekdays: number[];
}

export interface TransportReport {
  id: string;
  route_id: string;
  status: TransportStatus;
  delay_minutes: number | null;
  note: string | null;
  created_at: string;
}

export interface ScholarshipCall {
  id: string;
  title: string;
  organization: string | null;
  kind: string;
  description: string | null;
  courses: string[];
  stipend: number | null;
  workload_hours: number | null;
  deadline: string | null;
  official_url: string | null;
  is_active: boolean;
}

/* ---------------- Metadados de UI ---------------- */
export const ROOM_STATUS_META: Record<RoomStatus, { label: string; classes: string; dot: string }> = {
  free: { label: "Livre", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500" },
  partial: { label: "Parcial", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500" },
  full: { label: "Cheia", classes: "bg-rose-500/10 text-rose-600 border-rose-500/20", dot: "bg-rose-500" },
};

export const TRANSPORT_STATUS_META: Record<TransportStatus, { label: string; classes: string }> = {
  on_time: { label: "No horário", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  delayed: { label: "Atrasado", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  crowded: { label: "Cheio", classes: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  no_show: { label: "Não apareceu", classes: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
};

export const SCHOLARSHIP_KIND_LABEL: Record<string, string> = {
  bolsa: "Bolsa",
  monitoria: "Monitoria",
  iniciacao_cientifica: "Iniciação Científica",
  extensao: "Extensão",
  estagio: "Estágio",
  outro: "Outro",
};

/** Relato mais recente (últimas 2h) por sala. */
function latestByKey<T extends { created_at: string }>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    const current = map.get(k);
    if (!current || new Date(row.created_at) > new Date(current.created_at)) map.set(k, row);
  }
  return map;
}

/* ---------------- Biblioteca ---------------- */
export function useLibraryRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<LibraryRoom[]>([]);
  const [reports, setReports] = useState<RoomReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 1000 * 60 * 120).toISOString();
    const [roomsRes, reportsRes] = await Promise.all([
      supabase.from("library_rooms").select("*").eq("is_active", true).order("name"),
      supabase.from("library_room_reports").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    setRooms((roomsRes.data ?? []) as LibraryRoom[]);
    setReports((reportsRes.data ?? []) as RoomReport[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("library_room_reports_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "library_room_reports" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const latest = latestByKey(reports, (r) => r.room_id);

  const report = useCallback(
    async (roomId: string, status: RoomStatus, note?: string) => {
      if (!user) return;
      const { error } = await supabase.from("library_room_reports").insert({
        room_id: roomId,
        user_id: user.id,
        status,
        note: note?.trim() || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Obrigado! Status atualizado para a turma.");
      void load();
    },
    [user, load],
  );

  return { rooms, reports, latest, loading, report, reload: load };
}

/* ---------------- Transporte ---------------- */
export function useTransport() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [departures, setDepartures] = useState<TransportDeparture[]>([]);
  const [reports, setReports] = useState<TransportReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 1000 * 60 * 180).toISOString();
    const [routesRes, stopsRes, depRes, repRes] = await Promise.all([
      supabase.from("transport_routes").select("*").eq("is_active", true).order("name"),
      supabase.from("transport_stops").select("*").order("position"),
      supabase.from("transport_departures").select("*").order("departure_time"),
      supabase.from("transport_reports").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    setRoutes((routesRes.data ?? []) as TransportRoute[]);
    setStops((stopsRes.data ?? []) as TransportStop[]);
    setDepartures((depRes.data ?? []) as TransportDeparture[]);
    setReports((repRes.data ?? []) as TransportReport[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("transport_reports_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_reports" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const latest = latestByKey(reports, (r) => r.route_id);

  const report = useCallback(
    async (routeId: string, status: TransportStatus, delayMinutes?: number, note?: string) => {
      if (!user) return;
      const { error } = await supabase.from("transport_reports").insert({
        route_id: routeId,
        user_id: user.id,
        status,
        delay_minutes: status === "delayed" ? delayMinutes ?? null : null,
        note: note?.trim() || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Relato enviado. Valeu por ajudar!");
      void load();
    },
    [user, load],
  );

  return { routes, stops, departures, reports, latest, loading, report, reload: load };
}

/** Próximas saídas de hoje para uma rota. */
export function nextDepartures(departures: TransportDeparture[], routeId: string, limit = 4) {
  const now = new Date();
  const weekday = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return departures
    .filter((d) => d.route_id === routeId && (d.weekdays ?? []).includes(weekday))
    .map((d) => {
      const [h, m] = d.departure_time.split(":");
      return { ...d, minutes: Number(h) * 60 + Number(m) };
    })
    .filter((d) => d.minutes >= nowMinutes - 5)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, limit);
}

/* ---------------- Editais ---------------- */
export function useScholarships() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<ScholarshipCall[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [callsRes, savesRes] = await Promise.all([
      supabase.from("scholarship_calls").select("*").eq("is_active", true).order("deadline", { ascending: true }),
      user ? supabase.from("scholarship_saves").select("call_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { call_id: string }[] }),
    ]);
    setCalls((callsRes.data ?? []) as ScholarshipCall[]);
    setSavedIds(((savesRes.data ?? []) as { call_id: string }[]).map((s) => s.call_id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = useCallback(
    async (callId: string) => {
      if (!user) return;
      if (savedIds.includes(callId)) {
        await supabase.from("scholarship_saves").delete().eq("call_id", callId).eq("user_id", user.id);
        setSavedIds((prev) => prev.filter((id) => id !== callId));
      } else {
        const { error } = await supabase.from("scholarship_saves").insert({ call_id: callId, user_id: user.id });
        if (error) {
          toast.error(error.message);
          return;
        }
        setSavedIds((prev) => [...prev, callId]);
        toast.success("Edital salvo nos seus interesses.");
      }
    },
    [user, savedIds],
  );

  return { calls, savedIds, loading, toggleSave, reload: load };
}

/** Verifica papel de administrador no servidor. */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      if (active) setIsAdmin(!!data);
    }
    void check();
    return () => {
      active = false;
    };
  }, [user]);

  return isAdmin;
}