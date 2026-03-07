import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline {
  id: string;
  name: string;
  professor: string | null;
  color: string;
  current_grade: number | null;
  is_extra_course: boolean;
  archived: boolean;
  semester: string | null; // Corrigido de semester_label para semester
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {
  const { user } = useAuth();
  const { currentLabel } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#FFB3BA");

  const colors = [
    "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E8BAFF", "#FFC4E1", "#D5AAFF",
    "#FF10F0", "#39FF14", "#00FFFF", "#B026FF", "#FF2A2A", "#FFFF00", "#FF6600", "#00FF66",
    "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"
  ];

  useEffect(() => {
    if (user) loadAll();
  }, [user, extraOnly]);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("disciplines")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_extra_course", extraOnly)
      .order("name");

    setAllDisciplines(data ?? []);
    setLoading(false);
  }

  // Active = Matches current semester OR is not archived
  const activeDisciplines = allDisciplines.filter(d =>
    !d.archived && (d.semester === currentLabel || !d.semester)
  );
  
  // Archived = explicitly marked as archived
  const archivedDisciplines = allDisciplines.filter(d => d.archived);

  // Group archived by semester
  const archivedBySemester: Record<string, Discipline[]> = {};
  archivedDisciplines.forEach(d => {
    const label = d.semester ?? "Indefinido";
    if (!archivedBySemester[label]) archivedBySemester[label] = [];
    archivedBySemester[label].push(d);
  });

  async function createDiscipline() {
    if (!newName.trim() || !user) {
      toast({ title: "O nome é obrigatório", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const { error } = await supabase.from("disciplines").insert({
      user_id: user.id,
      name: newName.trim(),
      professor: newProfessor.trim() || null,
      color: newColor,
      is_extra_course: extraOnly,
      semester: currentLabel, // Corrigido de semester_label para semester
    });

    if (error) {
      toast({ title: "Erro de Cadastro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: extraOnly ? "Curso adicionado!" : "Matéria cadastrada!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadAll();
    }
    setIsSubmitting(false);
  }

  // Função isolada e correta para renderizar o Card de Disciplina
  const renderDisciplineCard = (d: Discipline) => (
    <Card 
      key={d.id} 
      className="group overflow-hidden border border-border/50 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 rounded-[32px] bg-card relative" 
      onClick={() => navigate(`/disciplines/${d.id}`)}
    >
      <div className="absolute top-0 left-0 w-full h-2 transition-all duration-500 group-hover:h-3" style={{ backgroundColor: d.color }} />
      <CardContent className="p-6 pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-500 group-hover:scale-110 shrink-0" style={{ backgroundColor: `${d.color}15`, border: `1px solid ${d.color}30` }}>
              <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: d.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg sm:text-xl text-foreground leading-tight truncate group-hover:text-primary transition-colors">{d.name}</h3>
              <p className="text-[10px] sm:text-xs mt-1.5 font-bold text-muted-foreground truncate uppercase tracking-widest flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.professor || "Sem Docente"}
              </p>
            </div>
          </div>
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-muted/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading && allDisciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Sincronizando Grade...</p>
      </div>
    );
  }

  const AddDialogContent = () => (
    <DialogContent className="w-[95vw] sm:max-w-[425px] rounded-[32px] bg-card border-border p-6">
      <DialogHeader className="text-left">
        <DialogTitle className="text-2xl font-black text-foreground">Novo Registro</DialogTitle>
        <DialogDescription className="font-medium text-muted-foreground text-sm">
          Preencha os dados abaixo para organizar seu novo conteúdo.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Nome da Matéria/Curso</Label>
          <Input 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            placeholder="Ex: Anatomia Humana" 
            className="h-14 rounded-2xl bg-background border-border text-base font-bold focus:ring-primary/20" 
          />
        </div>
        <div className="space-y-2">
          <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Docentes (Opcional)</Label>
          <Input 
            value={newProfessor} 
            onChange={(e) => setNewProfessor(e.target.value)} 
            placeholder="Ex: Prof. Dr. Silva / Prof. Maria" 
            className="h-14 rounded-2xl bg-background border-border text-sm font-medium focus:ring-primary/20" 
          />
        </div>
        <div className="space-y-3">
          <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex items-center justify-between">
            Cor de Identificação
            <span className="text-primary font-bold lowercase tracking-normal">({newColor})</span>
          </Label>
          <div className="grid grid-cols-5 gap-3 pt-1 bg-background p-3 rounded-2xl border border-border/50">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  "h-10 w-full rounded-xl border-4 transition-all hover:scale-110 shadow-sm",
                  newColor === c ? "border-foreground/30 ring-2 ring-primary scale-110 shadow-md" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                title={c}
                type="button"
              />
            ))}
          </div>
        </div>
        <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20">
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Registro"}
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted shrink-0 transition-all"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight truncate">
              {extraOnly ? "Cursos Extras" : "Grade Curricular"}
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              {extraOnly
                ? "Atividades Extracurriculares"
                : `Período ${currentLabel} · ${activeDisciplines.length} Ativas`}
            </p>
          </div>
        </div>
        
        {/* Modal de Adição */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-xl shadow-primary/20 font-black uppercase text-[10px] sm:text-xs tracking-widest h-14 px-8 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-5 w-5" /> Novo Registro
            </Button>
          </DialogTrigger>
          <AddDialogContent />
        </Dialog>
      </div>

      {extraOnly ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-8">
          {activeDisciplines.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/50 shadow-sm">
              <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
                <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-black text-foreground">Nenhum Curso Ativo</h3>
              <p className="text-muted-foreground text-sm max-w-sm text-center mt-2 mb-8 font-medium">
                Comece cadastrando os cursos extracurriculares que você está realizando atualmente.
              </p>
              <Button onClick={() => setOpen(true)} className="rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-xs bg-muted text-foreground hover:bg-muted/80">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar Curso
              </Button>
            </div>
          ) : (
            activeDisciplines.map(d => renderDisciplineCard(d))
          )}
        </div>
      ) : (
        <Tabs defaultValue="current" className="w-full mt-8">
          <TabsList className="w-full bg-card border border-border/50 p-1.5 rounded-2xl h-auto grid grid-cols-2 shadow-sm">
            <TabsTrigger value="current" className="rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest py-3 sm:py-3.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
              Semestre Atual ({activeDisciplines.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest py-3 sm:py-3.5 data-[state=active]:bg-muted data-[state=active]:shadow-none transition-all">
              Histórico ({archivedDisciplines.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {activeDisciplines.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-24 bg-card rounded-[40px] border border-border/50 shadow-sm">
                  <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">Grade Curricular Vazia</h3>
                  <p className="text-muted-foreground text-sm max-w-md text-center mt-2 mb-8 font-medium leading-relaxed">
                    Você ainda não possui disciplinas cadastradas no período letivo <strong className="text-foreground">{currentLabel}</strong>. Cadastre sua primeira matéria para começar.
                  </p>
                  <Button onClick={() => setOpen(true)} className="rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                    <Plus className="mr-2 h-5 w-5" /> Adicionar Matéria
                  </Button>
                </div>
              ) : (
                activeDisciplines.map(d => renderDisciplineCard(d))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
            {archivedDisciplines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[40px] border border-border/50 shadow-sm">
                <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
                  <History className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-2xl font-black text-foreground">Histórico Vazio</h3>
                <p className="text-muted-foreground text-sm max-w-md text-center mt-2 font-medium leading-relaxed">
                  As disciplinas arquivadas de períodos e semestres anteriores aparecerão organizadas aqui.
                </p>
              </div>
            ) : (
              Object.entries(archivedBySemester).sort(([a], [b]) => b.localeCompare(a)).map(([label, items]) => (
                <div key={label} className="space-y-6">
                  {/* Cabeçalho Divisor de Semestre */}
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center shrink-0">
                      <History className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período Letivo</span>
                      <h3 className="text-xl font-black text-foreground">
                        {label} <span className="text-sm font-medium text-muted-foreground ml-2 tracking-normal lowercase">({items.length} matérias)</span>
                      </h3>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/80 to-transparent ml-4 hidden sm:block" />
                  </div>
                  
                  {/* Grade do Semestre Arquivado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {items.map(d => renderDisciplineCard(d))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

