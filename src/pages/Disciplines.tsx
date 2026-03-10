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
  Palette, Trash2, AlertTriangle
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
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Novo estado para loaders de massa
  const [searchQuery, setSearchQuery] = useState("");
  
  // Estados de Restauração
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetLabel, setRestoreTargetLabel] = useState(""); // Qual período será restaurado
  const [restorePeriodLabel, setRestorePeriodLabel] = useState(""); // Novo nome

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

  // Filtragem Dinâmica (Semestre Atual + Pesquisa)
  const activeDisciplines = useMemo(() => {
    return allDisciplines.filter(d => 
      !d.archived && 
      d.semester_label === currentLabel &&
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allDisciplines, currentLabel, searchQuery]);

  // Histórico Agrupado (Com Pesquisa)
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

  // Lógica Avançada: Restaurar e Renomear para "Em Curso"
  async function handleRestorePeriod() {
    if (!restorePeriodLabel.trim() || !user) return;
    setIsProcessing(true);
    try {
      const newLabel = restorePeriodLabel.trim();

      // 1. Atualiza as matérias (Desarquiva e muda o rótulo pro novo nome)
      const { error: updateError } = await supabase
        .from("disciplines")
        .update({ archived: false, semester_label: newLabel })
        .eq("user_id", user.id)
        .eq("semester_label", restoreTargetLabel)
        .eq("archived", true);

      if (updateError) throw updateError;

      // 2. Define o perfil para focar nesse novo semestre restaurado
      await supabase
        .from("profiles")
        .update({ current_semester_label: newLabel, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      toast({ 
        title: "Período Restaurado! 🚀", 
        description: `As matérias foram movidas para "Em Curso" sob o ciclo ${newLabel}.` 
      });

      setRestoreDialogOpen(false);
      if (setCurrentLabel) setCurrentLabel(newLabel);
      if (loadSemesters) await loadSemesters();
      await loadDisciplines();
    } catch (e: any) {
      toast({ title: "Erro na restauração", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  // Lógica Avançada: Excluir Período Definitivamente
  async function handleDeletePeriod() {
    if (!user) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("disciplines")
        .delete()
        .eq("user_id", user.id)
        .eq("semester_label", deleteTargetLabel)
        .eq("archived", true);

      if (error) throw error;

      toast({ 
        title: "Histórico Apagado", 
        description: `O período ${deleteTargetLabel} foi excluído permanentemente.` 
      });
      
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
          {isSwapping ? "Restaurando Ciclo..." : "Sincronizando Módulos..."}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* 1. Cabeçalho Responsivo */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 hover:bg-muted border border-border/40 shrink-0 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter truncate">
              {extraOnly ? "Cursos Extras" : "Disciplinas"}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">
              {extraOnly ? "CAPACITAÇÕES" : `GRADE ATIVA • ${currentLabel}`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 sm:h-16 px-8 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto">
              <Plus className="mr-2 h-5 w-5" /> Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] bg-card border-border rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl font-black tracking-tight">Configurar Módulo</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm">
                Adicione uma nova matéria para o período letivo <strong>{currentLabel}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome da Matéria / Curso</Label>
                <Input 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Anatomia Clínica..." 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/40 focus:bg-background transition-colors" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Docente (opcional)</Label>
                <Input 
                  value={newProfessor} 
                  onChange={e => setNewProfessor(e.target.value)}
                  placeholder="Nome do professor" 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-medium focus:ring-primary/40 focus:bg-background transition-colors" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cor do Módulo</Label>
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="h-14 w-full rounded-2xl bg-muted/20 border-border/50 justify-start gap-4 font-bold hover:bg-background transition-colors"
                    >
                      <div className="h-6 w-6 rounded-lg shadow-sm" style={{ backgroundColor: newColor }} />
                      <span className="text-foreground">Selecionar Cor</span>
                      <Palette className="ml-auto h-5 w-5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 rounded-[24px] border-border shadow-xl" align="center">
                    <div className="grid grid-cols-5 gap-3">
                      {colors.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setNewColor(c); setColorPickerOpen(false); }}
                          className={cn(
                            "h-10 w-10 rounded-xl transition-all active:scale-90",
                            newColor === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-lg" : "opacity-50 hover:opacity-100 hover:scale-105"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button 
                onClick={handleCreate} 
                disabled={isSubmitting || !newName.trim()} 
                className="w-full h-14 mt-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Registro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* 2. Barra de Busca */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar módulo ou docente..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-16 pl-14 pr-6 rounded-[24px] bg-card border-border/40 shadow-sm text-base sm:text-lg font-bold placeholder:font-medium placeholder:text-muted-foreground/50 focus:ring-primary/40 focus:bg-background transition-all"
        />
      </div>

      {/* 3. Abas de Grade e Histórico */}
      <Tabs defaultValue="active" className="w-full space-y-8">
        <TabsList className="bg-card/50 backdrop-blur-sm border border-border/40 p-1.5 rounded-[20px] h-auto w-full sm:w-fit grid grid-cols-2 shadow-sm">
          <TabsTrigger value="active" className="rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest px-4 sm:px-10 py-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            Em Curso
          </TabsTrigger>
          <TabsTrigger value="archive" className="rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest px-4 sm:px-10 py-3.5 data-[state=active]:bg-muted data-[state=active]:shadow-md transition-all">
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Em Curso */}
        <TabsContent value="active" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
          {activeDisciplines.length === 0 ? (
            <div className="py-24 px-6 rounded-[40px] border-2 border-dashed border-border/40 flex flex-col items-center text-center bg-card/20">
              <div className="h-20 w-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6 shadow-inner">
                {extraOnly ? <GraduationCap className="h-10 w-10 text-muted-foreground/30" /> : <BookOpen className="h-10 w-10 text-muted-foreground/30" />}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">
                {searchQuery ? "Nenhum resultado" : "Nenhum módulo ativo"}
              </h3>
              <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">
                {searchQuery 
                  ? "Tente buscar por outro nome ou verifique a aba de Histórico." 
                  : `Inicie um novo ciclo clicando em "Novo Registro" para o período ${currentLabel}.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {activeDisciplines.map(renderDisciplineCard)}
            </div>
          )}
        </TabsContent>

        {/* Tab: Histórico com Nova Lógica */}
        <TabsContent value="archive" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
          {archivedBySemester.length === 0 ? (
            <div className="py-24 px-6 text-center flex flex-col items-center bg-card/20 rounded-[40px] border border-border/30">
              <History className="h-14 w-14 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-black text-foreground">Arquivo Vazio</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">Sem registros passados</p>
            </div>
          ) : (
            archivedBySemester.map(([label, items]) => (
              <section key={label} className="space-y-6 bg-card/20 p-6 rounded-[32px] border border-border/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-muted border border-border/50 flex items-center justify-center shrink-0 shadow-inner">
                      <History className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground">{label}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {items.length} Matérias Arquivadas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 active:scale-95 transition-all shadow-sm"
                      onClick={() => {
                        setRestoreTargetLabel(label);
                        setRestorePeriodLabel(label); // Auto-preenche com o nome antigo
                        setRestoreDialogOpen(true);
                      }}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" /> Restaurar
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-12 w-12 shrink-0 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 bg-background hover:border-destructive/40 active:scale-90 transition-all shadow-sm"
                      onClick={() => {
                        setDeleteTargetLabel(label);
                        setDeleteDialogOpen(true);
                      }}
                      title="Excluir Período"
                    >
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

      {/* Modal 1: Restauração Interativa */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[400px] bg-card border-border rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
              <RefreshCcw className="text-amber-500 h-6 w-6" /> Reativar Ciclo
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground text-sm">
              As matérias voltarão para a aba "Em Curso". Você pode atualizar o nome do período abaixo se desejar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identificador do Período</Label>
              <Input 
                value={restorePeriodLabel} 
                onChange={e => setRestorePeriodLabel(e.target.value)}
                className="h-14 rounded-2xl bg-muted/20 border-border/50 text-lg font-black text-center focus:ring-amber-500/40 transition-colors" 
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} className="flex-1 h-12 rounded-2xl border-border/50 font-bold uppercase text-[10px] tracking-widest hover:bg-muted">
                Cancelar
              </Button>
              <Button onClick={handleRestorePeriod} disabled={!restorePeriodLabel.trim() || isProcessing} className="flex-1 h-12 rounded-2xl bg-amber-500 text-white hover:bg-amber-600 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg shadow-amber-500/20">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Exclusão Permanente (Danger Zone) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-[420px] rounded-[32px] bg-card border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl font-black tracking-tight text-destructive text-left">
                Destruir Período?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-muted-foreground text-left text-sm">
              Você está prestes a deletar permanentemente o ciclo <strong className="text-foreground">{deleteTargetLabel}</strong> e todas as matérias contidas nele. Esta ação <strong className="text-destructive">não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none font-bold uppercase text-[10px] tracking-widest bg-muted/50 hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePeriod}
              disabled={isProcessing}
              className="h-12 rounded-2xl bg-destructive text-white font-black uppercase text-[10px] tracking-widest hover:bg-destructive/90 active:scale-95 transition-all"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sim, Excluir Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

