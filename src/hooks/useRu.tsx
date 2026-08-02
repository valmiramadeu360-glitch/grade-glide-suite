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

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

export function useRu() {
  const [restaurant, setRestaurant] = useState<RuRestaurant | null>(null);
  const [status, setStatus] = useState<RuQueueStatus | null>(null);
  const [history, setHistory] = useState<{ level: RuLevel; created_at: string }[]>([]);
  const [peak, setPeak] = useState<{ hour: number; avg_score: number; reports: number }[]>([]);
  const [menus, setMenus] = useState<RuMenu[]>([]);
  const [notices, setNotices] = useState<RuNotice[]>([]);
  const [ratingSummary, setRatingSummary] = useState<Record<string, number> | null>(null);
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

      const [statusRes, historyRes, peakRes, menusRes, noticesRes, ratingRes] = await Promise.all([
        loadStatus(ru.id),
        supabase
          .from("ru_queue_reports")
          .select("level, created_at")
          .eq("restaurant_id", ru.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase.rpc("ru_peak_hours", { _restaurant_id: ru.id }),
        supabase
          .from("ru_menus")
          .select("*")
          .eq("restaurant_id", ru.id)
          .order("service_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("ru_notices")
          .select("id, title, body, severity, created_at")
          .eq("restaurant_id", ru.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.rpc("ru_rating_summary", { _restaurant_id: ru.id }),
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
  }, [loadStatus]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!restaurant) return;
    const timer = setInterval(() => loadStatus(restaurant.id), 60_000);
    return () => clearInterval(timer);
  }, [restaurant, loadStatus]);

  return { restaurant, status, history, peak, menus, notices, ratingSummary, loading, reload: loadAll, reloadStatus: loadStatus };
}

export function requestPosition(): Promise<GeolocationPosition> {
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