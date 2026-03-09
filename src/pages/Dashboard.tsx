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
  Loader2, Sparkles, RefreshCcw, Calendar as CalendarIcon
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

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [activeSemesterFromProfile, setActiveSemesterFromProfile] = useState("");
  
  // Verifica se o aluno está consultando um semestre do passado
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
      // 1. Busca o perfil para saber qual é o semestre OFICIAL ativo
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_semester_label, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (profile?.current_semester_label) setActiveSemesterFromProfile(profile.current_semester_label);

      // 2. Busca as disciplinas do semestre que está sendo visualizado na tela
      const { data: disciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester_label", currentLabel);

      const discIds = (disciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      // 3. Busca horários e lembretes apenas se houver disciplinas
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

      // 4. Calcula o progresso do semestre
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

  // LÓGICA DE TRANSIÇÃO: Encerrar Semestre (Garante Atualização no Banco)
  const handleEndSemester = async () => {
    if (!nextSemesterInput.trim() || !user) return;
    setLoading(true);
    try {
      // 1. Arquiva as disciplinas do semestre atual
      await supabase.from("disciplines").update({ archived: true }).eq("user_id", user.id).eq("semester_label", currentLabel);
      // 2. Atualiza o perfil para o novo semestre
      await supabase.from("profiles").update({ current_semester_label: nextSemesterInput.trim(), updated_at: new Date().toISOString() }).eq("user_id", user.id);

      toast({ title: "Ciclo Encerrado! 🎓", description: `Bem-vindo ao período ${nextSemesterInput.trim()}.` });
      
      setCurrentLabel(nextSemesterInput.trim());
      setActiveSemesterFromProfile(nextSemesterInput.trim());
      setShowEndSemester(false);
      setNextSemesterInput("");
      
      await loadSemesters(); // Força a atualização da lista no cabeçalho
      await loadDashboard();
    } catch (error: any) {
      toast({ title: "Erro na transição", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  // LÓGICA DE TRANSIÇÃO: Restaurar Semestre Arquivado (Garante Atualização no Banco)
  const handleRestoreSemester = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Desarquiva todas as disciplinas que possuem este rótulo
      await supabase.from("disciplines").update({ archived: false }).eq("user_id", user.id).eq("semester_label", currentLabel);
      // 2. Define este semestre como o ATUAL no perfil do aluno
      await supabase.from("profiles").update({ current_semester_label: currentLabel, updated_at: new Date().toISOString() }).eq("user_id", user.id);

      toast({ title: "Semestre Restaurado! 🎉", description: `O período ${currentLabel} voltou para sua grade atual.` });
      
      setActiveSemesterFromProfile(currentLabel);
      await loadSemesters();
      await loadDashboard();
    } catch (error: any) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  // Filtros Reativos do Calendário Interativo
  const filteredClasses = useMemo(() => {
    const dayOfWeek = calendarDate.getDay();
    return allSchedules
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [calendarDate, allSchedules]);

  const filteredReminders = useMemo(() => {
    return allReminders.filter(r => isSameDay(new Date(r.due_date), calendarDate));
  }, [calendarDate, allReminders]);

  const classDays = useMemo(() => {
    const daysWithClasses = new Set(allSchedules.map(s => s.day_of_week));
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const dates: Date[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (daysWithClasses.has(d.getDay())) dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [calendarDate, allSchedules]);

  const reminderDays = useMemo(() => {
    return allReminders.map(r => startOfDay(new Date(r.due_date)));
  }, [allReminders]);

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
    if (isToday(calendarDate)) return "Eventos de Hoje";
    if (isTomorrow(calendarDate)) return "Eventos de Amanhã";
    return format(calendarDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  }, [calendarDate]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando Banco de Dados...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* Injeção de CSS para os pontos do calendário (Garante que funcione sem mexer no index.css) */}
      <style dangerouslySetInnerHTML={{__html: `
        .calendar-dot-class::after { content: ''; position: absolute; bottom: 4px; left: calc(50% - 6px); width: 5px; height: 5px; border-radius: 50%; background-color: #f59e0b; }
        .calendar-dot-reminder::after { content: ''; position: absolute; bottom: 4px; left: calc(50% + 1px); width: 5px; height: 5px; border-radius: 50%; background-color: #ef4444; }
      `}} />

      {/* Modal de Encerrar Semestre */}
      <AlertDialog open={showEndSemester} onOpenChange={setShowEndSemester}>
        <AlertDialogContent className="rounded-[32px] bg-card border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">Encerrar Período Letivo?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              As matérias de <strong>{currentLabel}</strong> serão transferidas para o seu histórico. Qual será o seu próximo período? (Ex: 2026.2)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={nextSemesterInput}
            onChange={e => setNextSemesterInput(e.target.value)}
            placeholder="Digite o novo semestre..."
            className="h-14 rounded-2xl text-center font-black text-lg border-primary/20 bg-muted/20"
          />
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none font-bold uppercase text-[10px] tracking-widest">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSemester}
              disabled={!nextSemesterInput.trim()}
              className="h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest"
            >
              Arquivar & Iniciar Novo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cabeçalho Organizado e Limpo */}
      <header className="flex flex-col gap-5 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentLabel} onValueChange={setCurrentLabel}>
              <SelectTrigger className="w-fit h-12 bg-primary/10 text-primary border-none font-black text-sm rounded-2xl px-6 hover:bg-primary/20 transition-all shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl border-border bg-card">
                {allSemesters.length === 0 ? (
                  <SelectItem value={currentLabel} className="font-bold py-3">{currentLabel}</SelectItem>
                ) : (
                  allSemesters.map(s => (
                    <SelectItem key={s} value={s} className="font-bold py-3 text-base">{s}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {isHistoricalView ? (
              <Button 
                onClick={handleRestoreSemester}
                className="h-12 rounded-2xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Restaurar Semestre
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setShowEndSemester(true)}
                className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10 active:scale-95 transition-all"
              >
                <History className="mr-2 h-4 w-4" /> Arquivar Período
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-muted/50 px-4 py-2.5 rounded-xl">
            {isOnline ? (
              <span className="flex items-center gap-2 text-emerald-500"><Cloud className="h-4 w-4" /> Nuvem Sincronizada</span>
            ) : (
              <span className="flex items-center gap-2 text-amber-500 animate-pulse"><CloudOff className="h-4 w-4" /> Modo Offline</span>
            )}
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
          Painel <span className="text-primary">Acadêmico</span>
        </h1>
        {isHistoricalView && (
          <p className="text-sm font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg w-fit flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Você está visualizando o histórico arquivado.
          </p>
        )}
      </header>

      {/* Grid de Resumo Numérico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: "Matérias Ativas", value: disciplineCount, icon: BookOpen, color: "text-primary", bg: "bg-primary/10", path: "/disciplines" },
          { label: "Aulas do Dia", value: isHistoricalView ? 0 : filteredClasses.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", path: "/disciplines" },
          { label: "Prazos Críticos", value: isHistoricalView ? 0 : allReminders.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", path: "/reminders" }
        ].map((stat, i) => (
          <Card 
            key={i} 
            onClick={() => navigate(stat.path)} 
            className="border-border/40 bg-card shadow-lg hover:shadow-2xl hover:border-primary/30 transition-all cursor-pointer group rounded-[28px]"
          >
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-inner", stat.bg, stat.color)}>
                <stat.icon className="h-7 w-7" />
              </div>
              <p className="text-4xl font-black tracking-tighter text-foreground mt-2">{stat.value}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra de Progresso Real */}
      <Card className="border-border/40 bg-card shadow-xl rounded-[32px] overflow-hidden relative">
        <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
          <Sparkles className="h-32 w-32" />
        </div>
        <CardContent className="p-8">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
                {isHistoricalView ? "Ciclo Concluído" : "Andamento do Semestre"}
              </p>
              <p className="text-5xl font-black tracking-tighter text-foreground">{semesterProgress}%</p>
            </div>
            <Badge variant="outline" className="rounded-xl font-black text-[10px] px-4 py-1.5 uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
              {isHistoricalView ? "Arquivado" : "Em Curso"}
            </Badge>
          </div>
          <Progress value={semesterProgress} className="h-3 bg-muted/50 [&>div]:bg-primary shadow-inner rounded-full" />
        </CardContent>
      </Card>

      {/* Layout Duplo: Calendário Interativo + Eventos do Dia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Coluna Esquerda: Calendário Inteligente */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-foreground ml-2">
            <CalendarIcon className="h-4 w-4 text-primary" /> Calendário Acadêmico
          </h3>
          <Card className="border-border/40 bg-card shadow-xl rounded-[32px] overflow-hidden">
            <CardContent className="p-4 sm:p-6 flex justify-center bg-muted/5">
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={(date) => date && setCalendarDate(date)}
                locale={ptBR}
                className="w-full pointer-events-auto bg-transparent border-none"
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
          <div className="flex justify-center gap-6 mt-4 opacity-70">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span> Aulas
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-destructive"></span> Prazos
            </div>
          </div>
        </div>

        {/* Coluna Direita: Detalhes do Dia Selecionado */}
        <div className="space-y-8">
          <div className="border-b border-border/50 pb-4">
            <p className="text-xl font-black text-foreground capitalize">
              {selectedDateLabel}
            </p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Eventos Programados
            </p>
          </div>

          {/* Aulas Filtradas pelo Dia */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Grade Horária
            </h3>

            {filteredClasses.length === 0 ? (
              <div className="p-8 rounded-[24px] border-2 border-dashed border-border/30 text-center bg-muted/5">
                <p className="text-xs font-bold text-muted-foreground italic">Dia livre de aulas cadastradas.</p>
              </div>
            ) : (
              filteredClasses.map((c, i) => (
                <Card 
                  key={i} 
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="rounded-[24px] bg-card border-border/40 hover:border-primary/40 hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <CardContent className="p-5 flex items-center gap-5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: c.color }}>
                      {c.discipline_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black truncate text-foreground group-hover:text-primary transition-colors">{c.discipline_name}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                          {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                        </span>
                        {c.room && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Sala {c.room}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all shrink-0" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Lembretes Filtrados pelo Dia */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Entregas e Prazos
            </h3>

            {filteredReminders.length === 0 ? (
              <div className="p-6 rounded-[24px] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Nada pendente para esta data</p>
              </div>
            ) : (
              filteredReminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <Card key={r.id} onClick={() => navigate('/reminders')} className="group rounded-[24px] bg-card border-border/40 hover:shadow-lg hover:border-destructive/30 cursor-pointer active:scale-[0.98] transition-all">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-black text-sm text-foreground group-hover:text-destructive transition-colors">{r.title}</p>
                        <Badge variant={urgency.variant} className="shrink-0 text-[9px] font-black px-2 py-1 rounded-lg tracking-widest uppercase">
                          {urgency.text}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 bg-background border border-border/50 px-2.5 py-1.5 rounded-lg w-fit">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">{r.discipline_name || "Geral"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
