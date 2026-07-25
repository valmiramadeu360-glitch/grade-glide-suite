import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface SemesterContextType {
  currentLabel: string;
  allSemesters: string[];
  isLoading: boolean;
  setCurrentLabel: (label: string) => Promise<void>;
  endSemester: (nextLabel: string) => Promise<void>;
  restoreSemester: (targetLabel: string) => Promise<void>;
  loadSemesters: () => Promise<void>;
}

const SemesterContext = createContext<SemesterContextType | undefined>(undefined);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [allSemesters, setAllSemesters] = useState<string[]>([]);
  
  const [currentLabel, setCurrentLabelState] = useState<string>(() => {
    return localStorage.getItem("eduflow-active-semester") || "2026.1";
  });

  async function setCurrentLabel(label: string) {
    setCurrentLabelState(label);
    localStorage.setItem("eduflow-active-semester", label);
    if (user) {
      await supabase.from("profiles").update({ current_semester_label: label }).eq("user_id", user.id);
    }
    window.dispatchEvent(new CustomEvent("semesterChanged", { detail: label }));
  }

  async function endSemester(nextLabel: string) {
    if (!user) return;
    setIsLoading(true);

    try {
      // Arquiva as disciplinas ativas
      const { error: archiveError } = await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("archived", false);

      if (archiveError) throw archiveError;

      // Reseta as datas do semestre no perfil para o novo ciclo começar limpo
      await supabase
        .from("profiles")
        .update({ semester_start: null, semester_end: null })
        .eq("user_id", user.id);

      await setCurrentLabel(nextLabel);
      await loadSemesters();

      toast({
        title: "Sucesso! 🎉",
        description: `Ciclo encerrado. Bem-vindo ao período ${nextLabel}.`,
      });
    } catch (error) {
      toast({ title: "Erro ao encerrar", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function restoreSemester(targetLabel: string) {
    if (!user) return;
    setIsLoading(true);

    try {
      await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("archived", false);

      const { error: restoreError } = await supabase
        .from("disciplines")
        .update({ 
          archived: false,
          semester_label: currentLabel
        })
        .eq("user_id", user.id)
        .eq("semester_label", targetLabel)
        .eq("archived", true);

      if (restoreError) throw restoreError;

      await loadSemesters();

      toast({
        title: "Histórico Restaurado",
        description: `Matérias de ${targetLabel} reativadas.`,
      });
    } catch (error) {
      toast({ title: "Erro na restauração", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSemesters() {
    if (!user) return;
    try {
      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("semester_label")
        .eq("user_id", user.id);

      const labels = new Set<string>();
      labels.add(currentLabel); 
      
      disciplines?.forEach((d: any) => {
        if (d.semester_label) labels.add(d.semester_label);
      });

      const sorted = Array.from(labels).sort((a, b) => b.localeCompare(a));
      setAllSemesters(sorted);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (user) {
      loadSemesters();
      supabase.from("profiles").select("current_semester_label").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.current_semester_label) setCurrentLabelState(data.current_semester_label);
        });
    }
  }, [user]);

  return (
    <SemesterContext.Provider value={{ 
      currentLabel, setCurrentLabel, allSemesters, loadSemesters, endSemester, restoreSemester, isLoading 
    }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) throw new Error("useSemester out of context");
  return ctx;
}
