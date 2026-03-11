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
import { cn } from "@/lib/utils";

export default function DisciplineDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  
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
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id)
        .single();

      if (error || !data) {
        toast({ title: "Acesso Negado", description: "Disciplina não localizada ou sem permissão.", variant: "destructive" });
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
      toast({ title: "Modo Offline", description: "Conecte-se para salvar as alterações do título.", variant: "destructive" });
      return;
    }

    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from("disciplines")
        .update({ name: newTitle.trim() })
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      setDiscipline({ ...discipline, name: newTitle.trim() });
      toast({ title: "Identificação atualizada!" });
    } catch (error: any) {
      toast({ title: "Erro na atualização", description: error.message, variant: "destructive" });
      setNewTitle(discipline.name); // Reverte visualmente em caso de erro
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  }

  async function deleteDiscipline() {
    if (!id || !user) return;
    if (isOffline) {
      toast({ title: "Ação Bloqueada", description: "A exclusão exige conexão ativa com o servidor.", variant: "destructive" });
      return;
    }
    
    if (!window.confirm(`Você está prestes a excluir "${discipline.name}" permanentemente.\n\nTodos os resumos, livros e links associados serão apagados.\n\nDeseja continuar?`)) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("disciplines").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      
      toast({ title: "Módulo Arquivado", description: "A disciplina foi removida do seu histórico." });
      navigate("/disciplines");
    } catch (error: any) {
      toast({ title: "Falha na exclusão", description: error.message, variant: "destructive" });
      setDeleting(false);
    }
  }

  if (loading || !discipline) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando Módulo...</p>
      </div>
    );
  }

  const disciplineColor = discipline.color || "#6366f1";

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-700 px-4 sm:px-6 pb-24 sm:pb-32 overflow-x-hidden">
      
      {/* Alerta de Desconexão (Reserva espaço para não dar layout shift) */}
      <div className={cn("transition-all duration-500 overflow-hidden", isOffline ? "h-16 opacity-100 mt-6" : "h-0 opacity-0 mt-0")}>
        <div className="h-full bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm animate-pulse">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="truncate">Operando em Cache Offline</span>
        </div>
      </div>

      {/* Header Interativo da Disciplina */}
      <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/60 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-border/40 shadow-lg", !isOffline && "mt-6")}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 w-full md:w-auto">
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-2xl bg-muted/30 hover:bg-muted transition-colors h-14 w-14 sm:h-16 sm:w-16 shrink-0 flex items-center justify-center shadow-inner self-start sm:self-auto"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <div 
              className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl flex items-center justify-center shadow-xl transition-transform duration-500 hover:scale-105 hover:rotate-3" 
              style={{ backgroundColor: `${disciplineColor}15`, border: `1px solid ${disciplineColor}30` }}
            >
              <BookOpen className="h-8 w-8 sm:h-10 sm:w-10" style={{ color: disciplineColor }} />
            </div>
            
            <div className="min-w-0 flex-1 space-y-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 w-full max-w-sm animate-in fade-in slide-in-from-left-2">
                  <Input 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-12 text-lg sm:text-xl font-black bg-background border-border rounded-xl focus:ring-primary/40 transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                  />
                  <Button size="icon" variant="ghost" className="h-12 w-12 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-colors" onClick={saveTitle} disabled={isSavingTitle}>
                    {isSavingTitle ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-12 w-12 shrink-0 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-colors" onClick={() => {setIsEditingTitle(false); setNewTitle(discipline.name);}} disabled={isSavingTitle}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 group w-full">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight truncate cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingTitle(true)} title="Clique para renomear">
                    {discipline.name}
                  </h1>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 bg-muted hover:bg-primary/10 hover:text-primary active:scale-95" onClick={() => setIsEditingTitle(true)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 bg-background border border-border/50 px-3 py-1.5 rounded-lg w-fit max-w-full">
                <div className="h-2 w-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: disciplineColor }} />
                <p className="text-[10px] sm:text-xs font-black text-muted-foreground truncate uppercase tracking-widest">
                  {discipline.professor || "Docente Não Atribuído"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          disabled={deleting} 
          onClick={deleteDiscipline} 
          className="text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/40 font-black text-[10px] uppercase tracking-widest gap-2 w-full md:w-auto h-14 md:h-12 rounded-2xl md:rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Excluir Registro
        </Button>
      </div>

      {/* Navegação de Abas (Swipeable Feeling no Mobile) */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full bg-card/80 backdrop-blur-md border border-border/40 p-1.5 rounded-[20px] sm:rounded-2xl flex overflow-x-auto no-scrollbar shadow-sm sm:grid sm:grid-cols-5 gap-1 items-center snap-x snap-mandatory">
          {[
            { value: "general", label: "Painel Geral" },
            { value: "checklist", label: "Plano de Estudos" },
            { value: "materials", label: "Mídias & Links" },
            { value: "books", label: "Biblioteca" },
            { value: "notes", label: "Caderno (Resumos)" }
          ].map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="flex-shrink-0 sm:flex-1 rounded-[14px] font-black text-[10px] sm:text-[11px] uppercase tracking-widest py-3.5 sm:py-3 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all snap-center"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-8 transition-all relative min-h-[50vh]">
          <TabsContent value="general" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>
          <TabsContent value="checklist" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <DisciplineChecklist disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="materials" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <DisciplineMaterials disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="books" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <DisciplineBooks disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="notes" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <DisciplineNotes disciplineId={discipline.id} disciplineName={discipline.name} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
