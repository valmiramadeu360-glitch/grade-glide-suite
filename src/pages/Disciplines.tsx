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
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History, ArrowLeft, Palette } from "lucide-react";
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
  semester: string | null;
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
  const [newColor, setNewColor] = useState("#3B82F6");

  const colors = [
    "#FFB3BA", "#FFDFBA", "#BAFFC9", "#BAE1FF", "#E8BAFF", 
    "#FF10F0", "#39FF14", "#00FFFF", "#FF6600", "#3B82F6", 
    "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#6366F1"
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

  // Ativas = Matérias não arquivadas do semestre selecionado
  const activeDisciplines = allDisciplines.filter(d =>
    !d.archived && (d.semester === currentLabel || !d.semester)
  );
  
  // Arquivadas = Disciplinas marcadas como archived (Histórico)
  const archivedDisciplines = allDisciplines.filter(d => d.archived);

  // Agrupamento para a visão de histórico
  const archivedBySemester: Record<string, Discipline[]> = {};
  archivedDisciplines.forEach(d => {
    const label = d.semester ?? "Sem Período";
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
      semester: currentLabel, 
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: extraOnly ? "Curso registrado!" : "Disciplina adicionada!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadAll();
    }
    setIsSubmitting(false);
  }

  const renderDisciplineCard = (d: Discipline) => (
    <Card 
      key={d.id} 
      className="group overflow-hidden border border-border/50 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 active:scale-[0.97] rounded-[32px] bg-card relative" 
      onClick={() => navigate(`/disciplines/${d.id}`)}
    >
      <div className="absolute top-0 left-0 w-full h-2 transition-all duration-500 group-hover:h-3" style={{ backgroundColor: d.color }} />
      <CardContent className="p-6 pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-500 group-hover:rotate-6 shrink-0" style={{ backgroundColor: `${d.color}15`, border: `1px solid ${d.color}30` }}>
              <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: d.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg sm:text-xl text-foreground leading-tight truncate group-hover:text-primary transition-colors">{d.name}</h3>
              <p className="text-[10px] sm:text-xs mt-2 font-bold text-muted-foreground truncate uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.professor || "Docente não informado"}
              </p>
            </div>
          </div>
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary">
            <ChevronRight className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading && allDisciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Grade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted shrink-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight truncate">
              {extraOnly ? "Cursos Extras" : "Grade Curricular"}
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              {extraOnly
                ? "Capacitações e Atividades"
                : `Semestre ${currentLabel} • ${activeDisciplines.length} Ativas`}
            </p>
          </div>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-xl shadow-primary/20 font-black uppercase text-[10px] sm:text-xs tracking-widest h-14 px-8 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all">
              <Plus className="mr-2 h-5 w-5" /> Adicionar Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] bg-card border-border p-6 sm:p-8">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-black text-foreground">Novo Registro</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm mt-1">
                Configure a disciplina ou curso para o período <strong className="text-foreground">{currentLabel}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Identificação da Matéria</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Cálculo III, Marketing..." className="h-14 rounded-2xl bg-background border-border text-base font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Cor do Módulo</Label>
                <div className="grid grid-cols-5 gap-3 p-3 bg-muted/20 rounded-2xl border border-border/50">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-10 w-full rounded-xl border-4 transition-all hover:scale-110",
                        newColor === c ? "border-foreground/40 ring-2 ring-primary scale-110 shadow-lg" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Docentes Responsáveis</Label>
                <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nomes dos professores" className="h-14 rounded-2xl bg-background border-border text-sm font-medium" />
              </div>
              <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Concluir Cadastro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="current" className="w-full mt-8">
        <TabsList className="w-full sm:w-fit bg-card border border-border/50 p-1.5 rounded-2xl h-auto grid grid-cols-2 shadow-sm mb-10">
          <TabsTrigger value="current" className="rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest py-3 sm:py-3.5 px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
            Em Andamento ({activeDisciplines.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest py-3 sm:py-3.5 px-6 data-[state=active]:bg-muted data-[state=active]:shadow-none transition-all">
            Histórico ({archivedDisciplines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeDisciplines.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/50 shadow-inner">
                <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mb-6">
                  {extraOnly ? <GraduationCap className="h-10 w-10 text-muted-foreground/30" /> : <BookOpen className="h-10 w-10 text-muted-foreground/30" />}
                </div>
                <h3 className="text-xl font-black text-foreground">Nada por aqui ainda</h3>
                <p className="text-muted-foreground text-sm max-w-sm text-center mt-2 mb-8 font-medium">
                  {extraOnly ? "Nenhum curso extra cadastrado." : `Você não possui disciplinas ativas em ${currentLabel}.`}
                </p>
                <Button onClick={() => setOpen(true)} className="rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-xs bg-muted text-foreground hover:bg-muted/80">
                  <Plus className="mr-2 h-4 w-4" /> Criar Primeiro Registro
                </Button>
              </div>
            ) : (
              activeDisciplines.map(d => renderDisciplineCard(d))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {archivedDisciplines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/50">
              <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sem registros arquivados</p>
            </div>
          ) : (
            Object.entries(archivedBySemester).sort(([a], [b]) => b.localeCompare(a)).map(([label, items]) => (
              <div key={label} className="space-y-6">
                <div className="flex items-center gap-4 ml-2">
                  <div className="h-10 w-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center shrink-0">
                    <History className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">
                    {label} <span className="text-sm font-bold text-muted-foreground/60 ml-2 tracking-widest">({items.length})</span>
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/80 to-transparent" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(d => renderDisciplineCard(d))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
