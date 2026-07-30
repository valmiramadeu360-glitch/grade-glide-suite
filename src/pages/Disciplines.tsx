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

import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History, ArrowLeft, RefreshCcw, Search, Trash2, AlertTriangle, Sparkles, Tag } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline { 
  id: string; 
  name: string; 
  code: string | null; 
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

  // Campos do Formulário de Criação (Com Código SIGA incluído)
  const [newName, setNewName] = useState(""); 
  const [newCode, setNewCode] = useState(""); 
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
      (
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.professor && d.professor.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    );
  }, [allDisciplines, currentLabel, searchQuery]);

  const archivedBySemester = useMemo(() => {
    const archived = allDisciplines.filter(d => 
      d.archived && 
      (
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase()))
      )
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
        user_id: user!.id, 
        name: newName.trim(), 
        code: newCode.trim().toUpperCase() || null, // Código SIGA salvo
        professor: newProfessor.trim() || null, 
        color: newColor, 
        is_extra_course: extraOnly, 
        semester_label: currentLabel, 
        archived: false 
      });
      if (error) throw error;
      toast({ title: "Disciplina criada na grade! 🎉" });
      setOpen(false); 
      setNewName(""); 
      setNewCode(""); 
      setNewProfessor("");
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
      <div className="flex h-[80vh] items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Grade...</p>
      </div>
    );
  }

  const title = extraOnly ? "Cursos Extras" : "Minhas Disciplinas";
  const emptyMsg = extraOnly ? "Nenhum curso complementar na sua grade." : "A grade curricular está limpa para este período.";

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-300 pb-28 px-4 sm:px-6 pt-3">
      
      {/* HEADER DE COMANDO COMPACTO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-muted/40 hover:bg-muted border border-border/40 shrink-0 transition-all" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">{title}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-0.5 truncate">
              {extraOnly ? "Formação Complementar" : `Período: ${currentLabel || "Não Definido"}`}
            </p>
          </div>
        </div>

        {/* MODAL DE CRIAÇÃO (Nova Matéria) */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-md active:scale-95 transition-all w-full sm:w-auto shrink-0">
              <Plus className="h-4 w-4" /> Nova Matéria
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[28px] p-6 sm:p-7 border border-border/20 shadow-2xl bg-background/95 backdrop-blur-xl max-w-md">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl font-black">{extraOnly ? "Novo Curso Extra" : "Nova Disciplina"}</DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
                {extraOnly ? "Cadastre um curso complementar para enriquecer seu currículo." : `Esta matéria será vinculada ao período ${currentLabel}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome da Matéria *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Macroeconomia II" className="h-11 rounded-xl bg-muted/30 border-0 focus-visible:ring-primary font-semibold text-sm shadow-inner" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Código SIGA</Label>
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ex: CECO0078" className="h-11 rounded-xl bg-muted/30 border-0 focus-visible:ring-primary font-bold text-sm uppercase shadow-inner" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Docente</Label>
                  <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do professor" className="h-11 rounded-xl bg-muted/30 border-0 focus-visible:ring-primary font-medium text-sm shadow-inner" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cor de Identificação</Label>
                <div className="flex gap-2 flex-wrap bg-muted/20 p-3 rounded-xl border border-border/40">
                  {["#6366F1","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#8B5CF6","#84CC16", "#0F172A", "#64748B"].map((c) => (
                    <button key={c} type="button" onClick={() => setNewColor(c)} className={cn("h-7 w-7 rounded-full transition-transform shadow-sm", newColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={isSubmitting || !newName.trim()} className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm mt-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isSubmitting ? "Gerando Grade..." : "Adicionar à Grade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* BARRA DE PESQUISA COMPACTA */}
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, código SIGA ou professor..." className="pl-10 h-11 rounded-xl bg-card border-border/40 shadow-sm focus-visible:ring-primary text-xs font-medium" />
      </div>

      {/* NAVEGAÇÃO DE ABAS COMPACTA */}
      <Tabs value={activeTab} onValueChange={changeTab} className="w-full space-y-4">
        <ScrollArea className="w-full">
          <TabsList className="w-full justify-start rounded-xl bg-muted/30 p-1 flex gap-1 h-auto border border-border/30">
            <TabsTrigger value="active" className="rounded-lg font-bold text-xs h-9 px-4 gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-muted-foreground transition-all">
              <GraduationCap className="h-3.5 w-3.5" /> Em Curso
            </TabsTrigger>
            
            {!extraOnly && (
              <TabsTrigger value="extra" className="rounded-lg font-bold text-xs h-9 px-4 gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-muted-foreground transition-all">
                <Sparkles className="h-3.5 w-3.5" /> Formação Extra
              </TabsTrigger>
            )}

            {!extraOnly && (
              <TabsTrigger value="history" className="rounded-lg font-bold text-xs h-9 px-4 gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-muted-foreground transition-all">
                <History className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
            )}
          </TabsList>
        </ScrollArea>

        {/* CONTEÚDO 1: MATÉRIAS EM CURSO */}
        <TabsContent value="active" className="mt-0">
          {activeDisciplines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-muted/10 rounded-2xl border border-dashed border-border/40 shadow-sm">
              <BookOpen className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">{emptyMsg}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeDisciplines.map((d) => (
                <Card key={d.id} onClick={() => navigate(`/disciplines/${d.id}`)} className="rounded-2xl border border-border/30 bg-card shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-primary/40 group p-4 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-transform group-hover:scale-y-105" style={{ backgroundColor: d.color }} />
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      {d.code && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md">
                          <Tag className="h-2.5 w-2.5" /> {d.code}
                        </span>
                      )}
                      <p className="font-black text-sm truncate text-foreground group-hover:text-primary transition-colors leading-tight">{d.name}</p>
                      <p className="text-[11px] font-medium text-muted-foreground truncate">
                        {d.professor ? `Prof. ${d.professor}` : "Nenhum professor informado"}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONTEÚDO 2: CURSOS EXTRAS */}
        {!extraOnly && (
          <TabsContent value="extra" className="mt-0">
            <ExtraCoursesTab />
          </TabsContent>
        )}

        {/* CONTEÚDO 3: HISTÓRICO DE SEMESTRES */}
        {!extraOnly && (
          <TabsContent value="history" className="mt-0 space-y-4">
            {archivedBySemester.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 bg-muted/10 rounded-2xl border border-dashed border-border/40 shadow-sm">
                <History className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs font-bold text-foreground">Sua cápsula do tempo está vazia.</p>
              </div>
            ) : (
              archivedBySemester.map(([sem, list]) => (
                <div key={sem} className="space-y-3 bg-muted/10 border border-border/30 p-4 sm:p-5 rounded-2xl shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" /> {sem} 
                      <span className="text-muted-foreground text-[10px] font-bold bg-card border border-border/40 px-2 py-0.5 rounded-md ml-1">{list.length} Matérias</span>
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-1 border-border/50 bg-card hover:bg-muted" onClick={() => { setRestoreTargetLabel(sem); setRestorePeriodLabel(currentLabel || ""); setRestoreDialogOpen(true); }}>
                        <RefreshCcw className="h-3.5 w-3.5 text-primary" /> Resgatar
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive hover:text-white transition-colors" onClick={() => { setDeleteTargetLabel(sem); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {list.map((d) => (
                      <div 
                        key={d.id} 
                        onClick={() => navigate(`/disciplines/${d.id}`)}
                        className="bg-card p-3 rounded-xl flex items-center gap-2.5 shadow-sm border border-border/20 group cursor-pointer hover:border-primary/40 transition-all"
                      >
                        <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate text-foreground group-hover:text-primary transition-colors">{d.name}</p>
                          {d.professor && <p className="text-[10px] font-medium text-muted-foreground truncate">{d.professor}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
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
        <DialogContent className="rounded-[28px] p-6 border border-border/20 shadow-xl bg-background max-w-sm">
          <DialogHeader className="text-center space-y-1.5">
            <div className="mx-auto h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-1">
              <RefreshCcw className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-lg font-black">Restaurar Jornada</DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              Trazer matérias de <strong>{restoreTargetLabel}</strong> de volta para o painel principal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Rótulo do Destino</Label>
              <Input value={restorePeriodLabel} onChange={(e) => setRestorePeriodLabel(e.target.value)} placeholder="Ex: 2026.1" className="h-11 rounded-xl bg-muted/30 border-0 text-sm font-bold" />
            </div>
            <Button onClick={handleRestorePeriod} disabled={isProcessing || !restorePeriodLabel.trim()} className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm mt-1">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />} {isProcessing ? "Resgatando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO: EXCLUSÃO PERMANENTE */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[28px] p-6 border border-destructive/20 shadow-xl bg-background max-w-sm">
          <AlertDialogHeader className="text-center space-y-1.5">
            <div className="mx-auto h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center mb-1">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg font-black text-destructive">Excluir Histórico?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium text-muted-foreground">
              As matérias e anotações do período <strong>{deleteTargetLabel}</strong> serão apagadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-xl font-bold text-xs border-0 bg-muted hover:bg-muted/80 m-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePeriod} disabled={isProcessing} className="h-11 flex-1 rounded-xl font-bold text-xs bg-destructive hover:bg-destructive/90 text-white m-0 shadow-sm">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
