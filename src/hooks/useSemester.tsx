import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SemesterContextType {
  currentLabel: string;
  setCurrentLabel: (label: string) => void;
  allSemesters: string[];
  loadSemesters: () => Promise<void>;
}

const SemesterContext = createContext<SemesterContextType | undefined>(undefined);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentLabel, setCurrentLabelState] = useState<string>(() => {
    if (typeof window === "undefined") return "2026.1";
    return localStorage.getItem("eduflow-semester") || "2026.1";
  });
  const [allSemesters, setAllSemesters] = useState<string[]>([]);

  function setCurrentLabel(label: string) {
    setCurrentLabelState(label);
    localStorage.setItem("eduflow-semester", label);
  }

  async function loadSemesters() {
    if (!user) return;

    // Get current semester label from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_semester_label")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.current_semester_label) {
      setCurrentLabel(profile.current_semester_label);
    }

    // Get all distinct semester labels from disciplines
    const { data: disciplines } = await supabase
      .from("disciplines")
      .select("semester_label")
      .eq("user_id", user.id);

    const labels = new Set<string>();
    if (profile?.current_semester_label) labels.add(profile.current_semester_label);
    disciplines?.forEach((d: any) => {
      if (d.semester_label) labels.add(d.semester_label);
    });

    if (labels.size === 0) labels.add("2026.1");
    setAllSemesters(Array.from(labels).sort());
  }

  useEffect(() => {
    if (user) loadSemesters();
  }, [user]);

  return (
    <SemesterContext.Provider value={{ currentLabel, setCurrentLabel, allSemesters, loadSemesters }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) throw new Error("useSemester deve ser usado dentro de um SemesterProvider");
  return ctx;
}
