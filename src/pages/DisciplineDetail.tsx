import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2, BookOpen, Edit2, Check, X, CloudOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
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
  
  // Estados para edição do título e modo offline
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (user && id) loadDiscipline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
      setNewTitle(data.name);
    } catch {
      navigate("/disciplines");
    } finally {
      setLoading(false);
    }
  }

  async function saveTitle() {
    if (!newTitle.trim() || newTitle === discipline.name) {
      setIsEditingTitle(false);
      return;
    }
    if (isOffline) {
      toast({ title: "Você está offline", description: "Conecte-se à internet para salvar as alterações.", variant: "destructive" });
      return;
    }

    setIsSavingTitle(true);
    const { error } = await supabase
      .from("disciplines")
      .update({ name: newTitle.trim() })
      .eq("id", id)
      .eq("user_id", user?.id);

    if (error) {
      toast({ title: "Erro ao atualizar o título", description: error.message, variant: "destructive" });
    } else {
      setDiscipline({ ...discipline, name: newTitle.trim() });
      toast({ title: "Título atualizado com sucesso!" });
    }
    setIsSavingTitle(false);
    setIsEditingTitle(false);
  }

  async function deleteDiscipline() {
    if (!id || !user) return;
    if (isOffline) {
      toast({ title: "Você está offline", description: "Não é possível excluir enquanto estiver offline.", variant: "destructive" });
      return;
    }
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 px-2 pb-12">
      {isOffline && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest animate-pulse">
          <CloudOff className="h-4 w-4" />
          Modo Offline Ativado
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm transition-colors duration-300">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {/* Botão de voltar maior para mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/disciplines")}
            className="rounded-full hover:bg-muted transition-colors min-h-16 min-w-16 h-16 w-16 sm:h-14 sm:w-14 shrink-0 flex items-center justify-center"
          >
            <ArrowLeft className="h-7 w-7 sm:h-6 sm:w-6" />
          </Button>
          
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5 transition-colors duration-300" style={{ backgroundColor: `${disciplineColor}15` }}>
              <BookOpen className="h-6 sm:h-7 w-6 sm:w-7" style={{ color: disciplineColor }} />
            </div>
            
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-9 text-lg font-black"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={saveTitle} disabled={isSavingTitle}>
                    {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {setIsEditingTitle(false); setNewTitle(discipline.name);}} disabled={isSavingTitle}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">{discipline.name}</h1>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setIsEditingTitle(true)}>
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-2 rounded-full shrink-0 transition-colors duration-300" style={{ backgroundColor: disciplineColor }} />
                <p className="text-sm font-medium text-muted-foreground truncate italic">{discipline.professor || "Professor não informado"}</p>
              </div>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" disabled={deleting} onClick={deleteDiscipline} className="text-destructive hover:bg-destructive/10 font-bold text-xs uppercase tracking-widest gap-2 w-full sm:w-auto mt-4 sm:mt-0 py-6 sm:py-2">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />}
          Excluir Disciplina
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap sm:grid sm:grid-cols-5 shadow-inner gap-1 sm:gap-0">
          <TabsTrigger value="general" className="flex-1 rounded-lg font-bold text-[10px] sm:text-[10px] uppercase tracking-wider py-3 sm:py-2">Início</TabsTrigger>
          <TabsTrigger value="checklist" className="flex-1 rounded-lg font-bold text-[10px] sm:text-[10px] uppercase tracking-wider py-3 sm:py-2">Estudos</TabsTrigger>
          <TabsTrigger value="materials" className="flex-1 rounded-lg font-bold text-[10px] sm:text-[10px] uppercase tracking-wider py-3 sm:py-2">Mídia</TabsTrigger>
          <TabsTrigger value="books" className="flex-1 rounded-lg font-bold text-[10px] sm:text-[10px] uppercase tracking-wider py-3 sm:py-2">Livros</TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 rounded-lg font-bold text-[10px] sm:text-[10px] uppercase tracking-wider py-3 sm:py-2">Resumos</TabsTrigger>
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
