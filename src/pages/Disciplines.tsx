import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Plus, BookOpen, ChevronRight, GraduationCap, 
  Loader2, History, ArrowLeft, RefreshCcw, Search,
  Palette, Trash2, AlertTriangle, Bell, MessageSquare
} from "lucide-react";
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
  const { toast } = useToast();
  
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [searchQuery, setSearchQuery] = useState("");
  
  // Estados de Restauração
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetLabel, setRestoreTargetLabel] = useState(""); 
  const [restorePeriodLabel, setRestorePeriodLabel] = useState(""); 

  // Estados de Exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetLabel, setDeleteTargetLabel] = useState("");

  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#6366F1");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const colors = [
    "#FFB3BA", "#BAFFC9", "#BAE1FF", "#E8BAFF", "#FF10F0", 
    "#39FF14", "#00FFFF", "#6366F1", "#10B981", "#F59E0B"
  ];

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
    
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [allDisciplines, searchQuery]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("disciplines").insert({
        user_id: user!.id,
        name: newName.trim(),
        professor: newProfessor.trim() || null,
        color: newColor,
        is_extra_course: extraOnly,
        semester_label: currentLabel,
        archived: false
      });

      if (error) throw error;
      
      toast({ title: "Registro Salvo", description: "O módulo foi adicionado à sua grade." });
      setOpen(false);
      setNewName("");
      setNewProfessor("");
      loadDisciplines();
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // SOLUÇÃO DEFINITIVA: Lógica para tratar NULL e "Sem Período"
  async function handleRestorePeriod() {
    if (!restorePeriodLabel.trim() || !user) return;
    setIsProcessing(true);
    
    try {
      const newLabel = restorePeriodLabel.trim();
      const isTargetEmpty = restoreTargetLabel === "Sem Período" || !restoreTargetLabel;

      // 1. Prepara a query de atualização
      let query = supabase
        .from("disciplines")
        .update({ archived: false, semester_label: newLabel })
        .eq("user_id", user.id);

      // Filtro crucial para pegar as matérias "Sem Período" (que são NULL no banco)
      if (isTargetEmpty) {
        query = query.is("semester_label", null);
      } else {
        query = query.eq("semester_label", restoreTargetLabel);
      }

      const { error: updateError } = await query;
      if (updateError) throw updateError;

      // 2. Sincroniza o Perfil para o novo label
      await supabase
        .from("profiles")
        .update({ current_semester_label: newLabel, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      // 3. Muda o estado global para que as matérias apareçam na aba Ativa
      if (setCurrentLabel) {
        await setCurrentLabel(newLabel);
      }

      toast({ 
        title: "Restauração Completa! 🚀", 
        description: `O ciclo "${newLabel}" agora está ativo.` 
      });

      setRestoreDialogOpen(false);
      setActiveTab("active"); // Muda visualmente para a aba "Em Curso"

      // 4. Recarrega os dados
      if (loadSemesters) await loadSemesters();
      await loadDisciplines();

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
      const isTargetEmpty = deleteTargetLabel === "Sem Período" || !deleteTargetLabel;
      
      let query = supabase
        .from("disciplines")
        .delete()
        .eq("user_id", user.id)
        .eq("archived", true);

      if (isTargetEmpty) {
        query = query.is("semester_label", null);
      } else {
        query = query.eq("semester_label", deleteTargetLabel);
      }

      const { error } = await query;
      if (error) throw error;

      toast({ title: "Histórico Removido" });
      setDeleteDialogOpen(false);
      if (loadSemesters) await loadSemesters();
      await loadDisciplines();
    } catch (e: any) {
      toast({ title: "Erro na exclusão", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  const renderDisciplineCard = (d: Discipline) => (
    <Card 
      key={d.id} 
      className="group relative overflow-hidden border-border/40 bg-card hover:bg-card/80 transition-all duration-300 rounded-[32px] shadow-sm hover:shadow-2xl hover:border-primary/30 active:scale-[0.97] cursor-pointer"
      onClick={() => navigate(`/disciplines/${d.id}`)}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2" style={{ backgroundColor: d.color }} />
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <div 
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform duration-500"
            style={{ backgroundColor: `${d.color}15`, border: `1px solid ${d.color}30` }}
          >
            {extraOnly 
              ? <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: d.color }} /> 
              : <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: d.color }} />
            }
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-lg sm:text-xl tracking-tight truncate group-hover:text-primary transition-colors">
              {d.name}
            </h3>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.professor || "Docente não informado"}</span>
            </p>
          </div>
        </div>
        <ChevronRight className="h-6 w-6 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 hidden sm:block" />
      </CardContent>
    </Card>
  );

  if (loading || isSwapping) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          {isSwapping ? "Sincronizando Ciclo..." : "Carregando Módulos..."}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24 px-4 sm:px-6 overflow-x-hidden pt-6">
      
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/40 shrink-0">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter truncate">
              {extraOnly ? "Cursos Extras" : "Disciplinas"}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
              {extraOnly ? "CAPACITAÇÕES" : `GRADE ATIVA • ${currentLabel}`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 sm:h-16 px-8 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all w-full sm:w-auto">
              <Plus className="mr-2 h-5 w-5" /> Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] bg-card border-border rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl font-black tracking-tight">Novo Módulo</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm">Adicione para o período <strong>{currentLabel}</strong>.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Nome da Matéria</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Anatomia Clínica..." className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Docente</Label>
                <Input value={newProfessor} onChange={e => setNewProfessor(e.target.value)} placeholder="Nome do professor" className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-medium focus:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Cor</Label>
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-14 w-full rounded-2xl bg-muted/20 border-border/50 justify-start gap-4 font-bold hover:bg-background transition-colors">
                      <div className="h-6 w-6 rounded-lg shadow-sm" style={{ backgroundColor: newColor }} />
                      <span className="text-foreground">Selecionar Cor</span>
                      <Palette className="ml-auto h-5 w-5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 rounded-[24px] border-border shadow-xl">
                    <div className="grid grid-cols-5 gap-3">
                      {colors.map(c => (
                        <button key={c} type="button" onClick={() => { setNewColor(c); setColorPickerOpen(false); }} className={cn("h-10 w-10 rounded-xl transition-all active:scale-90", newColor === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-lg" : "opacity-50 hover:opacity-100")} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleCreate} disabled={isSubmitting || !newName.trim()} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary shadow-lg shadow-primary/20">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Registro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Busca */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input placeholder="Buscar módulo ou docente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-16 pl-14 pr-6 rounded-[24px] bg-card border-border/40 shadow-sm text-base sm:text-lg font-bold" />
      </div>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
        <TabsList className="bg-card/50 backdrop-blur-sm border border-border/40 p-1.5 rounded-[20px] h-auto w-full sm:w-fit grid grid-cols-2 shadow-sm">
          <TabsTrigger value="active" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-4 sm:px-10 py-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Em Curso</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-4 sm:px-10 py-3.5 data-[state=active]:bg-muted transition-all">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
          {activeDisciplines.length === 0 ? (
            <div className="py-24 px-6 rounded-[40px] border-2 border-dashed border-border/40 flex flex-col items-center text-center bg-card/20">
              <BookOpen className="h-14 w-14 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl sm:text-2xl font-black text-foreground">Nenhum módulo ativo</h3>
              <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">Inicie um novo ciclo clicando em "Novo Registro" para o período {currentLabel}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {activeDisciplines.map(renderDisciplineCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
          {archivedBySemester.length === 0 ? (
            <div className="py-24 px-6 text-center flex flex-col items-center bg-card/20 rounded-[40px] border border-border/30">
              <History className="h-14 w-14 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-black text-foreground">Arquivo Vazio</h3>
            </div>
          ) : (
            archivedBySemester.map(([label, items]) => (
              <section key={label} className="space-y-6 bg-card/20 p-6 rounded-[32px] border border-border/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shadow-inner"><History className="h-7 w-7 text-muted-foreground" /></div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">{label}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{items.length} Matérias Arquivadas</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none h-12 rounded-xl text-[10px] font-black uppercase border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                      onClick={() => {
                        setRestoreTargetLabel(label);
                        setRestorePeriodLabel(label === "Sem Período" ? "" : label); 
                        setRestoreDialogOpen(true);
                      }}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" /> Restaurar
                    </Button>
                    <Button variant="outline" className="h-12 w-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => { setDeleteTargetLabel(label); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {items.map(renderDisciplineCard)}
                </div>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[400px] bg-card border-border rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
              <RefreshCcw className="text-amber-500 h-6 w-6" /> Reativar Ciclo
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground text-sm">
              As matérias voltarão para "Em Curso". Digite o nome do período atual (ex: 2026.1).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identificador do Período</Label>
              <Input value={restorePeriodLabel} onChange={e => setRestorePeriodLabel(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 text-lg font-black text-center focus:ring-amber-500/40" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px]">Cancelar</Button>
              <Button onClick={handleRestorePeriod} disabled={!restorePeriodLabel.trim() || isProcessing} className="flex-1 h-12 rounded-2xl bg-amber-500 text-white hover:bg-amber-600 font-black uppercase text-[10px]">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-[420px] rounded-[32px] bg-card border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <AlertDialogTitle className="text-xl font-black text-destructive text-left">Excluir Período?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground text-left text-sm">Esta ação apagará permanentemente o ciclo <strong>{deleteTargetLabel}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none font-bold uppercase text-[10px] bg-muted/50">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePeriod} disabled={isProcessing} className="h-12 rounded-2xl bg-destructive text-white font-black uppercase text-[10px]">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
