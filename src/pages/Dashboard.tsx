import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar"; 
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RuWidget } from "@/components/Campus/RuWidget";
import { 
  BookOpen, Clock, AlertTriangle, CheckCircle2, ArrowRight, Cloud, CloudOff, History, 
  Loader2, Sparkles, Calendar as CalendarIcon, HandHelping, Trophy, Target, FileText, BrainCircuit
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

export default function Dashboard() {
  const { user } = useAuth();
  const { currentLabel, allSemesters, loadSemesters, endSemester } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [allSchedules, setAllSchedules] = useState<ScheduleEntry[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [libraryAlerts, setLibraryAlerts] = useState<any[]>([]);
  
  const [displayName, setDisplayName] = useState<string>("");
  const [hideName, setHideName] = useState<boolean>(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeSemesterFromProfile, setActiveSemesterFromProfile] = useState("");
  
  // ESTADOS DA VIRADA DE SEMESTRE
  const [isTurnoverModalOpen, setIsTurnoverModalOpen] = useState(false);
  const [newSemesterLabel, setNewSemesterLabel] = useState("");
  const [isTurningOver, setIsTurningOver] = useState(false);

  const isHistoricalView = useMemo(() => {
    return activeSemesterFromProfile !== "" && currentLabel !== activeSemesterFromProfile;
  }, [currentLabel, activeSemesterFromProfile]);

  const userName = hideName ? "Estudante" : (displayName || user?.user_metadata?.full_name || "Estudante").split(" ")[0];

  const filteredClasses = useMemo(() => {
    const dow = calendarDate.getDay();
    return allSchedules.filter((s) => s.day_of_week === dow);
  }, [allSchedules, calendarDate]);

  const filteredReminders = useMemo(() => {
    return allReminders.filter((r: any) => {
      try { return new Date(r.due_date).toDateString() === calendarDate.toDateString(); } 
      catch { return false; }
    });
  }, [allReminders, calendarDate]);

  function getUrgencyLabel(dueDate: string, type?: string) {
    try {
      const d = new Date(dueDate);
      if (isToday(d)) return { variant: "destructive" as const, text: type ? `Hoje · ${type}` : "Hoje" };
      if (isTomorrow(d)) return { variant: "default" as const, text: type ? `Amanhã · ${type}` : "Amanhã" };
      return { variant: "secondary" as const, text: d.toLocaleDateString("pt-BR") };
    } catch { return { variant: "outline" as const, text: "" }; }
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

  useEffect(() => { if (user) loadDashboard(); }, [user, currentLabel]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("current_semester_label, semester_start, semester_end, display_name, hide_name, full_name").eq("user_id", user!.id).maybeSingle();
      if (profile?.current_semester_label) setActiveSemesterFromProfile(profile.current_semester_label);
      setDisplayName((profile as any)?.display_name || (profile as any)?.full_name || "");
      setHideName(!!(profile as any)?.hide_name);

      const { data: disciplines } = await supabase.from("disciplines").select("id").eq("user_id", user!.id).eq("semester_label", currentLabel);
      const discIds = (disciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      const { data: books } = await supabase.from('books').select('title, end_date').eq('user_id', user!.id).eq('material_format', 'borrowed').neq('reading_status', 'returned').not('end_date', 'is', null);
      setLibraryAlerts((books ?? []).filter(b => {
        const d = new Date(b.end_date!);
        return isToday(d) || isTomorrow(d);
      }));

      if (discIds.length > 0 && !isHistoricalView) {
        const { data: schedule } = await supabase.from("discipline_schedules").select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)").eq("user_id", user!.id).in("discipline_id", discIds);
        setAllSchedules((schedule ?? []).map((s: any) => ({
          discipline_name: s.disciplines?.name ?? "Módulo", discipline_id: s.discipline_id, color: s.disciplines?.color ?? "#6366f1", start_time: s.start_time, end_time: s.end_time, room: s.room, day_of_week: s.day_of_week,
        })));

        const { data: remData } = await supabase.from("reminders").select("*, disciplines(name, color)").eq("completed", false).eq("user_id", user!.id).gte("due_date", startOfDay(new Date()).toISOString()).order("due_date", { ascending: true }).limit(50);
        setAllReminders((remData ?? []).filter((r: any) => !r.discipline_id || discIds.includes(r.discipline_id)).map((r: any) => ({ ...r, discipline_name: r.disciplines?.name, discipline_color: r.disciplines?.color })));
      } else {
        setAllSchedules([]); setAllReminders([]);
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
      } else { setSemesterProgress(0); }
    } catch (e) {
      console.error("Dashboard Sync Error", e);
    } finally { setLoading(false); }
  }

  async function handleTurnoverSubmit() {
    if (!newSemesterLabel.trim()) return;
    setIsTurningOver(true);
    await endSemester(newSemesterLabel.trim());
    setIsTurnoverModalOpen(false);
    setNewSemesterLabel("");
    setIsTurningOver(false);
    loadDashboard(); 
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Organizando seu dia...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 overflow-x-hidden pt-4">

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Olá, {userName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-muted/40 px-4 py-2 rounded-2xl w-fit shadow-sm">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-500"><Cloud className="h-3.5 w-3.5" /> Sincronizado</span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-500"><CloudOff className="h-3.5 w-3.5" /> Offline</span>
          )}
        </div>
      </header>

      {/* ALERTAS URGENTES DA BIBLIOTECA */}
      {libraryAlerts.length > 0 && (
        <section className="animate-in slide-in-from-top-4 duration-500">
          {libraryAlerts.map((book, idx) => (
            <div key={idx} className="bg-destructive text-white p-5 rounded-[28px] flex items-center justify-between gap-4 mb-3 shadow-lg shadow-destructive/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <HandHelping className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Devolução Urgente</p>
                  <p className="text-sm font-bold mt-0.5">O livro "{book.title}" vence {isToday(new Date(book.end_date)) ? "hoje" : "amanhã"}!</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* GATILHO DA VIRADA DE SEMESTRE */}
      {semesterProgress === 100 && !isHistoricalView && (
        <Card className="border-0 shadow-xl shadow-emerald-500/20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[32px] overflow-hidden animate-in slide-in-from-top-4">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-white text-center sm:text-left">
              <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-emerald-100 flex items-center gap-2 justify-center sm:justify-start">
                <Sparkles className="h-4 w-4" /> Jornada Concluída
              </p>
              <h2 className="text-3xl font-black tracking-tight mb-2">Semestre finalizado!</h2>
              <p className="text-sm font-medium text-emerald-50 max-w-sm">Você chegou a 100% de andamento deste ciclo. É hora de avançar para a próxima etapa acadêmica.</p>
            </div>
            <Button onClick={() => setIsTurnoverModalOpen(true)} size="lg" className="w-full sm:w-auto rounded-2xl bg-white text-emerald-600 hover:bg-emerald-50 font-black tracking-wide shadow-lg shrink-0 h-14">
              <Trophy className="h-5 w-5 mr-2" /> Arquivar & Iniciar Novo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* MÉTRICAS DE HOJE (Foco Total) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Matérias Ativas", value: disciplineCount, icon: BookOpen, color: "text-primary", bg: "bg-primary/10", path: "/disciplines" },
          { label: "Aulas Hoje", value: isHistoricalView ? 0 : filteredClasses.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", path: "/disciplines" },
          { label: "Prazos", value: isHistoricalView ? 0 : filteredReminders.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", path: "/reminders" },
          { label: "Plano Estudo", value: "IA", icon: BrainCircuit, color: "text-blue-500", bg: "bg-blue-500/10", path: "#" },
        ].map((stat, i) => (
          <Card key={i} onClick={() => stat.path !== "#" && navigate(stat.path)} className={cn("border-border/20 bg-card shadow-sm transition-all rounded-[24px]", stat.path !== "#" ? "cursor-pointer hover:shadow-md hover:border-border/50" : "opacity-80")}>
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
              <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shadow-inner shrink-0", stat.bg, stat.color)}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[24px] sm:text-3xl font-black tracking-tighter text-foreground leading-none">{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1.5">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: AGENDA E AULAS (A prioridade do dia) */}
        <div className="md:col-span-2 space-y-6">
          <header className="flex items-center justify-between border-b border-border/20 pb-3">
            <div>
              <h2 className="text-xl font-black text-foreground capitalize tracking-tight flex items-center gap-2">
                {isToday(calendarDate) ? "Agenda de Hoje" : isTomorrow(calendarDate) ? "Agenda de Amanhã" : format(calendarDate, "EEEE, dd/MM", { locale: ptBR })}
              </h2>
            </div>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center h-10 w-10 bg-muted/40 hover:bg-muted rounded-xl transition-colors">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0 rounded-3xl border-border/20 shadow-2xl bg-background/95 backdrop-blur-xl">
                <Calendar mode="single" selected={calendarDate} onSelect={(d) => { if (d) { setCalendarDate(d); setIsCalendarOpen(false); } }} locale={ptBR} modifiers={{ hasClass: (day) => allSchedules.some((s) => s.day_of_week === day.getDay()), hasReminder: (day) => allReminders.some((r) => { try { return isSameDay(new Date(r.due_date), day); } catch { return false; } }), }} modifiersClassNames={{ hasClass: "calendar-dot-class", hasReminder: "calendar-dot-reminder", }} className="rounded-3xl" />
              </PopoverContent>
            </Popover>
          </header>

          {/* AULAS DO DIA */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Grade Horária
            </h3>
            {filteredClasses.length === 0 ? (
              <div className="p-6 rounded-[24px] border border-dashed border-border/40 text-center bg-muted/20">
                <p className="text-sm font-semibold text-muted-foreground">Você não tem aulas cadastradas para este dia.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredClasses.map((c, i) => (
                  <Card key={i} onClick={() => navigate(`/disciplines/${c.discipline_id}`)} className="rounded-[20px] bg-card border-border/20 hover:border-primary/30 hover:shadow-md cursor-pointer group transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-2 rounded-full shrink-0 group-hover:scale-y-110 transition-transform" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors">{c.discipline_name}</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-0.5">{c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)} {c.room && `• Sala ${c.room}`}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* PRAZOS E TAREFAS */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Trabalhos e Provas Pendentes
            </h3>
            {filteredReminders.length === 0 ? (
              <div className="p-6 rounded-[24px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Tudo em dia!</p><p className="text-sm font-medium text-emerald-600/80">Você não tem pendências para esta data.</p></div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReminders.map((r) => {
                  const urgency = getUrgencyLabel(r.due_date, r.type);
                  return (
                    <Card key={r.id} onClick={() => navigate("/reminders")} className="group rounded-[20px] bg-card border-border/20 hover:border-destructive/30 hover:shadow-md cursor-pointer transition-all">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.discipline_color || "#64748b" }} />
                          <div className="min-w-0">
                            <p className="font-black text-sm text-foreground truncate group-hover:text-destructive transition-colors">{r.title}</p>
                            <p className="text-xs font-semibold text-muted-foreground truncate mt-0.5">{r.discipline_name || "Geral"}</p>
                          </div>
                        </div>
                        <Badge variant={urgency.variant} className="shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">{urgency.text}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: PROGRESSO, RU E CONTEXTO */}
        <div className="space-y-6">
          
          {/* CARD DE PROGRESSO ACADÊMICO */}
          <Card className="border-border/20 bg-muted/10 shadow-sm rounded-[24px] overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">{isHistoricalView ? "Ciclo Fechado" : "Andamento do Semestre"}</p>
                  <p className="text-2xl font-black tracking-tight text-foreground leading-none">{semesterProgress}%</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
              </div>
              <Progress value={semesterProgress} className="h-2.5 bg-muted/50 [&>div]:bg-primary rounded-full" />
            </CardContent>
          </Card>

          {/* WIDGET DO RU (RESTAURANTE UNIVERSITÁRIO) INTEGRADO */}
          <RuWidget />

          {/* OBJETIVOS DA SEMANA */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Objetivos da Semana</h3>
            <div className="p-5 rounded-[24px] bg-primary/5 border border-primary/10 text-center">
              <p className="text-xs font-bold text-primary">Defina suas metas.</p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1">A IA do EduFlow ajudará você a manter o foco no que importa.</p>
            </div>
          </div>

        </div>
      </div>

      {/* HISTÓRICO */}
      {!isHistoricalView && (
        <div className="flex justify-center pt-8">
          <Button variant="ghost" onClick={() => navigate("/disciplines")} className="rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground gap-2 hover:bg-muted/50">
            <History className="h-4 w-4" /> Acessar Ciclos Passados
          </Button>
        </div>
      )}

      {/* MODAL VIRADA DE SEMESTRE */}
      <Dialog open={isTurnoverModalOpen} onOpenChange={setIsTurnoverModalOpen}>
        <DialogContent className="rounded-[32px] sm:max-w-md p-8 border border-white/10 shadow-2xl bg-background/95 backdrop-blur-xl">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2">
              <Trophy className="h-8 w-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-2xl font-black">Pronto para avançar?</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground">As matérias atuais serão arquivadas no seu histórico. Digite o nome do seu próximo ciclo para recomeçar com o quadro limpo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Identificação do Novo Semestre</label>
              <Input value={newSemesterLabel} onChange={(e) => setNewSemesterLabel(e.target.value)} placeholder="Ex: 2026.2, 5º Período..." className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-emerald-500 text-base font-bold" />
            </div>
            <Button onClick={handleTurnoverSubmit} disabled={!newSemesterLabel.trim() || isTurningOver} className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base shadow-lg transition-transform hover:scale-[1.02]">
              {isTurningOver ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {isTurningOver ? "Processando Arquivamento..." : "Iniciar Nova Jornada"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
