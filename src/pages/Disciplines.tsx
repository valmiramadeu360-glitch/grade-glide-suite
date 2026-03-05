import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History } from "lucide-react";
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
  semester_number: number | null;
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSemester, setCurrentSemester] = useState<number>(1);
  const [closingSemester, setClosingSemester] = useState(false);

  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  useEffect(() => {
    if (user) loadAll();
  }, [user, extraOnly]);

  async function loadAll() {
    setLoading(true);
    const [discRes, profileRes] = await Promise.all([
      supabase.from("disciplines").select("*").eq("user_id", user?.id).eq("is_extra_course", extraOnly).order("name"),
      supabase.from("profiles").select("semester").eq("user_id", user!.id).maybeSingle(),
    ]);
    setAllDisciplines(discRes.data ?? []);
    setCurrentSemester(profileRes.data?.semester ?? 1);
    setLoading(false);
  }

  const activeDisciplines = allDisciplines.filter(d => !d.archived);
  const archivedDisciplines = allDisciplines.filter(d => d.archived);
  const archivedBySemester: Record<number, Discipline[]> = {};
  archivedDisciplines.forEach(d => {
    const sem = d.semester_number ?? 0;
    if (!archivedBySemester[sem]) archivedBySemester[sem] = [];
    archivedBySemester[sem].push(d);
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
      semester_number: currentSemester,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: extraOnly ? "Curso adicionado!" : "Disciplina cadastrada!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadAll();
    }
    setIsSubmitting(false);
  }

  async function closeSemester() {
    if (!user) return;
    setClosingSemester(true);

    // Archive all active disciplines
    const { error } = await supabase.from("disciplines")
      .update({ archived: true })
      .eq("user_id", user.id)
      .eq("is_extra_course", extraOnly)
      .or("archived.is.null,archived.eq.false");

    if (error) {
      toast({ title: "Erro ao encerrar semestre", description: error.message, variant: "destructive" });
      setClosingSemester(false);
      return;
    }

    // Increment semester in profile
    const newSem = currentSemester + 1;
    await supabase.from("profiles").update({ semester: newSem }).eq("user_id", user.id);
    setCurrentSemester(newSem);

    toast({ title: `Semestre ${currentSemester} encerrado!`, description: `Agora você está no ${newSem}º semestre.` });
    setClosingSemester(false);
    await loadAll();
    // Open add new discipline dialog
    setOpen(true);
  }

  if (loading && allDisciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sincronizando grade...</p>
      </div>
    );
  }

  const addDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20 font-bold uppercase text-xs tracking-widest">
          <Plus className="mr-2 h-4 w-4" /> Adicionar {extraOnly ? "Curso" : "Matéria"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Novo Registro</DialogTitle>
          <DialogDescription>Preencha os dados abaixo para organizar seu novo conteúdo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase text-muted-foreground">Nome da Disciplina</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Econometria ou BI" className="h-12" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase text-muted-foreground">Professor Responsável</Label>
            <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do docente" className="h-12" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase text-muted-foreground">Identidade Visual (Cor)</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-4 transition-all hover:scale-110 shadow-sm",
                    newColor === c ? "border-foreground/20 ring-2 ring-primary scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-12 font-bold uppercase tracking-widest">
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar no Semestre"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  function DisciplineGrid({ items }: { items: Discipline[] }) {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[40px] border-2 border-dashed border-border/50">
          <div className="h-20 w-20 rounded-3xl bg-background flex items-center justify-center shadow-inner mb-6">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Sua lista está vazia</h3>
          <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 mb-8 italic">
            Comece cadastrando as disciplinas do seu curso.
          </p>
          <Button variant="outline" onClick={() => setOpen(true)} className="rounded-full px-8">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar agora
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((d) => (
          <Card
            key={d.id}
            className="group overflow-hidden border-none transition-all cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-1 rounded-[24px] bg-card hover:bg-muted/30"
            onClick={() => navigate(`/disciplines/${d.id}`)}
          >
            <div className="h-2 w-full" style={{ backgroundColor: d.color }} />
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:rotate-6"
                    style={{ backgroundColor: `${d.color}15` }}
                  >
                    <BookOpen className="h-6 w-6" style={{ color: d.color }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-lg text-foreground leading-tight truncate">{d.name}</h3>
                    <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-tighter italic">
                      {d.professor || "Sem docente atribuído"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {d.semester_number && (
                    <Badge variant="secondary" className="text-[9px] font-bold">{d.semester_number}º Sem</Badge>
                  )}
                  <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </div>
                </div>
              </div>

              {d.current_grade !== null && (
                <div className="mt-4">
                  <Badge variant="outline" className="font-bold text-sm bg-background/50" style={{ borderColor: `${d.color}40`, color: d.color }}>
                    {d.current_grade.toFixed(1)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            {extraOnly ? "Cursos Extras" : "Minhas Disciplinas"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {extraOnly
              ? "Aprimoramento e nivelamento fora da grade."
              : `${currentSemester}º Semestre · ${activeDisciplines.length} matérias ativas`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!extraOnly && activeDisciplines.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="font-bold text-xs uppercase tracking-widest" disabled={closingSemester}>
                  <History className="mr-2 h-4 w-4" /> Encerrar Período Letivo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar {currentSemester}º Semestre?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as {activeDisciplines.length} disciplinas atuais serão movidas para o histórico.
                    Você poderá consultá-las a qualquer momento na aba "Histórico".
                    Deseja encerrar este semestre e iniciar um novo?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={closeSemester}>
                    {closingSemester ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sim, Encerrar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {addDialog}
        </div>
      </div>

      {extraOnly ? (
        <DisciplineGrid items={activeDisciplines} />
      ) : (
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="w-full bg-muted/50 p-1 rounded-xl h-12 grid grid-cols-2 shadow-inner">
            <TabsTrigger value="current" className="rounded-lg font-bold text-xs uppercase tracking-wider">
              Grade Atual ({activeDisciplines.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg font-bold text-xs uppercase tracking-wider">
              Histórico ({archivedDisciplines.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-6">
            <DisciplineGrid items={activeDisciplines} />
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-8">
            {archivedDisciplines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[40px] border-2 border-dashed border-border/50">
                <History className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">Nenhum histórico</h3>
                <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 italic">
                  As disciplinas de semestres anteriores aparecerão aqui quando você encerrar um período.
                </p>
              </div>
            ) : (
              Object.entries(archivedBySemester).sort(([a], [b]) => Number(b) - Number(a)).map(([sem, items]) => (
                <div key={sem}>
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {Number(sem) > 0 ? `${sem}º Semestre` : "Período Indefinido"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(d => (
                      <Card key={d.id} className="cursor-pointer border-border/30 bg-card hover:bg-muted/30 transition-all rounded-2xl" onClick={() => navigate(`/disciplines/${d.id}`)}>
                        <div className="h-1.5 w-full rounded-t-2xl" style={{ backgroundColor: d.color }} />
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${d.color}15` }}>
                              <BookOpen className="h-5 w-5" style={{ color: d.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-foreground truncate">{d.name}</p>
                              <p className="text-[10px] text-muted-foreground italic truncate">{d.professor || "Sem professor"}</p>
                            </div>
                            {d.current_grade !== null && (
                              <Badge variant="outline" className="ml-auto text-xs font-bold" style={{ color: d.color, borderColor: `${d.color}40` }}>
                                {d.current_grade.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
