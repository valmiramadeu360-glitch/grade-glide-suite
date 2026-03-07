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
// Importação do Calendário Interativo do shadcn
import { Calendar } from "@/components/ui/calendar"; 
import { 
  Calendar as CalendarIcon, BookOpen, Clock, AlertTriangle, 
  CheckCircle2, ArrowRight, Cloud, CloudOff, History, 
  Loader2, Sparkles, RefreshCcw, UserCircle 
} from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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

const typeLabels: Record<string, string> = {
  exam: "Prova",
  assignment: "Trabalho",
  seminar: "Seminário",
  presentation: "Apresentação",
  other: "Outro",
};

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

  // Estado do Calendário Interativo
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());

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
      const { data: profile } = await supabase
        .from("profiles")
        .select("semester, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (profile?.semester) setActiveSemesterFromProfile(profile.semester);

      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester", currentLabel);

      const discIds = (disciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

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

  const onEndSemester = async () => {
    await endSemester(nextSemesterInput);
    setShowEndSemester(false);
    setNextSemesterInput("");
  };

  const onRestoreSemester = async () => {
    await restoreSemester(currentLabel);
  };

  function getUrgencyLabel(dateStr: string, rType: string) {
    const d = new Date(dateStr);
    const today = startOfDay(new Date());
    const target = startOfDay(d);
    const label = typeLabels[rType] || rType;

    if (isToday(d)) return { text: `HOJE • ${label}`, variant: "destructive" as const };
    if (isTomorrow(d)) return { text: `AMANHÃ • ${label}`, variant: "default" as const };
    
    const diff = differenceInDays(target, today);
    if (diff <= 3) return { text: `URGENTE • ${label}`, variant: "secondary" as const };
    return { text: label.toUpperCase(), variant: "outline" as const };
  }

  if (loading || semesterLoading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando BI...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
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
                className="h-11 rounded-2xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-amber-500/20 hover:bg-amber-600"
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

        <div className="flex flex-col sm:items-end gap-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-1">
            {isOnline ? (
              <span className="flex items-center gap-2 text-emerald-500"><Cloud className="h-3.5 w-3.5" /> Sincronizado</span>
            ) : (
              <span className="flex items-center gap-2 text-amber-500 animate-pulse"><CloudOff className="h-3.5 w-3.5" /> Modo Offline</span>
            )}
          </div>

          {/* NOVO: Modal com Calendário Interativo */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-14 w-full sm:w-auto bg-card border-border hover:border-primary/40 rounded-2xl flex items-center gap-4 shadow-md px-6 active:scale-95 transition-all">
                <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
                <span className="text-base font-black text-foreground capitalize truncate">
                  {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-[400px] bg-card border-border rounded-[32px] p-6 sm:p-8 flex flex-col items-center">
              <DialogHeader className="w-full">
                <DialogTitle className="text-center font-black text-2xl mb-2">Calendário Mensal</DialogTitle>
              </DialogHeader>
              
              {/* Contêiner de Luxo para o Calendário */}
              <div className="bg-background border border-border/50 rounded-[24px] p-2 w-full flex justify-center shadow-sm">
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  locale={ptBR}
                  className="rounded-xl w-full"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full justify-center",
                    month: "space-y-4 w-full",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex w-full justify-between",
                    row: "flex w-full mt-2 justify-between",
                    cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-muted transition-colors",
                    day_range_end: "day-range-end",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground font-black",
                    day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    day_hidden: "invisible",
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-4 text-center">
                Use as setas para navegar entre os meses e anos
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Cadeiras Ativas", value: disciplineCount, icon: BookOpen, color: "text-primary", bg: "bg-primary/10", path: "/disciplines" },
          { label: "Aulas Hoje", value: isHistoricalView ? 0 : todayClasses.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", path: "/disciplines" },
          { label: "Prazos Críticos", value: isHistoricalView ? 0 : reminders.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", path: "/reminders" }
        ].map((stat, i) => (
          <Card 
            key={i} 
            onClick={() => navigate(stat.path)} 
            className="glass-card border-border/40 bg-card/60 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group rounded-[32px] overflow-hidden"
          >
            <CardContent className="p-8 flex items-center gap-6">
              <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner", stat.bg, stat.color)}>
                <stat.icon className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-4xl font-black tracking-tighter text-foreground">{stat.value}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:translate-x-1 group-hover:text-primary transition-all" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-border/40 bg-card/60 backdrop-blur-xl shadow-xl relative overflow-hidden rounded-[32px]">
        <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
          <Sparkles className="h-32 w-32" />
        </div>
        <CardContent className="p-8">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
                {isHistoricalView ? "Status Final" : "Tempo do Período"}
              </p>
              <p className="text-4xl font-black tracking-tighter text-foreground">{semesterProgress}%</p>
            </div>
            <Badge variant="outline" className="rounded-xl font-black text-[9px] px-3 py-1 uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
              {isHistoricalView ? "Arquivado" : "Em Curso"}
            </Badge>
          </div>
          <Progress value={semesterProgress} className="h-3 bg-muted/50 [&>div]:bg-primary shadow-inner" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-amber-500" /> Grade do Dia
            </h3>
          </div>

          <div className="space-y-4">
            {todayClasses.length === 0 ? (
              <div className="p-16 rounded-[40px] border-2 border-dashed border-border/40 text-center bg-muted/5">
                <p className="text-sm font-bold text-muted-foreground italic">Nada previsto para hoje. <br/>Aproveite para focar nos projetos.</p>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <Card 
                  key={i} 
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="rounded-[32px] bg-card border-border/50 hover:border-primary/40 hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <CardContent className="p-6 flex items-center gap-5 sm:gap-6">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg group-hover:rotate-6 transition-transform shrink-0" style={{ backgroundColor: c.color }}>
                      {c.discipline_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg sm:text-xl font-black truncate text-foreground group-hover:text-primary transition-colors">{c.discipline_name}</p>
                      <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                        <span className="bg-background border border-border/50 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest">
                          <Clock className="h-3 w-3 text-primary" /> {c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}
                        </span>
                        {c.room && (
                          <span className="bg-muted/50 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-widest">
                            <BookOpen className="h-3 w-3" /> Sala {c.room}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="hidden sm:block h-6 w-6 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

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
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <Card key={r.id} onClick={() => navigate('/reminders')} className="group rounded-[24px] bg-card border-border/50 hover:shadow-lg hover:border-destructive/40 cursor-pointer active:scale-[0.98] transition-all">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-black text-sm text-foreground leading-tight group-hover:text-destructive transition-colors">{r.title}</p>
                        <Badge variant={urgency.variant} className="shrink-0 text-[9px] font-black px-2 py-1 rounded-lg tracking-widest uppercase">
                          {urgency.text}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 bg-background border border-border/50 px-2.5 py-1.5 rounded-lg w-fit">
                        <div className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate max-w-[150px]">{r.discipline_name || "Geral"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
            <Button 
              variant="outline" 
              onClick={() => navigate('/reminders')}
              className="w-full h-12 rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary font-black uppercase text-[10px] tracking-widest transition-all"
            >
              Central de Lembretes
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
