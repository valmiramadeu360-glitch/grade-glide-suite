import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Trash2, Loader2, BookOpen, Paperclip, FileText, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Importe seus subcomponentes aqui (Checklist, Materials, etc)
// import Checklist from "@/components/Checklist"; 

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Cabeçalho Ajustado para Mobile */}
      <div className="flex flex-col gap-4 px-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="w-fit gap-2 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        
        <div className="flex items-center justify-between bg-card p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: discipline?.color + "20" }}>
              <BookOpen className="h-6 w-6" style={{ color: discipline?.color }} />
            </div>
            <div>
              <h1 className="text-xl font-black truncate max-w-[180px] sm:max-w-none">{discipline?.name}</h1>
              <p className="text-xs text-muted-foreground font-bold uppercase">{discipline?.professor || "Sem Professor"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={deleteDiscipline} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ABAS CORRIGIDAS: Agora com scroll horizontal no mobile para não encavalar */}
      <Tabs defaultValue="info" className="w-full">
        <div className="overflow-x-auto pb-2 px-2 no-scrollbar">
          <TabsList className="inline-flex w-auto bg-muted/50 p-1 rounded-2xl border min-w-full sm:min-w-0">
            <TabsTrigger value="info" className="rounded-xl px-4 gap-2 font-bold text-xs uppercase"><Settings2 className="h-3.5 w-3.5" /> Info</TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-xl px-4 gap-2 font-bold text-xs uppercase"><CheckCircle2 className="h-3.5 w-3.5" /> Estudos</TabsTrigger>
            <TabsTrigger value="media" className="rounded-xl px-4 gap-2 font-bold text-xs uppercase"><Paperclip className="h-3.5 w-3.5" /> Mídia</TabsTrigger>
            <TabsTrigger value="notes" className="rounded-xl px-4 gap-2 font-bold text-xs uppercase"><FileText className="h-3.5 w-3.5" /> Resumos</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4 px-2">
          <TabsContent value="info" className="animate-in slide-in-from-bottom-2 duration-300">
            <Card className="rounded-[32px] border-none shadow-md bg-card">
              <CardContent className="p-6 space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Professor</label>
                  <div className="mt-1 p-4 bg-muted/30 rounded-2xl font-bold text-foreground border border-transparent focus-within:border-primary/20 transition-all">
                    {discipline?.professor || "Não informado"}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Média Atual</label>
                  <div className="mt-1 p-4 bg-muted/30 rounded-2xl font-black text-2xl text-primary border border-transparent">
                    {discipline?.current_grade?.toFixed(1) || "0,0"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist">
            {/* Aqui entra o seu componente de Checklist */}
            <div className="p-10 text-center text-muted-foreground italic text-sm">Área de Checklist em desenvolvimento...</div>
          </TabsContent>
          
          <TabsContent value="media">
             <div className="p-10 text-center text-muted-foreground italic text-sm">Área de Mídia em desenvolvimento...</div>
          </TabsContent>

          <TabsContent value="notes">
             <div className="p-10 text-center text-muted-foreground italic text-sm">Área de Resumos em desenvolvimento...</div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
