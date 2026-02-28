import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, AlertTriangle, CheckCircle2, Calendar, LayoutDashboard, ArrowRight, Loader2 } from "lucide-react";
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
    if (user) {
      loadDashboard();
    }
  }, [user]);

  async function loadDashboard() {
    if (!user?.id) return;
    
    const today = new Date().getDay();

    try {
      setLoading(true);
      const [schedRes, remRes, discRes, profileRes] = await Promise.all([
        supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("day_of_week", today)
          .eq("user_id", user.id),
        supabase
          .from("reminders")
          .select("*, disciplines(name, color)")
          .eq("completed", false)
          .eq("user_id", user.id)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(5),
        supabase.from("disciplines").select("id").eq("user_id", user.id).eq("is_extra_course", false),
        supabase.from("profiles").select("semester_start, semester_end").eq("user_id", user.id).maybeSingle(),
      ]);

      if (schedRes.data) {
        setTodayClasses(
          schedRes.data.map((s: any) => ({
            discipline_name: s.disciplines?.name ?? "Sem nome",
            discipline_id: s.discipline_id,
            color: s.disciplines?.color ?? "#3b82f6",
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
      <div className="flex h-[80vh] flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando EduFlow</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 sm:px-0">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <LayoutDashboard className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Painel de Controle</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
            {user?.user_metadata?.full_name ? `Olá, ${user.user_metadata.full_name.split(' ')[0]}` : 'Olá, Estudante'}
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">
            {disciplineCount === 0 
              ? "Pronto para organizar seu novo semestre?"
              : `Você tem ${disciplineCount} matérias em andamento.`}
          </p>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 px-5 py-3 rounded-[24px] flex items-center gap-3 shadow-2xl">
           <Calendar className="h-4 w-4 text-primary" />
           <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
           </span>
        </div>
      </header>

      {/* Grid de estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card onClick={() => navigate('/disciplines')} className="glass-card bg-slate-900/40 border-none shadow-xl hover:-translate-y-1 transition-all cursor-pointer group rounded-[32px]">
          <CardContent className="flex items-center gap-5 p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Disciplinas</p>
              <p className="text-4xl font-black text-white tracking-tighter">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card bg-slate-900/40 border-none shadow-xl rounded-[32px]">
          <CardContent className="flex items-center gap-5 p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-amber-500/10 text-amber-500 shadow-inner">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Aulas Hoje</p>
              <p className="text-4xl font-black text-white tracking-tighter">{todayClasses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/reminders')} className="glass-card bg-slate-900/40 border-none shadow-xl hover:-translate-y-1 transition-all cursor-pointer group rounded-[32px]">
          <CardContent className="flex items-center gap-5 p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all duration-500 shadow-inner">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Pendências</p>
              <p className="text-4xl font-black text-white tracking-tighter">{reminders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso do Semestre Otimizado */}
      <Card className="border-none bg-slate-900/40 rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/5">
        <CardHeader className="pb-4 px-10 pt-10">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center justify-between">
            Status do Período Letivo
            <span className="text-primary text-xl font-black">{semesterProgress}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-10 pb-10">
          <Progress value={semesterProgress} className="h-5 bg-slate-950 shadow-inner rounded-full" />
          {semesterProgress === 0 && (
            <button 
              onClick={() => navigate('/settings')}
              className="mt-6 flex items-center gap-2 text-[10px] font-black text-primary hover:gap-4 transition-all uppercase tracking-widest group"
            >
              Defina as datas do semestre nas configurações <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse" />
              Cronograma do Dia
            </h3>
          </div>
          
          <div className="grid gap-4">
            {todayClasses.length === 0 ? (
              <div className="p-16 border-2 border-dashed border-slate-800 rounded-[48px] flex flex-col items-center justify-center text-slate-500 bg-slate-900/20">
                <p className="text-sm font-bold italic opacity-40">Sem aulas registradas para hoje.</p>
                <button onClick={() => navigate('/disciplines')} className="text-[10px] mt-5 font-black uppercase text-primary hover:tracking-widest transition-all">Configurar Grade Horária</button>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="group flex items-center gap-6 w-full rounded-[32px] p-6 bg-slate-900/40 border border-white/5 hover:border-primary/30 hover:bg-slate-900/60 transition-all text-left shadow-lg"
                >
                  <div className="h-16 w-16 rounded-[22px] flex items-center justify-center text-white font-black shadow-2xl group-hover:scale-105 transition-transform" style={{ backgroundColor: c.color }}>
                    {c.discipline_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-xl text-white group-hover:text-primary transition-colors truncate tracking-tight">
                      {c.discipline_name}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 mt-2">
                      <span className="flex items-center gap-1.5 bg-slate-950/50 px-3 py-1.5 rounded-full tracking-tight">
                        <Clock className="h-3.5 w-3.5 text-primary" /> {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                      </span>
                      {c.room && (
                        <span className="flex items-center gap-1.5 bg-slate-950/50 px-3 py-1.5 rounded-full uppercase tracking-widest text-[9px] font-black">
                          SALA {c.room}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-700 group-hover:text-primary group-hover:translate-x-1 transition-all mr-2" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-3 px-2">
            <AlertTriangle className="h-4 w-4" />
            Urgências Acadêmicas
          </h3>
          <div className="space-y-4">
            {reminders.length === 0 ? (
              <div className="p-12 rounded-[40px] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-60" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60">Tudo em dia</p>
              </div>
            ) : (
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date);
                return (
                  <div key={r.id} onClick={() => navigate('/reminders')} className="cursor-pointer group flex flex-col gap-4 rounded-[32px] p-6 bg-slate-900/40 border border-white/5 hover:border-rose-500/30 transition-all shadow-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-black text-base text-white leading-tight group-hover:text-rose-500 transition-colors tracking-tight">{r.title}</p>
                        <div className="flex items-center gap-2.5 mt-3">
                           <div className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: r.discipline_color || '#475569' }} />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[150px]">
                              {r.discipline_name || "Geral"}
                           </span>
                        </div>
                      </div>
                      <Badge variant={urgency.variant} className="shrink-0 text-[9px] font-black px-3 py-1.5 tracking-widest rounded-full uppercase border-none shadow-lg">
                        {urgency.label}
                      </Badge>
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
