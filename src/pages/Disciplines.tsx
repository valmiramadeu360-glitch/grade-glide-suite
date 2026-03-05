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
  
  // Controles de modais
  const [open, setOpen] = useState(false);
  const [showNewSemesterPrompt, setShowNewSemesterPrompt] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSemester, setCurrentSemester] = useState<number>(1);
  const [closingSemester, setClosingSemester] = useState(false);

  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#FFB3BA");

  // Paleta expandida com 20 opções (focada em tons Pastéis e Neon)
  const colors = [
    // Pastéis
    "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E8BAFF", "#FFC4E1", "#D5AAFF",
    // Neons
    "#FF10F0", "#39FF14", "#00FFFF", "#B026FF", "#FF2A2A", "#FFFF00", "#FF6600", "#00FF66",
    // Base/Sólidas
    "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"
  ];

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

    // Arquiva as disciplinas ativas
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

    // Avança o número do semestre
    const newSem = currentSemester + 1;
    await supabase.from("profiles").update({ semester: newSem }).eq("user_id", user.id);
    setCurrentSemester(newSem);

    toast({ title: "Sucesso!", description: `Disciplinas arquivadas no histórico.` });
    setClosingSemester(false);
    await loadAll();
    
    // Abre a pergunta se quer iniciar o novo semestre agora
    setShowNewSemesterPrompt(true);
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
        <Button className="shadow-lg shadow-primary/20 font-bold uppercase text-xs tracking-widest h-12 px-6 rounded-2xl">
          <Plus className="mr-2 h-5 w-5" /> Adicionar {extraOnly ? "Curso" : "Matéria"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Novo Registro</DialogTitle>
          <DialogDescription className="font-medium text-muted-foreground">Preencha os dados abaixo para organizar seu novo conteúdo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Nome da Disciplina</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Econometria ou BI" className="h-14 rounded-2xl bg-muted/30 border-border text-lg font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Professor Responsável</Label>
            <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do docente" className="h-14 rounded-2xl bg-muted/30 border-border font-medium" />
          </div>
          <div className="space-y-3">
            <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Cor Principal (Neon / Pastel)</Label>
            <div className="grid grid-cols-5 gap-3 pt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    "h-10 w-full rounded-xl border-4 transition-all hover:scale-110 shadow-sm",
                    newColor === c ? "border-foreground/30 ring-2 ring-primary scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-4">
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Matéria"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Alerta de Novo Semestre */}
      <AlertDialog open={showNewSemesterPrompt} onOpenChange={setShowNewSemesterPrompt}>
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Tudo Arquivado! 🎉</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium">
              O semestre anterior foi salvo no histórico. Você deseja configurar o novo semestre letivo ({currentSemester}º Semestre) adicionando novas matérias agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel onClick={() => setShowNewSemesterPrompt(false)} className="h-12 rounded-2xl font-bold uppercase tracking-widest text-xs">
              Não, faço depois
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowNewSemesterPrompt(false);
              setOpen(true); // Abre a tela de adicionar disciplina
            }} className="h-12 rounded-2xl font-black uppercase tracking-widest text-xs">
              Sim, adicionar matérias
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">
            {extraOnly ? "Cursos Extras" : "Minhas Disciplinas"}
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            {extraOnly
              ? "Aprimoramento e nivelamento fora da grade."
              : `${currentSemester}º Semestre · ${activeDisciplines.length} matérias ativas`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!extraOnly && activeDisciplines.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="font-bold text-xs uppercase tracking-widest h-12 rounded-2xl border-border/50 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors" disabled={closingSemester}>
                  <History className="mr-2 h-4 w-4" /> Arquivar Semestre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[32px]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black">Encerrar o {currentSemester}º Semestre?</AlertDialogTitle>
                  <AlertDialogDescription className="text-base font-medium">
                    Todas as <strong>{activeDisciplines.length} disciplinas atuais</strong> serão arquivadas e movidas para o histórico. Deseja encerrar este semestre?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6">
                  <AlertDialogCancel className="h-12 rounded-2xl font-bold uppercase tracking-widest text-xs">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={closeSemester} className="h-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {closingSemester ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sim, Arquivar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {addDialog}
        </div>
      </div>

      {extraOnly ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Componente de grade reutilizado do original */}
          {activeDisciplines.length === 0 ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/40 shadow-sm">
             <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
               <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
             </div>
             <h3 className="text-xl font-black text-foreground">Sua lista está vazia</h3>
             <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 mb-8 font-medium">
               Comece cadastrando os cursos fora da grade curricular.
             </p>
             <Button variant="outline" onClick={() => setOpen(true)} className="rounded-2xl px-8 h-12 font-bold uppercase tracking-widest text-xs border-border/50">
               <Plus className="mr-2 h-4 w-4" /> Cadastrar Curso
             </Button>
           </div>
          ) : (
            activeDisciplines.map((d) => (
              <Card key={d.id} className="group overflow-hidden border border-border/40 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:border-primary/30 rounded-[32px] bg-card hover:-translate-y-1" onClick={() => navigate(`/disciplines/${d.id}`)}>
                 <div className="h-2 w-full transition-all duration-500 group-hover:h-3" style={{ backgroundColor: d.color }} />
                 <CardContent className="p-6">
                   <div className="flex items-start justify-between gap-4">
                     <div className="flex items-center gap-4 min-w-0">
                       <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 shrink-0" style={{ backgroundColor: `${d.color}15` }}>
                         <BookOpen className="h-7 w-7" style={{ color: d.color }} />
                       </div>
                       <div className="min-w-0">
                         <h3 className="font-black text-xl text-foreground leading-tight truncate">{d.name}</h3>
                         <p className="text-[11px] mt-1 font-bold text-muted-foreground truncate uppercase tracking-widest">
                           {d.professor || "Sem docente atribuído"}
                         </p>
                       </div>
                     </div>
                     <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-primary/10 group-hover:text-primary">
                       <ChevronRight className="h-5 w-5" />
                     </div>
                   </div>
                 </CardContent>
               </Card>
            ))
          )}
        </div>
      ) : (
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="w-full bg-card border border-border/40 p-1.5 rounded-2xl h-auto grid grid-cols-2 shadow-sm">
            <TabsTrigger value="current" className="rounded-xl font-bold text-xs uppercase tracking-widest py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
              Grade Atual ({activeDisciplines.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl font-bold text-xs uppercase tracking-widest py-3 data-[state=active]:bg-muted data-[state=active]:shadow-none transition-all">
              Histórico ({archivedDisciplines.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-8 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeDisciplines.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/40 shadow-sm">
                    <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
                      <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">Sua lista está vazia</h3>
                    <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 mb-8 font-medium">
                      Comece cadastrando as disciplinas do seu {currentSemester}º semestre.
                    </p>
                    <Button variant="outline" onClick={() => setOpen(true)} className="rounded-2xl px-8 h-12 font-bold uppercase tracking-widest text-xs border-border/50">
                      <Plus className="mr-2 h-4 w-4" /> Cadastrar agora
                    </Button>
                  </div>
                ) : (
                  activeDisciplines.map((d) => (
                    <Card key={d.id} className="group overflow-hidden border border-border/40 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:border-primary/30 rounded-[32px] bg-card hover:-translate-y-1" onClick={() => navigate(`/disciplines/${d.id}`)}>
                      <div className="h-2 w-full transition-all duration-500 group-hover:h-3" style={{ backgroundColor: d.color }} />
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 shrink-0" style={{ backgroundColor: `${d.color}15` }}>
                              <BookOpen className="h-7 w-7" style={{ color: d.color }} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black text-xl text-foreground leading-tight truncate">{d.name}</h3>
                              <p className="text-[11px] mt-1 font-bold text-muted-foreground truncate uppercase tracking-widest">
                                {d.professor || "Sem docente atribuído"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {d.semester_number && (
                              <Badge variant="secondary" className="text-[9px] font-black px-2 py-0.5 tracking-widest bg-muted/80">{d.semester_number}º SEM</Badge>
                            )}
                            <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-primary/10 group-hover:text-primary">
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
             </div>
          </TabsContent>

          <TabsContent value="history" className="mt-8 space-y-10 animate-in slide-in-from-bottom-2 duration-300">
            {archivedDisciplines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[40px] border border-border/40 shadow-sm">
                <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center shadow-inner mb-6">
                  <History className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-black text-foreground">Nenhum histórico</h3>
                <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 font-medium">
                  As disciplinas arquivadas de semestres anteriores aparecerão aqui.
                </p>
              </div>
            ) : (
              Object.entries(archivedBySemester).sort(([a], [b]) => Number(b) - Number(a)).map(([sem, items]) => (
                <div key={sem} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
                      {Number(sem) > 0 ? `${sem}º Semestre` : "Período Indefinido"}
                    </h3>
                    <div className="flex-1 h-px bg-border/50 ml-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(d => (
                      <Card key={d.id} className="cursor-pointer border border-border/40 bg-card hover:bg-muted/50 transition-all rounded-[24px] shadow-sm hover:shadow-md" onClick={() => navigate(`/disciplines/${d.id}`)}>
                        <div className="h-1.5 w-full rounded-t-[24px]" style={{ backgroundColor: d.color }} />
                        <CardContent className="p-5">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${d.color}15` }}>
                              <BookOpen className="h-6 w-6" style={{ color: d.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-black text-base text-foreground truncate">{d.name}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate mt-0.5">{d.professor || "Sem professor"}</p>
                            </div>
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
