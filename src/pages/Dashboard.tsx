import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, AlertTriangle, CheckCircle2, Calendar, LayoutDashboard, ArrowRight, Cloud, CloudOff } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Controle do Semestre e Auto-save
  const [currentSemester, setCurrentSemester] = useState("2026.1");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Monitora conexão para o modo offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!user) return;
    loadDashboard();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  // Exemplo de função de auto-save (pode ser chamada quando houver alterações em formulários)
  const triggerAutoSave = async (updateFunction: () => Promise<void>) => {
    if (!isOnline) return; // Não tenta salvar se estiver offline
    setIsSaving(true);
    try {
      await updateFunction();
    } finally {
      setTimeout(() => setIsSaving(false), 1000); // Dá um feedback visual rápido
    }
  };

  async function loadDashboard() {
    const today = new Date().getDay();

    try {
      // Simplificamos a query de disciplinas para evitar erros de schema no Supabase
      const [schedRes, remRes, discRes, profileRes] = await Promise.all([
        supabase.from("discipline_schedules").select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)").eq("day_of_week", today).eq("user_id", user?.id),
        supabase.from("reminders").select("*, disciplines(name, color)").eq("completed", false).eq("user_id", user?.id).gte("due_date", startOfDay(new Date()).toISOString()).order("due_date", { ascending: true }).limit(8),
        supabase.from("disciplines").select("id, is_extra_course").eq("user_id", user?.id),
        supabase.from("profiles").select("semester_start, semester_end").eq("user_id", user!.id).maybeSingle(),
      ]);

      if (schedRes.data) {
        setTodayClasses(
          schedRes.data.map((s: any) => ({
            discipline_name: s.disciplines?.name ?? "Sem nome",
            discipline_id: s.discipline_id,
            color: s.disciplines?.color ?? "#6366f1",
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room,
          })).sort((a, b) => a.start_time.localeCompare(b.start_time))
        );
      }

      if (remRes.data) {
        setReminders(remRes.data.map((r: any) => ({ ...r, discipline_name: r.disciplines?.name, discipline_color: r.disciplines?.color })));
      }

      // Filtro feito no front-end para garantir que as disciplinas apareçam mesmo se a coluna "archived" não existir ainda
      if (discRes.data) {
         const activeDisciplines = discRes.data.filter((d: any) => d.is_extra_course === false || d.is_extra_course === null);
         setDisciplineCount(activeDisciplines.length);
      }

      if (profileRes.data?.semester_start && profileRes.data?.semester_end) {
        const start = new Date(profileRes.data.semester_start);
        const end = new Date(profileRes.data.semester_end);
        const now = new Date();
        const totalDays = differenceInDays(end, start);
        if (totalDays > 0) {
          const elapsedDays = differenceInDays(now, start);
          setSemesterProgress(Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100))));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function getUrgencyLabel(dateStr: string, rType: string) {
    const d = new Date(dateStr);
    const today = startOfDay(new Date());
    const target = startOfDay(d);
    const tLabel = typeLabels[rType] || rType;

    if (isToday(d)) return { label: `HOJE • ${tLabel.toUpperCase()}`, variant: "destructive" as const };
    if (isTomorrow(d)) return { label: `AMANHÃ • ${tLabel.toUpperCase()}`, variant: "default" as const };

    const diff = differenceInDays(target, today);
    if (diff <= 3) return { label: `URGENTE • ${tLabel.toUpperCase()}`, variant: "secondary" as const };
    return { label: tLabel.toUpperCase(), variant: "outline" as const };
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full shadow-lg shadow-primary/20" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-3">
          {/* Seletor de Semestre idêntico à imagem */}
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer flex items-center gap-1 px-3 py-1 text-sm font-bold">
              {currentSemester} <span className="text-[10px]">▼</span>
            </Badge>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              BI Acadêmico
            </span>
          </div>
          
          {/* Textos com contraste corrigido (text-foreground) */}
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter flex items-center gap-3">
            Olá, Estudante! <span className="text-4xl animate-bounce">👋</span>
          </h1>
          <p className="text-muted-foreground font-medium text-lg max-w-xl">
            Seu desempenho no semestre <strong className="text-foreground">{currentSemester}</strong> está sendo monitorado.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Indicador de Status (Online/Offline e Salvamento Automático) */}
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            {!isOnline ? (
              <span className="flex items-center gap-1 text-destructive"><CloudOff className="h-3 w-3" /> Modo Offline</span>
            ) : isSaving ? (
              <span className="flex items-center gap-1 text-primary animate-pulse"><Cloud className="h-3 w-3" /> Salvando...</span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500"><Cloud className="h-3 w-3" /> Salvo na nuvem</span>
            )}
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card onClick={() => navigate('/disciplines')} className="glass-card border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group bg-card">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matérias Ativas</p>
              <p className="text-3xl font-black text-foreground">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none shadow-md hover:shadow-xl transition-all group bg-card">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-primary-foreground transition-colors">
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aulas Hoje</p>
              <p className="text-3xl font-black text-foreground">{todayClasses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/reminders')} className="glass-card border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group bg-card">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prazos Críticos</p>
              <p className="text-3xl font-black text-foreground">{reminders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Semester progress */}
      <Card className="glass-card border-none shadow-inner bg-card rounded-[32px] overflow-hidden">
        <CardHeader className="pb-3 px-8 pt-8">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center justify-between">
            PROGRESSO DO PERÍODO LETIVO
            <span className="text-foreground/20 font-black text-4xl absolute right-8 top-4 z-0 pointer-events-none">{semesterProgress}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8 relative z-10">
          <Progress value={semesterProgress} className="h-4 shadow-sm bg-muted/50 [&>div]:bg-primary" />
          <p className="mt-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {semesterProgress === 0 
              ? "Configure seu período letivo nas configurações para ativar." 
              : "PERÍODO EM ANDAMENTO. CONTINUE ORGANIZANDO SEUS RESUMOS."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Sessões de Hoje
            </h3>
          </div>

          <div className="grid gap-4">
            {todayClasses.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-border/50 rounded-[40px] flex flex-col items-center justify-center text-muted-foreground bg-card/50">
                <p className="text-sm font-medium italic opacity-60">Nenhuma aula programada para hoje.</p>
                <button onClick={() => navigate('/disciplines')} className="text-[10px] mt-4 font-black uppercase text-primary hover:underline">Ver grade completa</button>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="group flex items-center gap-5 w-full rounded-[28px] p-5 bg-card border border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all text-left"
                >
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-primary-foreground font-black shadow-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: c.color }}>
                    {c.discipline_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-lg text-foreground group-hover:text-primary transition-colors truncate">
                      {c.discipline_name}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-primary" /> {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}</span>
                      {c.room && <span className="bg-muted/80 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest">SALA {c.room}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors mr-2" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Prazos Críticos
          </h3>
          <div className="space-y-4">
            {reminders.length === 0 ? (
              <div className="p-10 rounded-[32px] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Foco Total</p>
                <p className="text-[10px] text-emerald-600/70 mt-1 uppercase">Nenhuma entrega pendente detectada.</p>
              </div>
            ) : (
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <div key={r.id} onClick={() => navigate('/reminders')} className="cursor-pointer group flex flex-col gap-3 rounded-[28px] p-5 bg-card border border-border/40 hover:border-destructive/40 transition-all shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-sm text-foreground leading-tight group-hover:text-destructive transition-colors">{r.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.discipline_color }} />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[140px]">
                            {r.discipline_name || "Geral"}
                          </span>
                        </div>
                      </div>
                      <Badge variant={urgency.variant} className="shrink-0 text-[9px] font-black px-2 py-1 tracking-widest">{urgency.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
