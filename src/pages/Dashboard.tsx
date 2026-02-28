import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, AlertTriangle, CheckCircle2, Calendar, LayoutDashboard } from "lucide-react";
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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    // Pegamos o dia da semana (0-6)
    const today = new Date().getDay();

    try {
      const [schedRes, remRes, discRes, profileRes] = await Promise.all([
        supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("day_of_week", today),
        supabase
          .from("reminders")
          .select("*, disciplines(name, color)")
          .eq("completed", false)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(8),
        supabase.from("disciplines").select("id").eq("is_extra_course", false),
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
        setReminders(
          remRes.data.map((r: any) => ({
            ...r,
            discipline_name: r.disciplines?.name,
            discipline_color: r.disciplines?.color,
          }))
        );
      }

      setDisciplineCount(discRes.data?.length ?? 0);

      // Cálculo de progresso seguro
      if (profileRes.data?.semester_start && profileRes.data?.semester_end) {
        const start = new Date(profileRes.data.semester_start);
        const end = new Date(profileRes.data.semester_end);
        const now = new Date();
        
        const totalDays = differenceInDays(end, start);
        if (totalDays > 0) {
          const elapsedDays = differenceInDays(now, start);
          const percentage = Math.round((elapsedDays / totalDays) * 100);
          setSemesterProgress(Math.min(100, Math.max(0, percentage)));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function getUrgencyLabel(dateStr: string) {
    const d = new Date(dateStr);
    const today = startOfDay(new Date());
    const target = startOfDay(d);
    
    if (isToday(d)) return { label: "HOJE", variant: "destructive" as const };
    if (isTomorrow(d)) return { label: "AMANHÃ", variant: "default" as const };
    
    const diff = differenceInDays(target, today);
    if (diff <= 3) return { label: `EM ${diff} DIAS`, variant: "secondary" as const };
    return { label: format(d, "dd/MM", { locale: ptBR }), variant: "outline" as const };
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Carregando semestre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Visão Geral</span>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Olá, pronto para estudar?</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </header>

      {/* Grid de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card border-none shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disciplinas Grade</p>
              <p className="text-3xl font-black text-foreground">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aulas de Hoje</p>
              <p className="text-3xl font-black text-foreground">{todayClasses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prazos Ativos</p>
              <p className="text-3xl font-black text-foreground">{reminders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso do Semestre */}
      <Card className="glass-card border-none shadow-inner bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            Progresso da Jornada
            <span className="text-primary">{semesterProgress}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={semesterProgress} className="h-3 shadow-sm" />
          {semesterProgress === 0 && (
            <button 
              onClick={() => navigate('/settings')}
              className="mt-3 text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter"
            >
              ⚠️ Configure as datas do semestre nas Configurações para ativar este gráfico.
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Lado Esquerdo: Aulas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Cronograma de Hoje
            </h3>
          </div>
          
          <div className="grid gap-3">
            {todayClasses.length === 0 ? (
              <div className="p-10 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                <p className="text-sm italic">Nenhuma aula agendada para hoje.</p>
                <p className="text-[10px] mt-1 font-bold uppercase">Aproveite para adiantar os resumos!</p>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="group flex items-center gap-4 w-full rounded-2xl p-4 bg-card border border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all text-left"
                >
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: c.color }}>
                    {c.discipline_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                      {c.discipline_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                      {c.room && <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold">SALA {c.room}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Lado Direito: Prazos */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Prazos Importantes
          </h3>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-50" />
                <p className="text-sm text-emerald-600 font-medium">Tudo em dia!</p>
              </div>
            ) : (
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date);
                return (
                  <div key={r.id} className="flex flex-col gap-2 rounded-2xl p-4 bg-muted/30 border border-transparent hover:border-border transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground leading-tight mb-1">{r.title}</p>
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.discipline_color }} />
                           <span className="text-[10px] font-bold text-muted-foreground uppercase truncate max-w-[120px]">
                              {r.discipline_name || "Lembrete Geral"}
                           </span>
                        </div>
                      </div>
                      <Badge variant={urgency.variant} className="shrink-0 text-[10px] py-0">{urgency.label}</Badge>
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
