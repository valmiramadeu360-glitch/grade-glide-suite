import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Paperclip, 
  FileText, 
  Settings2, 
  CheckCircle2 // <-- ESTAVA FALTANDO ESTE ÍCONE
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DisciplineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) loadDiscipline();
  }, [user, id]);

  async function loadDiscipline() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setDiscipline(data);
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível carregar a matéria.", variant: "destructive" });
      navigate("/disciplines");
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
           <Loader2 className="h-10 w-10 animate-spin text-primary" />
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 px-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="w-fit gap-2 text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        
        <div className="flex items-center justify-between bg-card p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: (discipline?.color || "#3b82f6") + "20" }}>
              <BookOpen className="h-6 w-6" style={{ color: discipline?.color || "#3b82f6" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black truncate max-w-[150px] sm:max-w-none tracking-tighter">
                {discipline?.name}
              </h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                {discipline?.professor || "Sem Professor"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={deleteDiscipline} className="text-destructive hover:bg-destructive/10 rounded-xl">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        {/* CORREÇÃO DO BUG DAS ABAS: overflow-x-auto e no-scrollbar garantem que não encavalem */}
        <div className="overflow-x-auto pb-4 px-2 no-scrollbar">
          <TabsList className="inline-flex w-auto bg-muted/50 p-1 rounded-2xl border min-w-full sm:min-w-0">
            <TabsTrigger value="info" className="rounded-xl px-5 gap-2 font-black text-[10px] uppercase tracking-widest">
              <Settings2 className="h-3.5 w-3.5" /> Info
            </TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-xl px-5 gap-2 font-black text-[10px] uppercase tracking-widest">
              <CheckCircle2 className="h-3.5 w-3.5" /> Estudos
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-xl px-5 gap-2 font-black text-[10px] uppercase tracking-widest">
              <Paperclip className="h-3.5 w-3.5" /> Mídia
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-xl px-5 gap-2 font-black text-[10px] uppercase tracking-widest">
              <FileText className="h-3.5 w-3.5" /> Resumos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-2 px-2">
          <TabsContent value="info" className="animate-in slide-in-from-bottom-2 duration-300 outline-none">
            <Card className="rounded-[32px] border-none shadow-md bg-card">
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável</label>
                    <div className="p-4 bg-muted/30 rounded-2xl font-bold text-foreground border border-transparent">
                      {discipline?.professor || "Não informado"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desempenho Atual</label>
                    <div className="p-4 bg-muted/30 rounded-2xl font-black text-3xl text-primary border border-transparent">
                      {discipline?.current_grade ? Number(discipline.current_grade).toFixed(1) : "0.0"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="outline-none">
            <div className="p-12 border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <CheckCircle2 className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm font-medium italic">Cronograma de estudos em breve.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="media" className="outline-none">
             <div className="p-12 border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <Paperclip className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm font-medium italic">Galeria de fotos e documentos em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="outline-none">
             <div className="p-12 border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <FileText className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm font-medium italic">Seus resumos de Economia aparecerão aqui.</p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
