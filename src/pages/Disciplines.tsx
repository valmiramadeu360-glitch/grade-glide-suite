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
import { ScrollArea } from "@/components/ui/scroll-area";

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

  // Modais de Confirmação para Histórico
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
    } finally { setLoading(false); }
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
      const { error } = await supabase.from("disciplines").insert({ 
        user_id: user!.id, name: newName.trim(), professor: newProfessor || null, color: newColor, is_extra_course: extraOnly, semester_label: currentLabel, archived: false 
      });
      if (error) throw error;
      toast({ title: "Disciplina criada na grade! 🎉" });
      setOpen(false); setNewName(""); setNewProfessor("");
      await loadDisciplines();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }

  async function handleRestorePeriod() {
    if (!restorePeriodLabel.trim() || !user) return;
    setIsProcessing(true);
    try {
      const newLabel = restorePeriodLabel.trim();
      const isNullTarget = restoreTargetLabel === "Sem Período" || !restoreTargetLabel;
      let query = supabase.from("disciplines").update({ archived: false, semester_label: newLabel }).eq("user_id", user.id).eq("archived", true).select();
      
      if (isNullTarget) query = query.is("semester_label", null);
      else query = query.eq("semester_label", restoreTargetLabel);

      const { data, error } = await query;
      if (error) throw error;

      await supabase.from("profiles").update({ current_semester_label: newLabel, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      if (setCurrentLabel) await setCurrentLabel(newLabel);

      setAllDisciplines([]);
      if (loadSemesters) await loadSemesters();
      await loadDisciplines();

      setActiveTab("active"); setRestoreDialogOpen(false);
      toast({ title: "Jornada Restaurada", description: `${data?.length || 0} matérias resgatadas do histórico.` });
    } catch (e: any) {
      toast({ title: "Erro na restauração", description: e.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  }

  async function handleDeletePeriod() {
    if (!user) return;
    setIsProcessing(true);
    try {
      const isNullTarget = deleteTargetLabel === "Sem Período" || !deleteTargetLabel;
      let query = supabase.from("disciplines").delete().eq("user_id", user.id).eq("archived", true);
      
      if (isNullTarget) query = query.is("semester_label", null);
      else query = query.eq("semester_label", deleteTargetLabel);

      const { error } = await query;
      if (error) throw error;

      await loadDisciplines();
      toast({ title: "Histórico excluído permanentemente." });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  }

  if (loading || isSwapping) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Grade...</p>
      </div>
    );
  }

  const title = extraOnly ? "Cursos Extras" : "Minhas Disciplinas";
  const emptyMsg = extraOnly ? "Nenhum curso complementar na sua grade." : "A grade curricular está limpa para este período.";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-8">
      
      {/* HEADER DE COMANDO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-muted/40 hover:bg-muted border border-border/40 shrink-0 transition-all" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{title}</h1>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mt-0.5">
              {extraOnly ? "Formação Complementar" : `Período: ${currentLabel || "Não Definido"}`}
            </p>
          </div>
        </div>

        {/* MODAL DE CRIAÇÃO (Nova Matéria) */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 sm:h-14 rounded-full font-black text-sm px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-all w-full sm:w-auto shrink-0">
              <Plus className="h-5 w-5 mr-1" /> Nova Matéria
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[32px] p-6 sm:p-8 border border-border/20 shadow-2xl bg-background/95 backdrop-blur-xl max-w-md">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-2xl font-black">{extraOnly ? "Novo Curso Extra" : "Nova Disciplina"}</DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
                {extraOnly ? "Cadastre um curso complementar para enriquecer seu currículo." : `Esta matéria será vinculada ao período ${currentLabel}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome da Matéria</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Anatomia Humana" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-bold text-base shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Docente / Plataforma</Label>
                <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do professor responsável" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-bold text-base shadow-inner" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cor de Identificação</Label>
                <div className="flex gap-3 flex-wrap bg-muted/20 p-4 rounded-[20px] border border-border/40">
                  {["#6366F1","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#8B5CF6","#84CC16", "#0F172A", "#64748B"].map((c) => (
                    <button key={c} type="button" onClick={() => setNewColor(c)} className={cn("h-10 w-10 rounded-full transition-transform shadow-md", newColor === c ? "ring-4 ring-offset-2 ring-primary scale-110" : "hover:scale-110")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={isSubmitting || !newName.trim()} className="w-full h-14 rounded-2xl font-black text-lg mt-4 shadow-md hover:scale-[1.02] transition-transform">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {isSubmitting ? "Gerando Grade..." : "Adicionar à Grade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* BARRA DE PESQUISA */}
      <div className="relative group animate-in slide-in-from-top-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Localizar matéria na grade..." className="pl-14 h-14 rounded-[24px] bg-card border-border/40 shadow-sm focus-visible:ring-primary transition-all text-base font-medium" />
      </div>

      {/* NAVEGAÇÃO DE ABAS REORDENADA */}
      <Tabs value={activeTab} onValueChange={changeTab} className="w-full space-y-6">
        <ScrollArea className="w-full">
          <TabsList className="w-full justify-start rounded-[24px] bg-transparent p-0 flex gap-2 h-auto">
            {/* 1. Em Curso */}
            <TabsTrigger value="active" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all">
              <GraduationCap className="h-4 w-4" /> Em Curso
            </TabsTrigger>
            
            {/* 2. Extras */}
            {!extraOnly && (
              <TabsTrigger value="extra" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all">
                <Sparkles className="h-4 w-4" /> Formação Extra
              </TabsTrigger>
            )}

            {/* 3. Histórico */}
            {!extraOnly && (
              <TabsTrigger value="history" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
            )}
          </TabsList>
        </ScrollArea>

        {/* CONTEÚDO 1: MATÉRIAS EM CURSO */}
        <TabsContent value="active" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
          {activeDisciplines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm mt-4">
              <div className="text-muted-foreground/30 flex justify-center bg-card p-4 rounded-3xl shadow-sm"><BookOpen className="h-10 w-10" /></div>
              <p className="text-base font-black tracking-wide text-foreground px-4 text-center">{emptyMsg}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeDisciplines.map((d) => (
                <Card key={d.id} onClick={() => navigate(`/disciplines/${d.id}`)} className="rounded-[28px] border border-border/20 bg-card shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-primary/30 group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-14 w-2.5 rounded-full shrink-0 group-hover:scale-y-110 transition-transform shadow-sm" style={{ backgroundColor: d.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-lg truncate text-foreground group-hover:text-primary transition-colors leading-tight">{d.name}</p>
                      {d.professor && <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground truncate mt-1.5">{d.professor}</p>}
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONTEÚDO 2: CURSOS EXTRAS */}
        {!extraOnly && (
          <TabsContent value="extra" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
            <ExtraCoursesTab />
          </TabsContent>
        )}

        {/* CONTEÚDO 3: HISTÓRICO DE SEMESTRES */}
        {!extraOnly && (
          <TabsContent value="history" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {archivedBySemester.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm mt-4">
                <div className="text-muted-foreground/30 flex justify-center bg-card p-4 rounded-3xl shadow-sm"><History className="h-10 w-10" /></div>
                <p className="text-base font-black tracking-wide text-foreground px-4 text-center">Sua cápsula do tempo está vazia.</p>
              </div>
            ) : (
              archivedBySemester.map(([sem, list]) => (
                <div key={sem} className="space-y-4 bg-muted/10 border border-border/30 p-5 sm:p-6 rounded-[32px] shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary shadow-sm" /> {sem} 
                      <span className="text-muted-foreground text-[10px] font-bold tracking-widest bg-background border border-border/40 px-2 py-0.5 rounded-md ml-1">{list.length} Matérias</span>
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-10 rounded-xl text-xs font-bold gap-2 border-border/50 bg-background hover:bg-muted shadow-sm" onClick={() => { setRestoreTargetLabel(sem); setRestorePeriodLabel(currentLabel || ""); setRestoreDialogOpen(true); }}>
                        <RefreshCcw className="h-4 w-4 text-primary" /> Resgatar
                      </Button>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive hover:text-white transition-colors shadow-sm" onClick={() => { setDeleteTargetLabel(sem); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Lista de matérias arquivadas agoras são CLIQUÁVEIS para visualização */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((d) => (
                      <div 
                        key={d.id} 
                        onClick={() => navigate(`/disciplines/${d.id}`)}
                        className="bg-card p-4 rounded-[20px] flex items-center gap-3 shadow-sm border border-border/20 group cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
                      >
                        <div className="h-10 w-1.5 rounded-full shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: d.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-foreground/80 group-hover:text-primary transition-colors">{d.name}</p>
                          {d.professor && <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate mt-1 opacity-70">{d.professor}</p>}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* MODAL DE CONFIRMAÇÃO: RESTAURAR PERÍODO */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="rounded-[32px] p-6 sm:p-8 border border-white/10 shadow-2xl bg-background/95 backdrop-blur-xl max-w-md">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <RefreshCcw className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-black">Restaurar Jornada</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
              Confirme para trazer as matérias de <strong>{restoreTargetLabel}</strong> de volta para o painel principal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rótulo do Destino</Label>
              <Input value={restorePeriodLabel} onChange={(e) => setRestorePeriodLabel(e.target.value)} placeholder="Ex: 2026.1" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary text-base font-bold" />
            </div>
            <Button onClick={handleRestorePeriod} disabled={isProcessing || !restorePeriodLabel.trim()} className="w-full h-14 rounded-2xl font-black text-lg mt-2 shadow-lg hover:scale-[1.02] transition-transform">
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <RefreshCcw className="h-5 w-5 mr-2" />} {isProcessing ? "Resgatando..." : "Confirmar Restauração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO: EXCLUSÃO PERMANENTE */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[32px] p-6 sm:p-8 border border-destructive/20 shadow-2xl bg-background/95 backdrop-blur-xl max-w-md">
          <AlertDialogHeader className="text-center space-y-2">
            <div className="mx-auto h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-2xl font-black text-destructive">Excluir Histórico?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-muted-foreground mt-2">
              Todas as matérias e anotações do período <strong>{deleteTargetLabel}</strong> serão apagadas permanentemente. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel className="h-14 flex-1 rounded-2xl font-bold text-base border-0 bg-muted hover:bg-muted/80 m-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePeriod} disabled={isProcessing} className="h-14 flex-1 rounded-2xl font-bold text-base bg-destructive hover:bg-destructive/90 text-white m-0 shadow-lg">
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />} Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
