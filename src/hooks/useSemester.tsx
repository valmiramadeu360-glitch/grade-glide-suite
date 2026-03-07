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
  
  // Estado inicial: Tenta pegar do cache local ou usa o ano atual como fallback
  const [currentLabel, setCurrentLabelState] = useState<string>(() => {
    if (typeof window === "undefined") return "2026.1";
    return localStorage.getItem("eduflow-semester") || "2026.1";
  });
  
  const [allSemesters, setAllSemesters] = useState<string[]>([]);

  // Função para trocar o semestre em todo o app
  function setCurrentLabel(label: string) {
    setCurrentLabelState(label);
    localStorage.setItem("eduflow-semester", label);
    
    // Dispara um evento para componentes que não estão no contexto saberem da troca
    window.dispatchEvent(new CustomEvent("semesterChanged", { detail: label }));
  }

  async function loadSemesters() {
    if (!user) return;

    try {
      // 1. Busca o semestre "oficial" definido no perfil do aluno
      const { data: profile } = await supabase
        .from("profiles")
        .select("semester") // Padronizado conforme as telas anteriores
        .eq("user_id", user.id)
        .maybeSingle();

      // 2. Busca todos os semestres únicos presentes nas disciplinas (Histórico)
      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("semester")
        .eq("user_id", user.id);

      const labels = new Set<string>();
      
      // Adiciona o semestre do perfil
      if (profile?.semester) {
        labels.add(profile.semester.toString());
      }

      // Adiciona os semestres das matérias (mesmo as arquivadas)
      disciplines?.forEach((d: any) => {
        if (d.semester) labels.add(d.semester.toString());
      });

      // Fallback: se não houver nada, usa o padrão do app
      if (labels.size === 0) labels.add("2026.1");

      // Ordenação: Do mais recente para o mais antigo (ex: 2026.2, 2026.1, 2025.2...)
      const sortedLabels = Array.from(labels).sort((a, b) => b.localeCompare(a));
      
      setAllSemesters(sortedLabels);

      // Se o semestre atual não estiver na lista (ex: reset de conta), ajusta para o mais recente
      if (profile?.semester) {
        setCurrentLabel(profile.semester.toString());
      }
    } catch (error) {
      console.error("Erro ao carregar semestres:", error);
    }
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
  if (!ctx) {
    throw new Error("useSemester deve ser usado dentro de um SemesterProvider");
  }
  return ctx;
}
