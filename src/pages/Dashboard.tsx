import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar"; 
import { 
  BookOpen, Clock, AlertTriangle, 
  CheckCircle2, ArrowRight, Cloud, CloudOff, History, 
  Loader2, Sparkles, RefreshCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, differenceInDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ScheduleEntry {
  discipline_name: string;
  discipline_id: string;
  color: string;
  start_time: string;
  end_time: string;
  room: string | null;
  day_of_week: number;
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
    currentLabel, setCurrentLabel, allSemesters, 
    endSemester, restoreSemester, isLoading: semesterLoading 
  } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // All schedules (all days) for calendar markers
  const [allSchedules, setAllSchedules] = useState<ScheduleEntry[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

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
        .select("current_semester_label, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (profile?.current_semester_label) setActiveSemesterFromProfile(profile.current_semester_label);

      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester_label", currentLabel);

      const discIds = (disciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      if (discIds.length > 0 && !isHistoricalView) {
        // Load ALL schedules (all days of week) for calendar markers
        const { data: schedule } = await supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("user_id", user!.id)
          .in("discipline_id", discIds);

        setAllSchedules((schedule ?? []).map((s: any) => ({
          discipline_name: s.disciplines?.name ?? "Módulo",
          discipline_id: s.discipline_id,
          color: s.disciplines?.color ?? "#6366f1",
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
          day_of_week: s.day_of_week,
        })));
      } else {
        setAllSchedules([]);
      }

      if (!isHistoricalView) {
        const { data: remData } = await supabase
          .from("reminders")
          .select("*, disciplines(name, color)")
          .eq("completed", false)
          .eq("user_id", user!.id)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(50);

        setAllReminders((remData ?? []).filter((r: any) => 
          !r.discipline_id || discIds.includes(r.discipline_id)
        ).map((r: any) => ({
          ...r,
          discipline_name: r.disciplines?.name,
          discipline_color: r.disciplines?.color,
        })));
      } else {
        setAllReminders([]);
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

  // Filter classes for selected calendar date
  const filteredClasses = useMemo(() => {
    const dayOfWeek = calendarDate.getDay();
    return allSchedules
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [calendarDate, allSchedules]);

  // Filter reminders for selected calendar date
  const filteredReminders = useMemo(() => {
    return allReminders.filter(r => isSameDay(new Date(r.due_date), calendarDate));
  }, [calendarDate, allReminders]);

  // Days that have classes (by day_of_week) — compute for current calendar month
  const classDays = useMemo(() => {
    const daysWithClasses = new Set(allSchedules.map(s => s.day_of_week));
    // Generate all dates in the visible month that match these days of week
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const dates: Date[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (daysWithClasses.has(d.getDay())) {
        dates.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [calendarDate, allSchedules]);

  // Days that have reminders
  const reminderDays = useMemo(() => {
    return allReminders.map(r => startOfDay(new Date(r.due_date)));
  }, [allReminders]);

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

  const selectedDateLabel = useMemo(() => {
    if (isToday(calendarDate)) return "Hoje";
    if (isTomorrow(calendarDate)) return "Amanhã";
    return format(calendarDate, "EEEE, dd/MM", { locale: ptBR });
  }, [calendarDate]);

  if (loading || semesterLoading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* End Semester Dialog */}
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

      {/* Header */}
      <header className="flex flex-col gap-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentLabel} onValueChange={setCurrentLabel}>
              <SelectTrigger className="w-fit h-10 bg-primary/10 text-primary border-none font-black text-xs rounded-2xl px-5 hover:bg-primary/20 transition-all">
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
                className="h-10 rounded-2xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-5 shadow-lg shadow-amber-500/20 hover:bg-amber-600"
              >
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Restaurar
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => setShowEndSemester(true)}
                className="h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <History className="mr-2 h-3.5 w-3.5" /> Encerrar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-500"><Cloud className="h-3 w-3" /> Sync</span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-500 animate-pulse"><CloudOff className="h-3 w-3" /> Offline</span>
            )}
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none">
          Visão <span className="text-primary">Acadêmica</span>
        </h1>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Cadeiras", value: disciplineCount, icon: BookOpen, color: "text-primary", bg: "bg-primary/10", path: "/disciplines" },
          { label: "Aulas Hoje", value: isHistoricalView ? 0 : filteredClasses.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", path: "/disciplines" },
          { label: "Prazos", value: isHistoricalView ? 0 : allReminders.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", path: "/reminders" }
        ].map((stat, i) => (
          <Card 
            key={i} 
            onClick={() => navigate(stat.path)} 
            className="border-border/40 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group rounded-[24px]"
          >
            <CardContent className="p-4 sm:p-6 flex flex-col items-center gap-2 text-center">
              <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground">{stat.value}</p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Semester Progress */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-lg rounded-[24px] overflow-hidden relative">
        <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
          <Sparkles className="h-24 w-24" />
        </div>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              {isHistoricalView ? "Arquivado" : "Progresso do Período"}
            </p>
            <span className="text-2xl font-black tracking-tighter text-foreground">{semesterProgress}%</span>
          </div>
          <Progress value={semesterProgress} className="h-2.5 bg-muted/50 [&>div]:bg-primary" />
        </CardContent>
      </Card>

      {/* Calendar + Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Calendar */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-lg rounded-[24px]">
          <CardContent className="p-4 sm:p-6 flex justify-center">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={(date) => date && setCalendarDate(date)}
              locale={ptBR}
              className="w-full pointer-events-auto"
              modifiers={{
                hasClass: classDays,
                hasReminder: reminderDays,
              }}
              modifiersClassNames={{
                hasClass: "calendar-dot-class",
                hasReminder: "calendar-dot-reminder",
              }}
            />
          </CardContent>
        </Card>

        {/* Day Detail */}
        <div className="space-y-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground px-1 capitalize">
            {selectedDateLabel}
          </p>

          {/* Classes for selected day */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground px-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Grade do Dia
            </h3>

            {filteredClasses.length === 0 ? (
              <div className="p-8 rounded-[24px] border-2 border-dashed border-border/30 text-center bg-muted/5">
                <p className="text-xs font-bold text-muted-foreground italic">Sem aulas neste dia</p>
              </div>
            ) : (
              filteredClasses.map((c, i) => (
                <Card 
                  key={i} 
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="rounded-[20px] bg-card border-border/40 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-md shrink-0 group-hover:scale-105 transition-transform" style={{ backgroundColor: c.color }}>
                      {c.discipline_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors">{c.discipline_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                        </span>
                        {c.room && (
                          <span className="text-[10px] font-bold text-primary">Sala {c.room}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all shrink-0" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Reminders for selected day */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-destructive px-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Prazos do Dia
            </h3>

            {filteredReminders.length === 0 ? (
              <div className="p-6 rounded-[24px] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Sem pendências</p>
              </div>
            ) : (
              filteredReminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <Card key={r.id} onClick={() => navigate('/reminders')} className="group rounded-[20px] bg-card border-border/40 hover:shadow-lg hover:border-destructive/30 cursor-pointer active:scale-[0.98] transition-all">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-foreground truncate group-hover:text-destructive transition-colors">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                          <span className="text-[9px] font-bold text-muted-foreground truncate">{r.discipline_name || "Geral"}</span>
                        </div>
                      </div>
                      <Badge variant={urgency.variant} className="shrink-0 text-[8px] font-black px-2 py-0.5 rounded-lg tracking-widest uppercase">
                        {urgency.text}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })
            )}

            <Button 
              variant="outline" 
              onClick={() => navigate('/reminders')}
              className="w-full h-10 rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary font-black uppercase text-[10px] tracking-widest transition-all"
            >
              Central de Lembretes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
