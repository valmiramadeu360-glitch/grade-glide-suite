import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Trash2, 
  BookOpen, 
  Paperclip, 
  FileText, 
  Settings2, 
  CheckCircle2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// COMPONENTES DE FUNCIONALIDADE
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
      setLoading(false);
    }
  }

  async function deleteDiscipline() {
    if (!confirm("Tem certeza que deseja excluir esta disciplina?")) return;
    
    try {
      const { error } = await supabase.from("disciplines").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Removida", description: "Disciplina excluída com sucesso." });
      navigate("/disciplines");
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  }

  if (loading || !discipline) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
           <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 animate-pulse">
             Sincronizando Metadados...
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4">
      <div className="flex flex-col gap-4 mt-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/disciplines")} 
          className="w-fit gap-2 text-slate-500 hover:text-primary transition-all rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para Grade
        </Button>
        
        <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-xl p-6 rounded-[32px] border border-white/5 shadow-2xl">
          <div className="flex items-center gap-5">
            <div 
              className="h-16 w-16 rounded-[22px] flex items-center justify-center shadow-inner" 
              style={{ backgroundColor: `${discipline?.color || "#3b82f6"}20` }}
            >
              <BookOpen className="h-8 w-8" style={{ color: discipline?.color || "#3b82f6" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black truncate max-w-[180px] sm:max-w-none tracking-tighter text-white">
                {discipline?.name}
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">
                Prof. {discipline?.professor || "Não atribuído"}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={deleteDiscipline} 
            className="text-rose-500 hover:bg-rose-500/10 rounded-2xl h-12 w-12 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="checklist" className="w-full">
        <div className="overflow-x-auto no-scrollbar mb-6">
          <TabsList className="inline-flex w-max sm:w-full bg-slate-900/60 p-1.5 rounded-[24px] border border-white/5 gap-1">
            <TabsTrigger value="checklist" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary">
              <CheckCircle2 className="h-4 w-4" /> Estudos
            </TabsTrigger>
            <TabsTrigger value="info" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary">
              <Settings2 className="h-4 w-4" /> Info
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary">
              <Paperclip className="h-4 w-4" /> Mídia
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-2xl px-6 py-3 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary">
              <FileText className="h-4 w-4" /> Resumos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="outline-none">
          <TabsContent value="checklist" className="mt-0 focus-visible:ring-0">
            {/* O segredo está nesta KEY: ela força o componente a recarregar com o ID correto */}
            <DisciplineChecklist key={`checklist-${id}`} disciplineId={id!} />
          </TabsContent>

          <TabsContent value="info" className="mt-0 focus-visible:ring-0">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>
          
          <TabsContent value="media" className="mt-0 focus-visible:ring-0">
             <DisciplineMaterials disciplineId={id!} />
          </TabsContent>

          <TabsContent value="notes" className="mt-0 focus-visible:ring-0">
             <DisciplineNotes disciplineId={id!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
