import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RuLevel = "none" | "small" | "medium" | "large";

export interface RuRestaurant {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  lunch_start: string | null;
  lunch_end: string | null;
  dinner_start: string | null;
  dinner_end: string | null;
  is_open: boolean;
  closed_reason: string | null;
  notice: string | null;
}

export interface RuQueueStatus {
  level: RuLevel | null;
  score: number | null;
  confidence: "none" | "low" | "medium" | "high";
  sample_size: number;
  last_report_at: string | null;
}

export interface RuMenu {
  id: string;
  service_date: string;
  meal: "lunch" | "dinner";
  raw_text: string | null;
  items: unknown;
  nutrition: Record<string, unknown> | null;
  photo_url: string | null;
  is_official: boolean;
  created_at: string;
  photo_hash?: string | null;
  confirmations?: number | null;
  duplicate_of?: string | null;
  nutrition_source?: string | null;
  detected_meal?: string | null;
  detected_date?: string | null;
  signedPhoto?: string | null;
}

export interface RuNotice {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  created_at: string;
}

export const LEVEL_META: Record<RuLevel, { label: string; emoji: string; minutes: string; classes: string; dot: string; value: number }> = {
  none: { label: "Sem fila", emoji: "🟢", minutes: "~2 min", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", value: 0 },
  small: { label: "Fila pequena", emoji: "🟡", minutes: "~7 min", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500", value: 1 },
  medium: { label: "Fila média", emoji: "🟠", minutes: "~15 min", classes: "bg-orange-500/10 text-orange-600 border-orange-500/20", dot: "bg-orange-500", value: 2 },
  large: { label: "Fila grande", emoji: "🔴", minutes: "25 min+", classes: "bg-rose-500/10 text-rose-600 border-rose-500/20", dot: "bg-rose-500", value: 3 },
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  none: "Sem relatos recentes",
  low: "Confiabilidade baixa",
  medium: "Confiabilidade média",
  high: "Confiabilidade alta",
};

/** Precisa bater com o intervalo mínimo validado no servidor (tg_ru_queue_validate). */
export const REPORT_COOLDOWN_SECONDS = 3 * 60;

/** "2026-09-27" -> "27/09/2026" */
export function formatServiceDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

export const MEAL_LABEL: Record<"lunch" | "dinner", string> = { lunch: "Almoço", dinner: "Jantar" };

function minutesOf(value: string | null | undefined) {
  if (!value) return null;
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/**
 * Descobre a refeição corrente (almoço ou jantar) a partir dos horários oficiais
 * do restaurante. Fora das janelas, escolhe a refeição mais próxima do momento.
 */
export function currentMeal(restaurant: RuRestaurant | null, at: Date = new Date()): "lunch" | "dinner" {
  const now = at.getHours() * 60 + at.getMinutes();
  const lunchStart = minutesOf(restaurant?.lunch_start) ?? 10 * 60 + 30;
  const lunchEnd = minutesOf(restaurant?.lunch_end) ?? 14 * 60;
  const dinnerStart = minutesOf(restaurant?.dinner_start) ?? 17 * 60;
  const dinnerEnd = minutesOf(restaurant?.dinner_end) ?? 20 * 60;

  if (now >= lunchStart && now <= lunchEnd) return "lunch";
  if (now >= dinnerStart && now <= dinnerEnd) return "dinner";
  // Entre as refeições: o ponto médio decide qual está mais próxima.
  return now < (lunchEnd + dinnerStart) / 2 ? "lunch" : "dinner";
}

/** Impressão digital (SHA-256) da foto — permite identificar envios repetidos. */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useRu() {
  const [restaurant, setRestaurant] = useState<RuRestaurant | null>(null);
  const [status, setStatus] = useState<RuQueueStatus | null>(null);
  const [history, setHistory] = useState<{ level: RuLevel; created_at: string }[]>([]);
  const [peak, setPeak] = useState<{ hour: number; avg_score: number; reports: number }[]>([]);
  const [menus, setMenus] = useState<RuMenu[]>([]);
  const [notices, setNotices] = useState<RuNotice[]>([]);
  const [ratingSummary, setRatingSummary] = useState<Record<string, number> | null>(null);
  // O próprio relato do estudante — usado para mostrar o "aguarde X min" (cooldown)
  // sem depender de erro do servidor.
  const [myLastReport, setMyLastReport] = useState<{ level: RuLevel; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async (restaurantId: string) => {
    const { data } = await supabase.rpc("ru_queue_status", { _restaurant_id: restaurantId });
    const row = Array.isArray(data) ? data[0] : null;
    setStatus(
      row
        ? {
            level: (row.level as RuLevel) ?? null,
            score: row.score !== null ? Number(row.score) : null,
            confidence: (row.confidence as RuQueueStatus["confidence"]) ?? "none",
            sample_size: Number(row.sample_size ?? 0),
            last_report_at: row.last_report_at ?? null,
          }
        : null,
    );
  }, []);

  /** RLS só devolve a linha do próprio usuário — não vaza o relato de outra pessoa. */
  const loadMyLastReport = useCallback(async (restaurantId: string) => {
    const { data } = await supabase
      .from("ru_queue_reports")
      .select("level, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyLastReport(data ? { level: data.level as RuLevel, created_at: data.created_at as string } : null);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ru } = await supabase
        .from("ru_restaurants")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!ru) {
        setRestaurant(null);
        return;
      }

      const restaurantData: RuRestaurant = {
        ...ru,
        latitude: Number(ru.latitude),
        longitude: Number(ru.longitude),
      } as RuRestaurant;
      setRestaurant(restaurantData);

      const threeDayWindowStart = new Date();
      threeDayWindowStart.setDate(threeDayWindowStart.getDate() - 2);
      const windowStartDate = threeDayWindowStart.toISOString().slice(0, 10);

      const [statusRes, historyRes, peakRes, menusRes, noticesRes, ratingRes] = await Promise.all([
        loadStatus(ru.id),
        supabase.rpc("ru_recent_levels", { _restaurant_id: ru.id, _limit: 100 }),
        supabase.rpc("ru_peak_hours", { _restaurant_id: ru.id }),
        supabase
          .from("ru_menus")
          .select("*")
          .eq("restaurant_id", ru.id)
          .gte("service_date", windowStartDate)
          .order("service_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("ru_notices")
          .select("id, title, body, severity, created_at")
          .eq("restaurant_id", ru.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.rpc("ru_rating_summary", { _restaurant_id: ru.id }),
        loadMyLastReport(ru.id),
      ]);
      void statusRes;

      setHistory((historyRes.data ?? []) as { level: RuLevel; created_at: string }[]);
      setPeak(
        ((peakRes.data ?? []) as any[]).map((p) => ({
          hour: Number(p.hour),
          avg_score: Number(p.avg_score ?? 0),
          reports: Number(p.reports ?? 0),
        })),
      );
      setNotices((noticesRes.data ?? []) as RuNotice[]);

      const rating = Array.isArray(ratingRes.data) ? (ratingRes.data[0] as any) : null;
      setRatingSummary(
        rating && Number(rating.total) > 0
          ? {
              food: Number(rating.food ?? 0),
              cleanliness: Number(rating.cleanliness ?? 0),
              service: Number(rating.service ?? 0),
              waiting: Number(rating.waiting ?? 0),
              total: Number(rating.total ?? 0),
            }
          : null,
      );

      const rawMenus = (menusRes.data ?? []) as RuMenu[];
      const withPhotos = await Promise.all(
        rawMenus.map(async (menu) => {
          if (!menu.photo_url) return { ...menu, signedPhoto: null };
          const { data: signed } = await supabase.storage
            .from("ru-menus")
            .createSignedUrl(menu.photo_url, 3600);
          return { ...menu, signedPhoto: signed?.signedUrl ?? null };
        }),
      );
      setMenus(withPhotos);
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadMyLastReport]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!restaurant) return;
    // 30s em vez de 60s — a fila muda rápido no horário de pico.
    const timer = setInterval(() => loadStatus(restaurant.id), 30_000);
    return () => clearInterval(timer);
  }, [restaurant, loadStatus]);

  return {
    restaurant, status, history, peak, menus, notices, ratingSummary, myLastReport,
    loading, reload: loadAll, reloadStatus: loadStatus, reloadMyLastReport: loadMyLastReport,
  };
}

export async function requestPosition(): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }> {
  // No app nativo usamos o plugin do Capacitor (permissão de sistema real).
  const { isNative, getNativePosition } = await import("@/lib/native");
  if (isNative()) return getNativePosition();

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Seu dispositivo não suporta geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Ative para colaborar com a fila."
            : "Não foi possível obter sua localização. Tente novamente.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}
