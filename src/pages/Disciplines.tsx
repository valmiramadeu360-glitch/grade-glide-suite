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
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Plus, BookOpen, ChevronRight, GraduationCap, 
  Loader2, History, ArrowLeft, RefreshCcw, Search,
  Filter, AlertCircle, Palette
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Interface Universal (Sem placeholders nichados)
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
  const { currentLabel, restoreSemester, isLoading: isSwapping } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Restore State
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restorePeriodLabel, setRestorePeriodLabel] = useState("");

  // Form State
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

  // Filtragem Reativa (Time Machine + Busca)
  const activeDisciplines = useMemo(() => {
    return allDisciplines.filter(d => 
      !d.archived && 
      d.semester_label === currentLabel &&
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allDisciplines, currentLabel, searchQuery]);

  // Histórico Agrupado por Semestre
  const archivedBySemester = useMemo(() => {
    const archived = allDisciplines.filter(d => d.archived);
    const grouped: Record<string, Discipline[]> = {};
    
    archived.forEach(d => {
      const sem = d.semester_label || "Sem período";
      if (!grouped[sem]) grouped[sem] = [];
      grouped[sem].push(d);
    });
    
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [allDisciplines]);

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
      
      toast({ title: "Módulo Adicionado", description: "Dados sincronizados com sucesso." });
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

  const renderDisciplineCard = (d: Discipline) => (
    <Card 
      key={d.id} 
      className="group relative overflow-hidden border-border/40 bg-card hover:bg-accent/5 transition-all duration-300 rounded-[32px] shadow-sm hover:shadow-2xl active:scale-[0.97] cursor-pointer"
      onClick={() => navigate(`/disciplines/${d.id}`)}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: d.color }} />
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <div 
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform"
            style={{ backgroundColor: `${d.color}15`, border: `1px solid ${d.color}30` }}
          >
            <BookOpen className="h-7 w-7" style={{ color: d.color }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-lg tracking-tight truncate group-hover:text-primary transition-colors">
              {d.name}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.professor || "Docente não informado"}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </CardContent>
    </Card>
  );

  if (loading || isSwapping) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando Ciclos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-safe px-4 sm:px-6">
      
      {/* 1. Cabeçalho Adaptativo */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="h-12 w-12 rounded-xl bg-card border border-border/40 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-black tracking-tighter">
              {extraOnly ? "Cursos" : "Disciplinas"}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
              {extraOnly ? "CAPACITAÇÕES EXTRACURRICULARES" : `GRADE ATIVA • ${currentLabel}`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto">
              <Plus className="mr-2 h-5 w-5" /> Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border rounded-[32px] p-8 shadow-2xl">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-black tracking-tight">Configurar Módulo</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground">
                Adicione uma nova matéria para o período <strong>{currentLabel}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome da Matéria</Label>
                <Input 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Anatomia, Direito Penal..." 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome do Professor (opcional)</Label>
                <Input 
                  value={newProfessor} 
                  onChange={e => setNewProfessor(e.target.value)}
                  placeholder="Ex: Prof. Dr. João Silva" 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cor de Identificação</Label>
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="h-14 w-full rounded-2xl bg-muted/20 border-border/50 justify-start gap-4 font-bold"
                    >
                      <div 
                        className="h-8 w-8 rounded-xl shadow-inner" 
                        style={{ backgroundColor: newColor }}
                      />
                      <span className="text-muted-foreground">Clique para escolher a cor</span>
                      <Palette className="ml-auto h-5 w-5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 rounded-2xl" align="start">
                    <div className="grid grid-cols-5 gap-3">
                      {colors.map(c => (
                        <button
                          key={c}
                          onClick={() => { setNewColor(c); setColorPickerOpen(false); }}
                          className={cn(
                            "h-10 w-10 rounded-xl transition-all active:scale-90",
                            newColor === c ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-lg" : "opacity-70 hover:opacity-100"
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
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Disciplina"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* 2. Barra de Busca e Filtros */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar módulo ou docente..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-16 pl-14 pr-6 rounded-[24px] bg-card border-border/40 shadow-sm text-lg font-bold placeholder:font-medium placeholder:text-muted-foreground/40 focus:ring-primary/20"
        />
      </div>

      {/* 3. Abas de Gestão */}
      <Tabs defaultValue="active" className="w-full space-y-10">
        <TabsList className="bg-card/50 border border-border/40 p-1.5 rounded-2xl h-auto w-fit grid grid-cols-2">
          <TabsTrigger value="active" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 py-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            Em Curso
          </TabsTrigger>
          <TabsTrigger value="archive" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 py-3.5 data-[state=active]:bg-muted transition-all">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeDisciplines.length === 0 ? (
            <div className="p-24 rounded-[40px] border-2 border-dashed border-border/40 flex flex-col items-center text-center bg-card/20">
              <div className="h-20 w-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
                <BookOpen className="h-10 w-10 text-muted-foreground/20" />
              </div>
              <h3 className="text-xl font-black">Nenhum módulo ativo</h3>
              <p className="text-sm font-medium text-muted-foreground mt-2 max-w-xs">
                Inicie um novo ciclo clicando em "Novo Registro" ou altere o semestre no topo da tela.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeDisciplines.map(renderDisciplineCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {archivedBySemester.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center">
              <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Arquivo Vazio</p>
            </div>
          ) : (
            archivedBySemester.map(([label, items]) => (
              <section key={label} className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center">
                      <History className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter">{label}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{items.length} Matérias Arquivadas</p>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="h-11 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-500">
                        <RefreshCcw className="mr-2 h-4 w-4" /> Restaurar Ciclo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border rounded-[32px] p-8">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                          <AlertCircle className="text-amber-500 h-6 w-6" /> Trocar Período Ativo?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-base">
                          Ao restaurar o ciclo <strong>{label}</strong>, as matérias de <strong>{currentLabel}</strong> (atuais) serão arquivadas para dar lugar a estas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3 mt-6">
                        <AlertDialogCancel className="h-12 rounded-2xl border-none bg-muted font-bold uppercase text-[10px] tracking-widest">Manter como está</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => restoreSemester(label)}
                          className="h-12 rounded-2xl bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest"
                        >
                          Confirmar Troca
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(renderDisciplineCard)}
                </div>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
      
      {/* iOS Bottom Safe Spacer */}
      <div className="pb-24" />
    </div>
  );
}
