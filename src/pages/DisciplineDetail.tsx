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
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando conteúdo...</p>
      </div>
    );
  }

  const disciplineColor = discipline.color || "#6366f1";

  return (
    // pb-24 ou pb-[env(safe-area-inset-bottom)] adicionado para garantir clique no iPhone
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 pb-24">
      {isOffline && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest animate-pulse border border-destructive/20 mt-4">
          <CloudOff className="h-4 w-4" />
          Modo Offline (Sincronizando)
        </div>
      )}

      {/* Header Principal da Disciplina */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-card p-5 sm:p-6 rounded-[32px] border border-border/50 shadow-sm mt-4 sm:mt-8">
        <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
          {/* Botão de voltar robusto (Hitbox grande para polegar) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)} // Volta para a tela exata anterior (Dashboard ou Grade)
            className="rounded-[20px] bg-muted/30 hover:bg-muted transition-colors h-14 w-14 sm:h-16 sm:w-16 shrink-0 flex items-center justify-center border border-border/40"
          >
            <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7 text-foreground" />
          </Button>
          
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Ícone da Matéria Dinâmico */}
            <div 
              className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-300" 
              style={{ backgroundColor: `${disciplineColor}15`, border: `1px solid ${disciplineColor}30` }}
            >
              <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: disciplineColor }} />
            </div>
            
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 w-full max-w-sm">
                  <Input 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-12 text-lg sm:text-xl font-black bg-background border-border rounded-xl"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                  />
                  <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" onClick={saveTitle} disabled={isSavingTitle}>
                    {isSavingTitle ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => {setIsEditingTitle(false); setNewTitle(discipline.name);}} disabled={isSavingTitle}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 group w-full">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight truncate cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsEditingTitle(true)}>
                    {discipline.name}
                  </h1>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-muted/50" onClick={() => setIsEditingTitle(true)}>
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-1.5 bg-background border border-border/50 px-2.5 py-1 rounded-md w-fit max-w-full">
                <div className="h-2 w-2 rounded-full shrink-0 transition-colors duration-300 shadow-sm" style={{ backgroundColor: disciplineColor }} />
                <p className="text-xs font-bold text-muted-foreground truncate uppercase tracking-widest">
                  {discipline.professor || "Professor não informado"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão de Excluir Redesenhado */}
        <Button 
          variant="outline" 
          disabled={deleting} 
          onClick={deleteDiscipline} 
          className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40 font-black text-[10px] uppercase tracking-widest gap-2 w-full sm:w-auto h-14 sm:h-12 rounded-xl transition-all"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Excluir Disciplina
        </Button>
      </div>

      {/* Navegação por Abas (Tabs) - Rolagem horizontal suave no celular */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full bg-card border border-border/50 p-1.5 rounded-2xl flex overflow-x-auto no-scrollbar shadow-sm sm:grid sm:grid-cols-5 gap-1">
          <TabsTrigger value="general" className="flex-shrink-0 sm:flex-1 rounded-xl font-black text-[11px] uppercase tracking-wider py-3.5 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Painel Geral
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex-shrink-0 sm:flex-1 rounded-xl font-black text-[11px] uppercase tracking-wider py-3.5 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Plano de Estudos
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex-shrink-0 sm:flex-1 rounded-xl font-black text-[11px] uppercase tracking-wider py-3.5 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Mídias e Links
          </TabsTrigger>
          <TabsTrigger value="books" className="flex-shrink-0 sm:flex-1 rounded-xl font-black text-[11px] uppercase tracking-wider py-3.5 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Livros Cadastrados
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-shrink-0 sm:flex-1 rounded-xl font-black text-[11px] uppercase tracking-wider py-3.5 px-6 sm:px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Resumos (Caderno)
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 sm:mt-8 transition-all">
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

