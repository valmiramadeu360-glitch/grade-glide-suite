import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * "Tenant" = a universidade do estudante. Tudo no EduConect acontece dentro dela.
 * Este provider faz UMA consulta de perfil e serve todo o app (banimento,
 * onboarding, cabeçalho, menu lateral, Edu). O isolamento de verdade acontece
 * no banco (políticas RLS); aqui só decidimos o que mostrar.
 */

export interface TenantProfile {
  university_id: string | null;
  campus_id: string | null;
  course_id: string | null;
  current_period: number | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
}

export interface TenantUniversity {
  id: string;
  name: string;
  acronym: string;
  logo_url: string | null;
}

interface TenantContextType {
  loading: boolean;
  error: boolean;
  profile: TenantProfile | null;
  university: TenantUniversity | null;
  campusName: string | null;
  courseName: string | null;
  /** Logado, perfil carregado e ainda sem universidade escolhida. */
  needsOnboarding: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // Usamos só o id: o objeto "user" muda a cada renovação de token e não queremos recarregar à toa.
  const userId = user?.id ?? null;

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [university, setUniversity] = useState<TenantUniversity | null>(null);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // Guarda de qual usuário são os dados carregados (evita "piscar" ao trocar de conta).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setUniversity(null);
      setCampusName(null);
      setCourseName(null);
      setError(false);
      setLoadedFor(null);
      return;
    }

    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("university_id,campus_id,course_id,current_period,display_name,full_name,avatar_url,is_banned")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const next: TenantProfile | null = data
        ? {
            university_id: data.university_id ?? null,
            campus_id: data.campus_id ?? null,
            course_id: data.course_id ?? null,
            current_period: data.current_period ?? null,
            display_name: data.display_name ?? null,
            full_name: data.full_name ?? null,
            avatar_url: data.avatar_url ?? null,
            is_banned: !!data.is_banned,
          }
        : null;

      const [uniRes, campusRes, courseRes] = await Promise.all([
        next?.university_id
          ? supabase.from("universities").select("id,name,acronym,logo_url").eq("id", next.university_id).maybeSingle()
          : Promise.resolve({ data: null }),
        next?.campus_id
          ? supabase.from("campuses").select("name").eq("id", next.campus_id).maybeSingle()
          : Promise.resolve({ data: null }),
        next?.course_id
          ? supabase.from("courses").select("name").eq("id", next.course_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setProfile(next);
      setUniversity((uniRes.data as TenantUniversity | null) ?? null);
      setCampusName((campusRes.data as { name: string } | null)?.name ?? null);
      setCourseName((courseRes.data as { name: string } | null)?.name ?? null);
      setError(false);
    } catch (err) {
      // Sem rede não pode trancar o estudante fora do app nem forçar onboarding.
      console.error("Tenant: erro ao carregar perfil:", err);
      setError(true);
    } finally {
      setLoadedFor(userId);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Foto de perfil atualizada em outra tela.
  useEffect(() => {
    const onAvatar = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    };
    // Perfil/instituição alterados em outra tela: dispare window.dispatchEvent(new Event("educonect:profile-updated")).
    const onProfileUpdated = () => { load(); };
    window.addEventListener("avatarUpdated", onAvatar);
    window.addEventListener("educonect:profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("avatarUpdated", onAvatar);
      window.removeEventListener("educonect:profile-updated", onProfileUpdated);
    };
  }, [load]);

  // Ao voltar para o app (aba/janela), garante dados frescos (banimento, mudança de curso).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && userId) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, userId]);

  const loading = authLoading || (!!userId && loadedFor !== userId);
  const needsOnboarding = !!userId && !loading && !error && !profile?.university_id;

  const value = useMemo<TenantContextType>(
    () => ({ loading, error, profile, university, campusName, courseName, needsOnboarding, refresh: load }),
    [loading, error, profile, university, campusName, courseName, needsOnboarding, load],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de um TenantProvider");
  return ctx;
  }
