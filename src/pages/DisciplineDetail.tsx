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

// Verifique se estes arquivos existem em src/components/
import { DisciplineChecklist } from "@/components/DisciplineChecklist";
import { DisciplineGeneral } from "@/components/DisciplineGeneral";

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
      // Pequeno delay para evitar que a tela "pisque" antes do render
      setTimeout(() => setLoading(false), 300);
    }
  }

  async function deleteDiscipline() {
    if (!confirm("Tem certeza que deseja excluir esta disciplina?")) return;
    const { error } = await supabase.from("disciplines").delete().eq("id", id);
    if (!error) {
      toast({ title: "Excluída", description: "Disciplina removida com sucesso." });
      navigate("/disciplines");
    }
  }

  // Proteção contra renderização sem dados (evita tela branca)
  if (loading || !discipline) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
           <div className="relative">
             <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
             <BookOpen className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
             Carregando Painel...
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 px-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)} 
          className="w-fit gap-2 text-muted-foreground hover:text-primary transition-all rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        
        <div className="flex items-center justify-between bg-card/50 backdrop-blur-sm p-5 rounded-[32px] border border-border/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div 
              className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner" 
              style={{ backgroundColor: (discipline?.color || "#3b82f6") + "20" }}
            >
              <BookOpen className="h-7 w-7" style={{ color: discipline?.color || "#3b82f6" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black truncate max-w-[160px] sm:max-w-none tracking-tighter">
                {discipline?.name}
              </h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-70">
                Prof. {discipline?.professor || "Não atribuído"}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={deleteDiscipline} 
            className="text-destructive hover:bg-destructive/10 rounded-2xl h-11 w-11"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        {/* Navegação por Abas com Scroll Lateral no Mobile */}
        <div className="overflow-x-auto px-4 no-scrollbar">
          <TabsList className="inline-flex w-max sm:w-full bg-muted/30 p-1.5 rounded-[24px] border border-border/40 gap-1">
            <TabsTrigger value="info" className="rounded-2xl px-6 py-2.5 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card">
              <Settings2 className="h-3.5 w-3.5" /> Info
            </TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-2xl px-6 py-2.5 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card">
              <CheckCircle2 className="h-3.5 w-3.5" /> Estudos
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-2xl px-6 py-2.5 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card">
              <Paperclip className="h-3.5 w-3.5" /> Mídia
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-2xl px-6 py-2.5 gap-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card">
              <FileText className="h-3.5 w-3.5" /> Resumos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4 px-4">
          {/* Aba de Informações e Horários */}
          <TabsContent value="info" className="outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>

          {/* Aba de Checklist/Estudos */}
          <TabsContent value="checklist" className="outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <DisciplineChecklist disciplineId={id!} />
          </TabsContent>
          
          {/* Espaços reservados para Mídia e Notas */}
          <TabsContent value="media" className="outline-none animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="p-20 border-2 border-dashed border-border/40 rounded-[48px] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <div className="h-16 w-16 rounded-3xl bg-muted/20 flex items-center justify-center mb-4">
                <Paperclip className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-40 text-center">
                Repositório de Mídia
              </p>
              <p className="text-[10px] mt-2 italic text-center">Organize fotos e documentos da matéria em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="outline-none animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="p-20 border-2 border-dashed border-border/40 rounded-[48px] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <div className="h-16 w-16 rounded-3xl bg-muted/20 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-40 text-center">
                Base de Resumos
              </p>
              <p className="text-[10px] mt-2 italic text-center">Seus blocos de notas acadêmicos em breve.</p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

