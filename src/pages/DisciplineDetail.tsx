import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DisciplineGeneral } from "@/components/discipline/DisciplineGeneral";
import { DisciplineChecklist } from "@/components/discipline/DisciplineChecklist";
import { DisciplineMaterials } from "@/components/discipline/DisciplineMaterials";
import { DisciplineNotes } from "@/components/discipline/DisciplineNotes";
import { DisciplineBooks } from "@/components/discipline/DisciplineBooks";

export default function DisciplineDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user && id) loadDiscipline();
  }, [user, id]);

  async function loadDiscipline() {
    try {
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id)
        .single();

      if (error || !data) {
        toast({ title: "Não encontrado", description: "Disciplina não localizada ou sem permissão.", variant: "destructive" });
        navigate("/disciplines");
        return;
      }
      setDiscipline(data);
    } catch {
      navigate("/disciplines");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDiscipline() {
    if (!id || !user) return;
    if (!window.confirm("Isso excluirá permanentemente todos os resumos, notas e links desta disciplina. Continuar?")) return;

    setDeleting(true);
    const { error } = await supabase.from("disciplines").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      setDeleting(false);
    } else {
      toast({ title: "Disciplina removida com sucesso" });
      navigate("/disciplines");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">Carregando conteúdo...</p>
      </div>
    );
  }

  const disciplineColor = discipline.color || "#6366f1";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 px-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/disciplines")} className="rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5" style={{ backgroundColor: `${disciplineColor}15` }}>
              <BookOpen className="h-7 w-7" style={{ color: disciplineColor }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-foreground tracking-tight truncate">{discipline.name}</h1>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: disciplineColor }} />
                <p className="text-sm font-medium text-muted-foreground truncate italic">{discipline.professor || "Professor não informado"}</p>
              </div>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" disabled={deleting} onClick={deleteDiscipline} className="text-destructive hover:bg-destructive/10 font-bold text-xs uppercase tracking-widest gap-2">
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Excluir Matéria
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 rounded-xl h-12 grid grid-cols-5 shadow-inner">
          <TabsTrigger value="general" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Início</TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Estudos</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Mídia</TabsTrigger>
          <TabsTrigger value="books" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Livros</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Resumos</TabsTrigger>
        </TabsList>

        <div className="mt-8 transition-all">
          <TabsContent value="general" className="animate-in slide-in-from-bottom-2 duration-300">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>
          <TabsContent value="checklist" className="animate-in slide-in-from-bottom-2 duration-300">
            <DisciplineChecklist disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="materials" className="animate-in slide-in-from-bottom-2 duration-300">
            <DisciplineMaterials disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="books" className="animate-in slide-in-from-bottom-2 duration-300">
            <DisciplineBooks disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="notes" className="animate-in slide-in-from-bottom-2 duration-300">
            <DisciplineNotes disciplineId={discipline.id} disciplineName={discipline.name} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
