import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon, BookOpen, Clock, AlertTriangle, 
  CheckCircle2, ArrowRight, Cloud, CloudOff, History, 
  Loader2, Sparkles, RefreshCcw, UserCircle 
} from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Interfaces Universais (Sem placeholders nichados)
interface TodayClass {
  discipline_name: string;
  discipline_id: string;
  color: string;
  start_time: string;
  end_time: string;
  room: string | null;
}

interface Reminder {
  id: string;
  title: string;
  type: string;
  due_date: string;
  completed: boolean;
  discipline_name?: string;
  discipline_color?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { 
    currentLabel, setCurrentLabel, allSemesters, loadSemesters, 
    endSemester, restoreSemester, isLoading: semesterLoading 
  } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Determina se estamos olhando para um período que não é o "Ativo" no Perfil
  const [activeSemesterFromProfile, setActiveSemesterFromProfile] = useState("");
  const isHistoricalView = useMemo(() => {
    return activeSemesterFromProfile !== "" && currentLabel !== activeSemesterFromProfile;
  }, [currentLabel, activeSemesterFromProfile]);

  const [showEndSemester, setShowEndSemester] = useState(false);
  const [nextSemesterInput, setNextSemesterInput] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, currentLabel]);

  async function loadDashboard() {
    setLoading(true);
    try {
      // Busca dados de meta-contexto (Perfil)
      const { data: profile } = await supabase
        .from("profiles")
        .select("semester, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (profile?.semester) setActiveSemesterFromProfile(profile.semester);

      // Métricas de Disciplinas do Contexto Selecionado
      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester", currentLabel);

      const discIds = (disciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      // Lógica de Aulas do Dia (BI Reativo)
      if (discIds.length > 0 && !isHistoricalView) {
        const today = new Date().getDay();
        const { data: schedule } = await supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("day_of_week", today)
          .eq("user_id", user!.id)
          .in("discipline_id", discIds);

        setTodayClasses((schedule ?? []).map((s: any) => ({
          discipline_name: s.disciplines?.name ?? "Módulo",
          discipline_id: s.discipline_id,
          color: s.disciplines?.color ?? "#6366f1",
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
        })).sort((a, b) => a.start_time.localeCompare(b.start_time)));
      } else {
        setTodayClasses([]);
      }

      // Lembretes do Semestre
      if (!isHistoricalView) {
        const { data: remData } = await supabase
          .from("reminders")
          .select("*, disciplines(name, color)")
          .eq("completed", false)
          .eq("user_id", user!.id)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(6);

        setReminders((remData ?? []).filter((r: any) => 
          !r.discipline_id || discIds.includes(r.discipline_id)
        ).map((r: any) => ({
          ...r,
          discipline_name: r.disciplines?.name,
          discipline_color: r.disciplines?.color,
        })));
      } else {
        setReminders([]);
      }

      // Cálculo de Progresso (PWA Offline-Ready)
      if (isHistoricalView) {
        setSemesterProgress(100);
      } else if (profile?.semester_start && profile?.semester_end) {
        const start = startOfDay(new Date(profile.semester_start));
        const end = startOfDay(new Date(profile.semester_end));
        const now = startOfDay(new Date());
        const total = differenceInDays(end, start);
        if (total > 0) {
          const progress = Math.round((differenceInDays(now, start) / total) * 100);
          setSemesterProgress(Math.min(100, Math.max(0, progress)));
        }
      }
    } catch (e) {
      console.error("Dashboard Sync Error", e);
    } finally {
      setLoading(false);
    }
  }

  // Máquina do Tempo: Ações de Swap e Encerramento
  const onEndSemester = async () => {
    await endSemester(nextSemesterInput);
    setShowEndSemester(false);
    setNextSemesterInput("");
  };

  const onRestoreSemester = async () => {
    await restoreSemester(currentLabel);
  };

  if (loading || semesterLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando BI...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* 1. Máquina do Tempo: AlertDialog de Encerramento */}
      <AlertDialog open={showEndSemester} onOpenChange={setShowEndSemester}>
        <AlertDialogContent className="rounded-[32px] bg-card border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">Encerrar Período?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              As matérias de <strong>{currentLabel}</strong> serão arquivadas. Digite o rótulo do novo ciclo (ex: 2026.2):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={nextSemesterInput}
            onChange={e => setNextSemesterInput(e.target.value)}
            placeholder="Novo Semestre..."
            className="h-14 rounded-2xl text-center font-black text-lg border-primary/20 bg-muted/20"
          />
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none font-bold uppercase text-[10px] tracking-widest">Ainda não</AlertDialogCancel>
            <AlertDialogAction
              onClick={onEndSemester}
              disabled={!nextSemesterInput.trim()}
              className="h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest"
            >
              Arquivar & Iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Reativo */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentLabel} onValueChange={setCurrentLabel}>
              <SelectTrigger className="w-fit h-11 bg-primary/10 text-primary border-none font-black text-xs rounded-2xl px-5 hover:bg-primary/20 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl border-border bg-card">
                {allSemesters.map(s => (
                  <SelectItem key={s} value={s} className="font-bold py-3">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isHistoricalView ? (
              <Button 
                onClick={onRestoreSemester}
                className="h-11 rounded-2xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-amber-500/20"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Restaurar como Atual
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => setShowEndSemester(true)}
                className="h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <History className="mr-2 h-4 w-4" /> Encerrar Período
              </Button>
            )}
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
            Visão <span className="text-primary">Acadêmica</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
           <Button 
             variant="outline" 
             onClick={() => navigate('/profile')}
             className="h-14 rounded-2xl border-border bg-card px-6 flex items-center gap-3 shadow-md active:scale-95 transition-all"
           >
             <UserCircle className="h-6 w-6 text-primary" />
             <div className="text-left">
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meu Perfil</p>
               <p className="text-sm font-bold truncate max-w-[120px]">{user?.email?.split('@')[0]}</p>
             </div>
           </Button>
        </div>
      </header>

      {/* Grid de Métricas de BI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-border/40 bg-card/60 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8 flex items-center gap-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Cadeiras Ativas</p>
              <p className="text-4xl font-black tracking-tighter">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>

        {/* Barra de Progresso do Ciclo */}
        <Card className="md:col-span-2 rounded-[32px] border-border/40 bg-card/60 backdrop-blur-xl shadow-xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
            <Sparkles className="h-32 w-32" />
          </div>
          <CardContent className="p-8">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Tempo do Período</p>
                <p className="text-4xl font-black tracking-tighter">{semesterProgress}%</p>
              </div>
              <Badge variant="outline" className="rounded-xl font-black text-[9px] px-3 py-1 uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                {isHistoricalView ? "Arquivado" : "Em Curso"}
              </Badge>
            </div>
            <Progress value={semesterProgress} className="h-3 bg-muted/50 [&>div]:bg-primary shadow-inner" />
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo Dinâmico: Aulas e Prazos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Grade do Dia
            </h3>
            {isOnline ? <Cloud className="h-4 w-4 text-emerald-500" /> : <CloudOff className="h-4 w-4 text-amber-500 animate-pulse" />}
          </div>

          <div className="space-y-4">
            {todayClasses.length === 0 ? (
              <div className="p-20 rounded-[40px] border-2 border-dashed border-border/40 text-center bg-muted/5">
                <p className="text-sm font-bold text-muted-foreground italic">Nada previsto para hoje. <br/>Hora de revisar o material extra?</p>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <Card 
                  key={i} 
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="rounded-[32px] bg-card border-border/50 hover:border-primary/40 hover:shadow-2xl transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary/10" style={{ backgroundColor: c.color }}>
                      {c.discipline_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-black truncate group-hover:text-primary transition-colors">{c.discipline_name}</p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest">
                          <Clock className="h-3 w-3" /> {c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}
                        </span>
                        {c.room && (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-widest">
                            <History className="h-3 w-3" /> Sala {c.room}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Lembretes Inteligentes */}
        <section className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-destructive ml-2">
            <AlertTriangle className="h-4 w-4" /> Prazos Críticos
          </h3>
          <div className="space-y-4">
            {reminders.length === 0 ? (
              <div className="p-12 rounded-[40px] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Sem Pendências</p>
              </div>
            ) : (
              reminders.map((r) => (
                <Card key={r.id} className="rounded-[24px] bg-card border-border/50 hover:shadow-lg transition-all">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-sm leading-tight">{r.title}</p>
                      <Badge className="bg-destructive/10 text-destructive border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-lg">
                        {format(new Date(r.due_date), "dd/MM")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">{r.discipline_name || "Geral"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            <Button 
              variant="outline" 
              onClick={() => navigate('/reminders')}
              className="w-full h-12 rounded-2xl border-dashed border-2 hover:border-primary hover:text-primary font-black uppercase text-[10px] tracking-widest"
            >
              Ver Central de Prazos
            </Button>
          </div>
        </section>
      </div>

      {/* Rodapé de Suporte (Aba Feedback Link) */}
      <footer className="pt-12 border-t border-border/20 flex flex-col items-center gap-4">
         <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">EduFlow Architecture v2.0</p>
         <Button 
           variant="link" 
           onClick={() => navigate('/feedback')}
           className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70"
         >
           Relatar Problema ou Sugestão
         </Button>
      </footer>
    </div>
  );
}

