import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Paperclip, 
  FileText, 
  Settings2, 
  CheckCircle2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// COMPONENTES DE FUNCIONALIDADE INTEGRADOS
import { DisciplineChecklist } from "@/components/DisciplineChecklist";
import { DisciplineGeneral } from "@/components/DisciplineGeneral";
import { DisciplineMaterials } from "@/components/DisciplineMaterials";
import { DisciplineNotes } from "@/components/DisciplineNotes";

export default function DisciplineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadDiscipline();
    }
  }, [user, id]);

  async function loadDiscipline() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id) 
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({ title: "Não encontrado", description: "Disciplina não localizada.", variant: "destructive" });
        navigate("/disciplines");
        return;
      }

      setDiscipline(data);
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      toast({ title: "Erro de conexão", description: "Verifique sua internet.", variant: "destructive" });
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  }

  async function deleteDiscipline() {
    if (!confirm("Tem certeza que deseja excluir esta disciplina e todos os seus dados?")) return;
    
    try {
      const { error } = await supabase.from("disciplines").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Disciplina removida." });
      navigate("/disciplines");
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  }

  if (loading || !discipline) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
           <div className="relative">
             <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
             <BookOpen className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
             Sincronizando Dados...
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4">
      {/* Cabeçalho de Navegação */}
      <div className="flex flex-col gap-4 mt-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)} 
          className="w-fit gap-2 text-muted-foreground hover:text-primary transition-all rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para Grade
        </Button>
        
        <div className="flex items-center justify-between bg-card/40 backdrop-blur-xl p-6 rounded-[32px] border border-white/5 shadow-2xl">
          <div className="flex items-center gap-5">
            <div 
              className="h-16 w-16 rounded-[22px] flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform" 
              style={{ backgroundColor: (discipline?.color || "#3b82f6") + "20" }}
            >
              <BookOpen className="h-8 w-8" style={{ color: discipline?.color || "#3b82f6" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-black truncate max-w-[200px] sm:max-w-none tracking-tighter text-white">
                {discipline?.name}
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] opacity-80 mt-1">
                Prof. {discipline?.professor || "Não atribuído"}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={deleteDiscipline} 
            className="text-destructive hover:bg-destructive/10 rounded-2xl h-12 w-12 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        {/* Navegação por Abas Otimizada para Mobile */}
        <div className="overflow-x-auto no-scrollbar mb-6">
          <TabsList className="inline-flex w-max sm:w-full bg-slate-900/40 p-1.5 rounded-[24px] border border-white/5 gap-1 shadow-inner">
            <TabsTrigger value="info" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <Settings2 className="h-4 w-4" /> Info
            </TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <CheckCircle2 className="h-4 w-4" /> Estudos
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <Paperclip className="h-4 w-4" /> Mídia
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <FileText className="h-4 w-4" /> Resumos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="outline-none">
          {/* Aba de Informações e Horários */}
          <TabsContent value="info" className="animate-in fade-in slide-in-from-right-4 duration-500">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>

          {/* Aba de Checklist/Estudos */}
          <TabsContent value="checklist" className="animate-in fade-in slide-in-from-right-4 duration-500">
            <DisciplineChecklist disciplineId={id!} />
          </TabsContent>
          
          {/* Aba de Mídia (Arquivos e Fotos) */}
          <TabsContent value="media" className="animate-in fade-in slide-in-from-right-4 duration-500">
             <DisciplineMaterials disciplineId={id!} />
          </TabsContent>

          {/* Aba de Resumos (Editor de Notas) */}
          <TabsContent value="notes" className="animate-in fade-in slide-in-from-right-4 duration-500">
             <DisciplineNotes disciplineId={id!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

