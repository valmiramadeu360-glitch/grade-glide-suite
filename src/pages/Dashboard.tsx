import { useEffect, useState } from "react";
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
import { Calendar as CalendarIcon, BookOpen, Clock, AlertTriangle, CheckCircle2, ArrowRight, Cloud, CloudOff, History, Loader2, Sparkles } from "lucide-react";
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
  const { currentLabel, setCurrentLabel, allSemesters, loadSemesters } = useSemester();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  // Estados do Modal de Transição de Semestre
  const [showEndSemester, setShowEndSemester] = useState(false);
  const [nextSemesterInput, setNextSemesterInput] = useState("");
  const [endingSemester, setEndingSemester] = useState(false);

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
    const today = new Date().getDay();

    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("semester, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      // "Máquina do Tempo": Verifica se estamos olhando para o passado
      const realActiveSemester = profileData?.semester || currentLabel;
      const isPastSemester = currentLabel !== realActiveSemester;
      setIsHistoricalView(isPastSemester);

      const { data: semDisciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester", currentLabel);

      const discIds = (semDisciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      // Aulas do Dia (Só exibe se for o semestre ATUAL)
      if (discIds.length > 0 && !isPastSemester) {
        const { data: schedData } = await supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("day_of_week", today)
          .eq("user_id", user!.id)
          .in("discipline_id", discIds);

        setTodayClasses((schedData ?? []).map((s: any) => ({
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

      // Prazos Críticos (Apenas do semestre atual)
      if (!isPastSemester) {
        const { data: remData } = await supabase
          .from("reminders")
          .select("*, disciplines(name, color)")
          .eq("completed", false)
          .eq("user_id", user!.id)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(8);

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

      // Progresso Matemático (Usa startOfDay para precisão)
      if (isPastSemester) {
        setSemesterProgress(100);
      } else if (profileData?.semester_start && profileData?.semester_end) {
        const start = startOfDay(new Date(profileData.semester_start));
        const end = startOfDay(new Date(profileData.semester_end));
        const now = startOfDay(new Date());
        
        const totalDays = differenceInDays(end, start);
        if (totalDays > 0) {
          const elapsedDays = differenceInDays(now, start);
          setSemesterProgress(Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100))));
        }
      } else {
        setSemesterProgress(0);
      }
    } catch (error) {
      console.error("Dashboard: Erro ao sincronizar.", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleEndSemester() {
    if (!user || !nextSemesterInput.trim()) return;
    setEndingSemester(true);

    try {
      // 1. Arquiva as matérias atuais
      await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("semester", currentLabel);

      // 2. Atualiza o perfil para o novo ciclo
      await supabase
        .from("profiles")
        .update({ semester: nextSemesterInput.trim(), updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      setCurrentLabel(nextSemesterInput.trim());
      await loadSemesters();

      toast({ title: "Ciclo encerrado!", description: `Iniciando novo período: ${nextSemesterInput}.` });
      setShowEndSemester(false);
      navigate("/disciplines");
    } catch (e: any) {
      toast({ title: "Falha na transição", description: e.message, variant: "destructive" });
    } finally {
      setEndingSemester(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center flex-col gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando BI Acadêmico...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* Diálogo de Encerramento do Ciclo */}
      <AlertDialog open={showEndSemester} onOpenChange={setShowEndSemester}>
        <AlertDialogContent className="rounded-[32px] bg-card border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Finalizar Semestre?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              As matérias de <strong>{currentLabel}</strong> serão movidas para o histórico. Digite o nome do próximo período para continuar:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={nextSemesterInput}
            onChange={e => setNextSemesterInput(e.target.value)}
            placeholder="Ex: 2026.2"
            className="h-14 rounded-2xl text-center text-lg font-black border-primary/20 bg-muted/20"
          />
          <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none bg-muted hover:bg-muted/80 font-bold uppercase text-[10px] tracking-widest">Manter Atual</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSemester}
              disabled={endingSemester || !nextSemesterInput.trim()}
              className="h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest"
            >
              {endingSemester ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Arquivar & Iniciar Novo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header com Máquina do Tempo */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentLabel} onValueChange={setCurrentLabel}>
              <SelectTrigger className="w-fit h-11 bg-primary/10 text-primary border-none font-black text-xs gap-3 rounded-2xl px-5 hover:bg-primary/20 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl border-border bg-popover">
                {allSemesters.map(s => (
                  <SelectItem key={s} value={s} className="font-bold cursor-pointer py-3">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
              {isHistoricalView ? "CONSULTA DE HISTÓRICO" : "DASHBOARD ATIVO"}
            </span>

            {disciplineCount > 0 && !isHistoricalView && (
              <Button
                variant="ghost"
                className="h-11 px-5 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all"
                onClick={() => setShowEndSemester(true)}
              >
                <History className="mr-2 h-4 w-4" /> Finalizar Período
              </Button>
            )}
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black text-foreground tracking-tighter leading-none">
            Visão Geral <br className="sm:hidden" /> <span className="text-primary">{currentLabel}</span>
          </h1>
          <p className="text-muted-foreground font-medium text-lg max-w-lg">
            {isHistoricalView 
              ? `Você está visualizando o arquivo morto do semestre ${currentLabel}. Nenhuma ação pendente.`
              : `Acompanhe seu progresso acadêmico e entregas do semestre atual.`}
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-card border border-border/50 px-4 py-2 rounded-full shadow-sm">
            {isOnline ? (
              <span className="flex items-center gap-2 text-emerald-500"><Cloud className="h-3.5 w-3.5" /> Sincronizado</span>
            ) : (
              <span className="flex items-center gap-2 text-amber-500 animate-pulse"><CloudOff className="h-3.5 w-3.5" /> Modo Offline</span>
            )}
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-14 w-full sm:w-auto bg-card border-border hover:border-primary/40 rounded-2xl flex items-center gap-4 shadow-md px-6 active:scale-95 transition-all">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <span className="text-base font-black text-foreground">
                  {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px] bg-card border-border rounded-[32px] p-8">
              <DialogHeader>
                <DialogTitle className="text-center font-black text-2xl mb-2">Agenda Digital</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground text-center font-medium">Consulte eventos e feriados do calendário acadêmico.</p>
                <input 
                  type="date" 
                  className="w-full h-14 bg-muted/20 border border-border/50 rounded-2xl px-5 font-black text-foreground [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark] focus:ring-2 ring-primary/20 outline-none"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Disciplinas", value: disciplineCount, icon: BookOpen, color: "bg-primary", path: "/disciplines" },
          { label: "Aulas Hoje", value: isHistoricalView ? 0 : todayClasses.length, icon: Clock, color: "bg-amber-500", path: "/disciplines" },
          { label: "Lembretes", value: isHistoricalView ? 0 : reminders.length, icon: AlertTriangle, color: "bg-destructive", path: "/reminders" }
        ].map((stat, i) => (
          <Card 
            key={i} 
            onClick={() => navigate(stat.path)} 
            className="glass-card border-border/50 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group rounded-[32px] overflow-hidden"
          >
            <CardContent className="flex items-center gap-6 p-7">
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl group-hover:scale-110 transition-transform", stat.color)}>
                <stat.icon className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-4xl font-black text-foreground tracking-tighter">{stat.value}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:translate-x-1 group-hover:text-primary transition-all" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra de Progresso do Período */}
      <Card className="glass-card border-border/50 shadow-xl bg-card rounded-[32px] overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none select-none">
          <span className="text-9xl font-black">{semesterProgress}%</span>
        </div>
        <CardHeader className="pb-4 px-8 pt-8">
          <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">
            {isHistoricalView ? "STATUS FINAL DO PERÍODO" : "PROGRESSO DO SEMESTRE LETIVO"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <div className="flex items-end justify-between mb-4">
            <span className="text-4xl font-black tracking-tighter">{semesterProgress}%</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {semesterProgress === 100 ? "CONCLUÍDO" : "EM ANDAMENTO"}
            </span>
          </div>
          <Progress value={semesterProgress} className="h-4 shadow-inner bg-muted/40 [&>div]:bg-primary rounded-full" />
          <p className="mt-5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            {isHistoricalView 
              ? "HISTÓRICO CONSOLIDADO: NENHUMA ALTERAÇÃO É PERMITIDA." 
              : "ESTA MÉTRICA É CALCULADA COM BASE NO PERÍODO LETIVO CONFIGURADO."}
          </p>
        </CardContent>
      </Card>

      {/* Grid Inferior: Aulas e Lembretes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Coluna: Aulas do Dia */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-foreground ml-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", isHistoricalView ? "bg-muted" : "bg-amber-500 animate-pulse")} />
            {isHistoricalView ? "Grade do Semestre" : "Sessões para Hoje"}
          </h3>

          <div className="grid gap-4">
            {todayClasses.length === 0 ? (
              <div className="p-16 border-2 border-dashed border-border/40 rounded-[40px] flex flex-col items-center justify-center text-center bg-card/30">
                <p className="text-sm font-bold text-muted-foreground/50 italic px-6">
                  {isHistoricalView ? "Não há grade horária ativa para este período histórico." : "Nenhuma aula detectada para hoje. Aproveite para atualizar seus resumos!"}
                </p>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="group flex flex-col sm:flex-row sm:items-center gap-5 w-full rounded-[32px] p-6 bg-card border border-border/50 hover:border-primary/40 hover:shadow-2xl transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:rotate-6 transition-transform shrink-0" style={{ backgroundColor: c.color }}>
                    {c.discipline_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-xl text-foreground truncate group-hover:text-primary transition-colors">{c.discipline_name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center gap-2 bg-background border border-border/50 px-3 py-1.5 rounded-xl">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black text-muted-foreground">{c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}</span>
                      </div>
                      {c.room && (
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SALA {c.room}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="hidden sm:block h-6 w-6 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-2 transition-all mr-2" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coluna: Lembretes */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-destructive ml-2">
            <AlertTriangle className="h-4 w-4" /> Prazos Próximos
          </h3>
          <div className="space-y-4">
            {reminders.length === 0 ? (
              <div className="p-12 rounded-[40px] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Fila Limpa</p>
                <p className="text-[10px] font-bold text-emerald-600/60 mt-2 uppercase tracking-wide">Tudo em dia por enquanto.</p>
              </div>
            ) : (
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <Card 
                    key={r.id} 
                    onClick={() => navigate('/reminders')} 
                    className="group border-border/50 hover:border-destructive/40 transition-all cursor-pointer rounded-[32px] bg-card hover:shadow-xl active:scale-[0.98]"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-black text-base text-foreground leading-tight group-hover:text-destructive transition-colors">{r.title}</p>
                          <Badge variant={urgency.variant} className="shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl tracking-widest uppercase">
                            {urgency.text}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2.5 bg-background border border-border/50 px-3 py-2 rounded-xl w-fit">
                          <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[140px]">
                            {r.discipline_name || "Geral"}
                          </span>
                        </div>
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
