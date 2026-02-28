import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DisciplineGeneral } from "@/components/discipline/DisciplineGeneral";
import { DisciplineChecklist } from "@/components/discipline/DisciplineChecklist";
import { DisciplineMaterials } from "@/components/discipline/DisciplineMaterials";
import { DisciplineNotes } from "@/components/discipline/DisciplineNotes";

export default function DisciplineDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) loadDiscipline();
  }, [user, id]);

  async function loadDiscipline() {
    const { data, error } = await supabase
      .from("disciplines")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      navigate("/disciplines");
      return;
    }
    setDiscipline(data);
    setLoading(false);
  }

  async function deleteDiscipline() {
    if (!confirm("Tem certeza que deseja excluir esta disciplina?")) return;
    await supabase.from("disciplines").delete().eq("id", id);
    toast({ title: "Disciplina excluída" });
    navigate("/disciplines");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: discipline.color + "20" }}>
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: discipline.color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{discipline.name}</h1>
              {discipline.professor && <p className="text-sm text-muted-foreground">{discipline.professor}</p>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={deleteDiscipline} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <DisciplineChecklist disciplineId={discipline.id} />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          <DisciplineMaterials disciplineId={discipline.id} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <DisciplineNotes disciplineId={discipline.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
