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
      setNewTitle(discipline.name);
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
      <div className="flex flex-col items-center justify-center h-[100dvh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Módulo...</p>
      </div>
    );
  }

  const disciplineColor = discipline.color || "#6366f1";

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-500 px-4 sm:px-6 pb-24 pt-3 overflow-x-hidden">
      
      {/* Alerta de Desconexão */}
      <div className={cn("transition-all duration-300 overflow-hidden", isOffline ? "h-12 opacity-150 mb-3" : "h-0 opacity-0 mb-0")}>
        <div className="h-full bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm">
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Operando em Cache Offline</span>
        </div>
      </div>

      {/* Header Compacto e Responsivo da Disciplina */}
      <div className="bg-card border border-border/40 p-4 sm:p-6 rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl bg-muted/40 hover:bg-muted transition-colors h-10 w-10 shrink-0 flex items-center justify-center border border-border/30"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </Button>
          
          <div 
            className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl flex items-center justify-center shadow-md transition-transform" 
            style={{ backgroundColor: `${disciplineColor}15`, border: `1px solid ${disciplineColor}30` }}
          >
            <BookOpen className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: disciplineColor }} />
          </div>
          
          <div className="min-w-0 flex-1 space-y-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 w-full max-w-sm">
                <Input 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-10 text-sm font-bold bg-background border-border rounded-xl"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                />
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-500" onClick={saveTitle} disabled={isSavingTitle}>
                  {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl bg-destructive/10 text-destructive" onClick={() => {setIsEditingTitle(false); setNewTitle(discipline.name);}} disabled={isSavingTitle}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group w-full min-w-0">
                <h1 className="text-base sm:text-xl font-black text-foreground tracking-tight truncate cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingTitle(true)} title="Clique para renomear">
                  {discipline.name}
                </h1>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 bg-muted/50 hover:bg-primary/10 hover:text-primary" onClick={() => setIsEditingTitle(true)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {discipline.code && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                  {discipline.code}
                </span>
              )}
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                {discipline.professor ? `Prof. ${discipline.professor}` : "Docente Não Atribuído"}
              </span>
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          disabled={deleting} 
          onClick={deleteDiscipline} 
          className="text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 font-bold text-[10px] uppercase tracking-widest gap-1.5 h-10 px-3.5 rounded-xl transition-all self-end sm:self-auto shrink-0"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Excluir
        </Button>
      </div>

      {/* Navegação de Abas Limpa e Compacta */}
      <Tabs defaultValue="general" className="w-full space-y-4">
        <TabsList className="w-full bg-card border border-border/40 p-1 rounded-xl flex overflow-x-auto no-scrollbar shadow-sm sm:grid sm:grid-cols-5 gap-1 items-center">
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
              className="flex-shrink-0 sm:flex-1 rounded-lg font-bold text-[10px] uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="relative min-h-[40vh]">
          <TabsContent value="general" className="animate-in fade-in duration-300 m-0">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>
          <TabsContent value="checklist" className="animate-in fade-in duration-300 m-0">
            <DisciplineChecklist disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="materials" className="animate-in fade-in duration-300 m-0">
            <DisciplineMaterials disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="books" className="animate-in fade-in duration-300 m-0">
            <DisciplineBooks disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="notes" className="animate-in fade-in duration-300 m-0">
            <DisciplineNotes disciplineId={discipline.id} disciplineName={discipline.name} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
