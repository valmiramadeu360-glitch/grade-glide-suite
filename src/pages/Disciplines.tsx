import { useEffect, useState, useMemo } from "react"; 
import { supabase } from "@/integrations/supabase/client"; 
import { useAuth } from "@/hooks/useAuth"; 
import { useSemester } from "@/hooks/useSemester"; 
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExtraCoursesTab } from "@/components/ExtraCoursesTab";

import { Card, CardContent } from "@/components/ui/card"; 
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input"; 
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History, ArrowLeft, RefreshCcw, Search, Trash2, AlertTriangle, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline { 
  id: string; 
  name: string; 
  professor: string | null; 
  color: string; 
  archived: boolean; 
  is_extra_course: boolean; 
  semester_label: string | null; 
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {

  const { user } = useAuth();
  const { currentLabel, setCurrentLabel, loadSemesters, isLoading: isSwapping } = useSemester();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]); 
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "extra" ? "extra" : "active");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "extra" || t === "active" || t === "history") setActiveTab(t);
  }, [searchParams]);

  function changeTab(v: string) {
    setActiveTab(v);
    setSearchParams(v === "active" ? {} : { tab: v }, { replace: true });
  }

  const [searchQuery, setSearchQuery] = useState("");

  const [open, setOpen] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false); 
  const [restoreTargetLabel, setRestoreTargetLabel] = useState(""); 
  const [restorePeriodLabel, setRestorePeriodLabel] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); 
  const [deleteTargetLabel, setDeleteTargetLabel] = useState("");

  const [newName, setNewName] = useState(""); 
  const [newProfessor, setNewProfessor] = useState(""); 
  const [newColor, setNewColor] = useState("#6366F1");

  useEffect(() => { 
    if (user) loadDisciplines(); 
  }, [user, extraOnly, currentLabel]);

  async function loadDisciplines() {
    setLoading(true);
    try {
      const { data, error } = await supabase 
        .from("disciplines") 
        .select("*") 
        .eq("user_id", user!.id) 
        .eq("is_extra_course", extraOnly) 
        .order("name");

      if (error) throw error;
      setAllDisciplines(data || []);
    } catch (e: any) {
      toast({ title: "Erro de Sincronização", description: e.message, variant: "destructive" });
    } finally { 
      setLoading(false); 
    }
  }

  const activeDisciplines = useMemo(() => {
    return allDisciplines.filter(d => 
      !d.archived && 
      d.semester_label === currentLabel && 
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) 
    );
  }, [allDisciplines, currentLabel, searchQuery]);

  const archivedBySemester = useMemo(() => {
    const archived = allDisciplines.filter(d => 
      d.archived && 
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) 
    );

    const grouped: Record<string, Discipline[]> = {};
    archived.forEach(d => {
      const sem = d.semester_label || "Sem Período";
      if (!grouped[sem]) grouped[sem] = [];
      grouped[sem].push(d);
    });

    return Object.entries(grouped);
  }, [allDisciplines, searchQuery]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase 
        .from("disciplines") 
        .insert({ 
          user_id: user!.id, 
          name: newName.trim(), 
          professor: newProfessor || null, 
          color: newColor, 
          is_extra_course: extraOnly, 
          semester_label: currentLabel, 
          archived: false 
        });

      if (error) throw error;

      toast({ title: "Disciplina criada com sucesso 🎉" });
      setOpen(false);
      setNewName(""); 
      setNewProfessor("");
      await loadDisciplines();

    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { 
      setIsSubmitting(false); 
    }
  }

  async function handleRestorePeriod() {
    if (!restorePeriodLabel.trim() || !user) return;
    setIsProcessing(true);
    try {
      const newLabel = restorePeriodLabel.trim();
      const isNullTarget = restoreTargetLabel === "Sem Período" || !restoreTargetLabel;

      let query = supabase 
        .from("disciplines") 
        .update({ archived: false, semester_label: newLabel }) 
        .eq("user_id", user.id) 
        .eq("archived", true) 
        .select();

      if (isNullTarget) {
        query = query.is("semester_label", null);
      } else {
        query = query.eq("semester_label", restoreTargetLabel);
      }

      const { data, error } = await query;
      if (error) throw error;

      await supabase 
        .from("profiles") 
        .update({ current_semester_label: newLabel, updated_at: new Date().toISOString() }) 
        .eq("user_id", user.id);

      if (setCurrentLabel) { await setCurrentLabel(newLabel); }

      setAllDisciplines([]);
      if (loadSemesters) { await loadSemesters(); }
      await loadDisciplines();

      setActiveTab("active");
      setRestoreDialogOpen(false);
      toast({ title: "Período restaurado", description: `${data?.length || 0} disciplinas movidas` });

    } catch (e: any) {
      toast({ title: "Erro na restauração", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDeletePeriod() {
    if (!user) return;
    setIsProcessing(true);
    try {
      const isNullTarget = deleteTargetLabel === "Sem Período" || !deleteTargetLabel;
      let query = supabase 
        .from("disciplines") 
        .delete() 
        .eq("user_id", user.id) 
        .eq("archived", true);

      if (isNullTarget) {
        query = query.is("semester_label", null);
      } else {
        query = query.eq("semester_label", deleteTargetLabel);
      }

      const { error } = await query;
      if (error) throw error;

      await loadDisciplines();
      toast({ title: "Histórico excluído com sucesso" });
      setDeleteDialogOpen(false);

    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading || isSwapping) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const title = extraOnly ? "Cursos Extras" : "Minhas Disciplinas";
  const emptyMsg = extraOnly
    ? "Nenhum curso extra cadastrado."
    : "Nenhuma disciplina no período atual.";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-28 animate-in fade-in duration-500">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full hover:bg-muted"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-bold mt-0.5">
              {extraOnly ? "Cursos complementares" : `Período Ativo: ${currentLabel || "—"}`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-full font-black text-sm px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-all w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-1" /> Nova Matéria
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[32px] p-6 sm:p-8 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">
                {extraOnly ? "Novo Curso Extra" : "Nova Disciplina"}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                {extraOnly
                  ? "Cadastre um curso complementar para enriquecer seu currículo."
                  : `Esta matéria será vinculada ao período ${currentLabel}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="font-bold text-foreground/80">Nome da Matéria</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Anatomia Humana"
                  className="h-14 rounded-2xl bg-muted/50 border-0 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-foreground/80">Professor (opcional)</Label>
                <Input
                  value={newProfessor}
                  onChange={(e) => setNewProfessor(e.target.value)}
                  placeholder="Nome do docente responsável"
                  className="h-14 rounded-2xl bg-muted/50 border-0 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-3">
                <Label className="font-bold text-foreground/80">Cor de Identificação</Label>
                <div className="flex gap-3 flex-wrap">
                  {["#6366F1","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#8B5CF6","#84CC16"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-10 w-10 rounded-full transition-all shadow-sm",
                        newColor === c ? "ring-4 ring-offset-2 ring-primary scale-110" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !newName.trim()}
                className="w-full h-14 rounded-2xl font-black text-lg mt-2"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {isSubmitting ? "Criando..." : "Criar Disciplina"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* SEARCH BAR PREMIUM */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar matérias ou professores..."
          className="pl-12 h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary transition-all text-base"
        />
      </div>

      {/* TABS ESTILO iOS */}
      <Tabs value={activeTab} onValueChange={changeTab} className="w-full space-y-6">
        <TabsList className="w-full h-14 rounded-[20px] bg-muted/50 p-1.5 flex">
          <TabsTrigger value="active" className="flex-1 rounded-2xl font-bold text-xs sm:text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all">
            <GraduationCap className="h-4 w-4 hidden sm:block" /> Em curso
          </TabsTrigger>
          {!extraOnly && (
            <TabsTrigger value="history" className="flex-1 rounded-2xl font-bold text-xs sm:text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all">
              <History className="h-4 w-4 hidden sm:block" /> Histórico
            </TabsTrigger>
          )}
          {!extraOnly && (
            <TabsTrigger value="extra" className="flex-1 rounded-2xl font-bold text-xs sm:text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all">
              <Sparkles className="h-4 w-4 hidden sm:block" /> Extras
            </TabsTrigger>
          )}
        </TabsList>

        {!extraOnly && (
          <TabsContent value="extra" className="mt-0">
            <ExtraCoursesTab />
          </TabsContent>
        )}

        <TabsContent value="active" className="mt-0">
          {activeDisciplines.length === 0 ? (
            <div className="p-12 text-center rounded-[32px] bg-muted/30 border-2 border-dashed border-border/50 animate-in fade-in">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-bold text-muted-foreground">{emptyMsg}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {activeDisciplines.map((d) => (
                <Card
                  key={d.id}
                  onClick={() => navigate(`/disciplines/${d.id}`)}
                  className="rounded-[24px] border-0 bg-card shadow-sm hover:shadow-lg cursor-pointer transition-all active:scale-[0.98] group"
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div
                      className="h-12 w-2 rounded-full shrink-0 group-hover:scale-y-110 transition-transform"
                      style={{ backgroundColor: d.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-base truncate text-foreground group-hover:text-primary transition-colors">{d.name}</p>
                      {d.professor && (
                        <p className="text-sm font-semibold text-muted-foreground truncate mt-0.5">
                          {d.professor}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {!extraOnly && (
          <TabsContent value="history" className="mt-0 space-y-6">
            {archivedBySemester.length === 0 ? (
              <div className="p-12 text-center rounded-[32px] bg-muted/30 border-2 border-dashed border-border/50 animate-in fade-in">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-lg font-bold text-muted-foreground">Nenhum histórico arquivado.</p>
              </div>
            ) : (
              archivedBySemester.map(([sem, list]) => (
                <div key={sem} className="space-y-4 bg-muted/20 p-5 sm:p-6 rounded-[32px] animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/50" />
                      {sem} 
                      <span className="text-muted-foreground text-xs bg-muted px-2 py-1 rounded-md ml-1">{list.length} matérias</span>
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl text-xs font-bold gap-2 border-border/50 bg-background hover:bg-muted"
                        onClick={() => {
                          setRestoreTargetLabel(sem);
                          setRestorePeriodLabel(currentLabel || "");
                          setRestoreDialogOpen(true);
                        }}
                      >
                        <RefreshCcw className="h-4 w-4" /> Restaurar
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-destructive border-destructive/20 bg-background hover:bg-destructive/10"
                        onClick={() => {
                          setDeleteTargetLabel(sem);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((d) => (
                      <div key={d.id} className="bg-background/80 p-4 rounded-2xl flex items-center gap-3 shadow-sm border border-border/30">
                        <div
                          className="h-8 w-1.5 rounded-full shrink-0 opacity-50"
                          style={{ backgroundColor: d.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate opacity-80 text-foreground">{d.name}</p>
                          {d.professor && (
                            <p className="text-xs text-muted-foreground truncate opacity-70">
                              {d.professor}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* MODAL DE RESTAURAR PERÍODO */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="rounded-[32px] p-6 sm:p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Restaurar período</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Mover as disciplinas de <strong>{restoreTargetLabel}</strong> de volta para o painel ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-bold text-foreground/80">Novo período destino</Label>
              <Input
                value={restorePeriodLabel}
                onChange={(e) => setRestorePeriodLabel(e.target.value)}
                placeholder="Ex: 2026.1"
                className="h-14 rounded-2xl bg-muted/50 border-0 focus-visible:ring-primary text-base"
              />
            </div>
            <Button
              onClick={handleRestorePeriod}
              disabled={isProcessing || !restorePeriodLabel.trim()}
              className="w-full h-14 rounded-2xl font-black text-lg mt-2"
            >
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <RefreshCcw className="h-5 w-5 mr-2" />}
              {isProcessing ? "Restaurando..." : "Restaurar Agora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EXCLUIR PERÍODO */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[32px] p-6 sm:p-8 border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl font-black text-destructive">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              Excluir histórico
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground mt-4">
              Tem certeza? Todas as disciplinas arquivadas do período <strong>{deleteTargetLabel}</strong> serão removidas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel className="h-14 flex-1 rounded-2xl font-bold text-base border-0 bg-muted hover:bg-muted/80 m-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePeriod}
              disabled={isProcessing}
              className="h-14 flex-1 rounded-2xl font-bold text-base bg-destructive hover:bg-destructive/90 text-white m-0"
            >
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
              Excluir Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
