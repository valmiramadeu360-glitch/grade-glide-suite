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
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar"; 
import { 
  BookOpen, Clock, AlertTriangle, 
  CheckCircle2, ArrowRight, Cloud, CloudOff, History, 
  Loader2, Sparkles, Calendar as CalendarIcon,
  HandHelping, MessageCircle, Bell
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
  const { currentLabel, setCurrentLabel, allSemesters, loadSemesters } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [allSchedules, setAllSchedules] = useState<ScheduleEntry[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [libraryAlerts, setLibraryAlerts] = useState<any[]>([]);

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [activeSemesterFromProfile, setActiveSemesterFromProfile] = useState("");

  const isHistoricalView = useMemo(() => {
    return activeSemesterFromProfile !== "" && currentLabel !== activeSemesterFromProfile;
  }, [currentLabel, activeSemesterFromProfile]);

  const [showEndSemester, setShowEndSemester] = useState(false);
  const [nextSemesterInput, setNextSemesterInput] = useState("");

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "Estudante";

  const filteredClasses = useMemo(() => {
    const dow = calendarDate.getDay();
    return allSchedules.filter((s) => s.day_of_week === dow);
  }, [allSchedules, calendarDate]);

  const filteredReminders = useMemo(() => {
    return allReminders.filter((r: any) => {
      try {
        const d = new Date(r.due_date);
        return d.toDateString() === calendarDate.toDateString();
      } catch {
        return false;
      }
    });
  }, [allReminders, calendarDate]);

  function getUrgencyLabel(dueDate: string, type?: string): { variant: "default" | "secondary" | "destructive" | "outline"; text: string } {
    try {
      const d = new Date(dueDate);
      if (isToday(d)) return { variant: "destructive", text: type ? `Hoje · ${type}` : "Hoje" };
      if (isTomorrow(d)) return { variant: "default", text: type ? `Amanhã · ${type}` : "Amanhã" };
      return { variant: "secondary", text: d.toLocaleDateString("pt-BR") };
    } catch {
      return { variant: "outline", text: "" };
    }
  }

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

      if (profile?.current_semester_label) {
        setActiveSemesterFromProfile(profile.current_semester_label);
      }

      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester_label", currentLabel);

      const discIds = (disciplines ?? []).map(d => d.id);

      setDisciplineCount(discIds.length);

      const { data: books } = await supabase
        .from('books')
        .select('title, end_date')
        .eq('user_id', user!.id)
        .eq('material_format', 'borrowed')
        .neq('reading_status', 'returned')
        .not('end_date', 'is', null);

      const urgentBooks = (books ?? []).filter(b => {
        const d = new Date(b.end_date!);
        return isToday(d) || isTomorrow(d);
      });

      setLibraryAlerts(urgentBooks);

      if (discIds.length > 0 && !isHistoricalView) {

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

        setAllSchedules([]);
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

  if (loading) {

    return (

      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Sincronizando Painel...
        </span>
      </div>

    );

  }

  return (

    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden pt-6">

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-border/40 pb-8">

        <div className="space-y-4 w-full lg:w-auto">

          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-foreground leading-[1.1]">
            Olá,<br />{userName}! 👋
          </h1>

        </div>

        <div className="flex items-center gap-4">

          {/* BOTÃO MENSAGENS */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/messages")}
            className="rounded-xl"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>

          {/* BOTÃO NOTIFICAÇÕES */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-muted/50 px-4 py-2.5 rounded-xl shadow-sm">

            {isOnline ? (

              <span className="flex items-center gap-2 text-emerald-500">
                <Cloud className="h-4 w-4" /> Cloud Sync
              </span>

            ) : (

              <span className="flex items-center gap-2 text-amber-500 animate-pulse">
                <CloudOff className="h-4 w-4" /> Offline
              </span>

            )}

          </div>

        </div>

      </header>
      {/* ALERTAS DE BIBLIOTECA */}
      {libraryAlerts.length > 0 && (
        <section className="animate-in slide-in-from-top-4 duration-500">
          {libraryAlerts.map((book, idx) => (
            <div
              key={idx}
              className="bg-destructive/10 border border-destructive/20 p-5 rounded-[28px] flex items-center justify-between gap-4 mb-3"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-destructive text-white flex items-center justify-center shadow-lg">
                  <HandHelping className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-destructive">
                    Devolução Urgente
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    O livro "{book.title}" vence{" "}
                    {isToday(new Date(book.end_date)) ? "hoje" : "amanhã"}!
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/disciplines")}
                className="rounded-xl border-destructive/30 text-destructive font-black text-[10px] uppercase tracking-widest hover:bg-destructive hover:text-white"
              >
                Ver Matéria
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
        {[
          {
            label: "Matérias Registradas",
            value: disciplineCount,
            icon: BookOpen,
            color: "text-primary",
            bg: "bg-primary/10",
            path: "/disciplines",
          },
          {
            label: "Aulas do Dia",
            value: isHistoricalView ? 0 : filteredClasses.length,
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            path: "/disciplines",
          },
          {
            label: "Prazos Restantes",
            value: isHistoricalView ? 0 : filteredReminders.length,
            icon: AlertTriangle,
            color: "text-destructive",
            bg: "bg-destructive/10",
            path: "/reminders",
          },
        ].map((stat, i) => (
          <Card
            key={i}
            onClick={() => navigate(stat.path)}
            className="border-none bg-card shadow-sm hover:shadow-xl transition-all cursor-pointer group rounded-[32px]"
          >
            <CardContent className="p-6 sm:p-8 flex items-center gap-5">
              <div
                className={cn(
                  "h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner shrink-0",
                  stat.bg,
                  stat.color
                )}
              >
                <stat.icon className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>

              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1 leading-tight">
                  {stat.label}
                </p>

                <p className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground leading-none mt-1">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PROGRESSO DO SEMESTRE */}
      <Card className="border-none bg-card shadow-sm rounded-[32px] overflow-hidden relative">
        <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
          <Sparkles className="h-32 w-32" />
        </div>

        <CardContent className="p-8">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
                {isHistoricalView ? "Ciclo Concluído" : "Andamento do Semestre"}
              </p>

              <p className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground">
                {semesterProgress}%
              </p>
            </div>
          </div>

          <Progress
            value={semesterProgress}
            className="h-3 bg-muted/50 [&>div]:bg-primary shadow-inner rounded-full transition-all duration-1000"
          />
        </CardContent>
      </Card>

      {/* EVENTOS DO DIA */}
      <div className="pt-4 space-y-8">
        <header className="border-b border-border/40 pb-4">
          <h2 className="text-2xl font-black text-foreground capitalize tracking-tight">
            {isToday(calendarDate)
              ? "Eventos de Hoje"
              : isTomorrow(calendarDate)
              ? "Eventos de Amanhã"
              : format(calendarDate, "EEEE, dd/MM", { locale: ptBR })}
          </h2>

          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Sua agenda personalizada para esta data
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AULAS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Grade Horária
            </h3>

            {filteredClasses.length === 0 ? (
              <div className="p-8 rounded-[24px] border-2 border-dashed border-border/40 text-center bg-muted/5 opacity-60">
                <p className="text-xs font-bold text-muted-foreground italic">
                  Sem aulas programadas para este dia.
                </p>
              </div>
            ) : (
              filteredClasses.map((c, i) => (
                <Card
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="rounded-[24px] bg-card border border-border/40 hover:border-primary/30 hover:shadow-lg cursor-pointer group transition-all"
                >
                  <CardContent className="p-5 flex items-center gap-5">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.discipline_name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black truncate text-foreground group-hover:text-primary transition-colors">
                        {c.discipline_name}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                          {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                        </span>

                        {c.room && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                            Sala {c.room}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all shrink-0" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* PRAZOS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Prazos e Tarefas
            </h3>

            {filteredReminders.length === 0 ? (
              <div className="p-8 rounded-[24px] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Nada pendente para esta data!
                </p>
              </div>
            ) : (
              filteredReminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);

                return (
                  <Card
                    key={r.id}
                    onClick={() => navigate("/reminders")}
                    className="group rounded-[24px] bg-card border border-border/40 hover:border-destructive/30 hover:shadow-lg cursor-pointer transition-all"
                  >
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-black text-sm text-foreground group-hover:text-destructive transition-colors">
                          {r.title}
                        </p>

                        <Badge
                          variant={urgency.variant}
                          className="shrink-0 text-[9px] font-black px-2 py-1 rounded-lg tracking-widest uppercase"
                        >
                          {urgency.text}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 bg-background border border-border/50 px-2.5 py-1.5 rounded-lg w-fit">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: r.discipline_color || "#64748b",
                          }}
                        />

                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                          {r.discipline_name || "Contexto Geral"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* HISTÓRICO */}
      {!isHistoricalView && (
        <div className="flex justify-center pt-8 border-t border-border/40">
          <Button
            variant="ghost"
            onClick={() => navigate("/disciplines")}
            className="rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground gap-2"
          >
            <History className="h-4 w-4" />
            Acessar Ciclos Passados
          </Button>
        </div>
      )}
    </div>
  );
}
