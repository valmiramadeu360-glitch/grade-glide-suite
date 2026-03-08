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
  
  // Cache PWA: Tenta recuperar o último semestre acessado antes mesmo do login
  const [currentLabel, setCurrentLabelState] = useState<string>(() => {
    return localStorage.getItem("eduflow-active-semester") || "2026.1";
  });

  // 1. Troca Simples de Contexto (Visual)
  async function setCurrentLabel(label: string) {
    setCurrentLabelState(label);
    localStorage.setItem("eduflow-active-semester", label);
    
    if (user) {
      await supabase.from("profiles").update({ current_semester_label: label }).eq("user_id", user.id);
    }
    
    window.dispatchEvent(new CustomEvent("semesterChanged", { detail: label }));
  }

  // 2. Encerrar Semestre (Arquivamento em Massa)
  // Ex: Transforma "Anatomia" (Ativa em 2026.1) em "Anatomia" (Arquivada em 2026.1)
  async function endSemester(nextLabel: string) {
    if (!user) return;
    setIsLoading(true);

    try {
      // Arquiva todas as disciplinas que estão 'active' no semestre que acaba de fechar
      const { error: archiveError } = await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("archived", false);

      if (archiveError) throw archiveError;

      // Define o novo semestre no perfil e no estado local
      await setCurrentLabel(nextLabel);
      await loadSemesters();

      toast({
        title: "Período Encerrado!",
        description: `O semestre foi arquivado. Bem-vindo ao ${nextLabel}.`,
      });
    } catch (error) {
      toast({ title: "Erro ao encerrar", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // 3. Restaurar Semestre (Swap de Status)
  // Reativa disciplinas de um semestre antigo e arquiva as do atual
  async function restoreSemester(targetLabel: string) {
    if (!user) return;
    setIsLoading(true);

    try {
      const activeLabel = currentLabel;

      // Passo A: Arquivar as matérias do semestre atual
      await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("archived", false);

      // Passo B: Ativar as matérias do semestre alvo
      const { error: restoreError } = await supabase
        .from("disciplines")
        .update({ archived: false })
        .eq("user_id", user.id)
        .eq("semester_label", targetLabel);

      if (restoreError) throw restoreError;

      await setCurrentLabel(targetLabel);
      await loadSemesters();

      toast({
        title: "Semestre Restaurado",
        description: `Agora você está visualizando ${targetLabel} como período ativo.`,
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
      // Busca semestres únicos para popular o Histórico e o Seletor
      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("semester")
        .eq("user_id", user.id);

      const labels = new Set<string>();
      labels.add(currentLabel); // Garante que o atual apareça
      
      disciplines?.forEach((d: any) => {
        if (d.semester) labels.add(d.semester.toString());
      });

      // Ordenação decrescente: 2026.2 > 2026.1 > 2025.2...
      const sorted = Array.from(labels).sort((a, b) => b.localeCompare(a));
      setAllSemesters(sorted);
    } catch (error) {
      console.error("Erro ao carregar lista de semestres:", error);
    }
  }

  useEffect(() => {
    if (user) {
      loadSemesters();
      // Sincroniza estado inicial com o banco
      supabase.from("profiles").select("semester").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.semester) setCurrentLabelState(data.semester);
        });
    }
  }, [user]);

  return (
    <SemesterContext.Provider value={{ 
      currentLabel, 
      setCurrentLabel, 
      allSemesters, 
      loadSemesters, 
      endSemester, 
      restoreSemester,
      isLoading 
    }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) throw new Error("useSemester deve ser usado dentro de um SemesterProvider");
  return ctx;
}

