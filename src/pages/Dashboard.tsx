import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  LayoutDashboard, 
  ArrowRight,
  ChevronDown,
  GraduationCap
} from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [disciplineCount, setDisciplineCount] = useState(0);
  
  // GESTÃO DE SEMESTRE (Histórico Acadêmico): 
  // Implementação solicitada para separar conteúdos de cada período.
  const [selectedSemester, setSelectedSemester] = useState("2026.1");

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, selectedSemester]); // Recarrega sempre que o semestre mudar.

  async function loadDashboard() {
    const today = new Date().getDay();
    try {
      setLoading(true);
      
      // Consultas otimizadas com filtros de semestre integrados.
      const [schedRes, remRes, discRes, profileRes] = await Promise.all([
        supabase
          .from("discipline_schedules")
          .select("*, disciplines(name, color, semester)")
          .eq("day_of_week", today)
          .eq("user_id", user?.id),
        supabase
          .from("reminders")
          .select("*, disciplines(name, color, semester)")
          .eq("completed", false)
          .eq("user_id", user?.id)
          .gte("due_date", startOfDay(new Date()).toISOString())
          .order("due_date", { ascending: true })
          .limit(4),
        supabase
          .from("disciplines")
          .select("id")
          .eq("user_id", user?.id)
          .eq("semester", selectedSemester), // Filtra matérias do semestre selecionado.
        supabase
          .from("profiles")
          .select("semester_start, semester_end, university, full_name")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      // Filtra aulas do dia pertencentes ao semestre atual.
      if (schedRes.data) {
        setTodayClasses(
          schedRes.data
            .filter((s: any) => s.disciplines?.semester === selectedSemester)
            .map((s: any) => ({
              name: s.disciplines?.name,
              color: s.disciplines?.color,
              start: s.start_time,
              end: s.end_time,
              room: s.room,
              id: s.discipline_id
            }))
        );
      }

      // Filtra prazos do semestre atual.
      if (remRes.data) {
        setReminders(
          remRes.data.filter((r: any) => !r.disciplines || r.disciplines?.semester === selectedSemester)
        );
      }

      setDisciplineCount(discRes.data?.length || 0);

      // CÁLCULO DE PROGRESSO BI: Monitora a jornada do semestre no tempo.
      if (profileRes.data?.semester_start && profileRes.data?.semester_end) {
        const start = new Date(profileRes.data.semester_start);
        const end = new Date(profileRes.data.semester_end);
        const now = new Date();
        const total = differenceInDays(end, start);
        if (total > 0) {
          const elapsed = differenceInDays(now, start);
          const percent = Math.round((elapsed / total) * 100);
          setSemesterProgress(Math.min(100, Math.max(0, percent)));
        }
      }
    } catch (error) {
      console.error("Erro Dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Sincronizando Ecossistema</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4 sm:px-6 animate-in fade-in duration-1000">
      {/* HEADER DINÂMICO: Com seletor de histórico acadêmico. */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-primary/10 border-primary/20 text-primary font-black rounded-xl gap-2 hover:bg-primary/20 transition-all">
                  {selectedSemester} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-white/10 rounded-xl shadow-2xl">
                <DropdownMenuItem onClick={() => setSelectedSemester("2025.2")} className="text-slate-400 font-bold hover:text-white">2025.2 (Arquivado)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedSemester("2026.1")} className="text-white font-bold">2026.1 (Atual)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">BI Acadêmico</span>
          </div>
          <h1 
            className="text-4xl font-black text-white tracking-tighter hover:text-primary transition-colors cursor-pointer"
            onClick={() => navigate('/settings')}
          >
            Olá, Estudante! 👋
          </h1>
          <p className="text-slate-400 font-medium italic">Seu desempenho no semestre {selectedSemester} está sendo monitorado.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-3xl flex items-center gap-4 shadow-2xl">
           <Calendar className="h-5 w-5 text-primary" />
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hoje</span>
              <span className="text-sm font-bold text-white">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
           </div>
        </div>
      </header>

      {/* MÉTRICAS EM CARD: Estilo App com feedback tátil. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card onClick={() => navigate('/disciplines')} className="glass-card border-none hover:bg-white/5 transition-all cursor-pointer group active:scale-95">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-white leading-none">{disciplineCount}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Matérias Ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none hover:bg-white/5 transition-all">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-white leading-none">{todayClasses.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Aulas Hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/reminders')} className="glass-card border-none hover:bg-white/5 transition-all cursor-pointer group active:scale-95">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-white leading-none">{reminders.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Prazos Críticos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MONITORAMENTO BI: Jornada do Semestre visual. */}
      <Card className="glass-card border-none bg-primary/5 rounded-[40px] overflow-hidden p-8 border border-primary/10 relative group">
        <GraduationCap className="absolute -right-4 -bottom-4 h-40 w-40 text-primary/5 group-hover:rotate-12 transition-transform duration-700" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Progresso do Período Letivo</h3>
            <span className="text-2xl font-black text-white">{semesterProgress}%</span>
          </div>
          <Progress value={semesterProgress} className="h-3 bg-slate-900 shadow-inner" />
          <p className="text-[10px] font-bold text-slate-500 italic uppercase tracking-widest">
            {semesterProgress > 70 ? "Fase final! Mantenha o foco nos exames." : "Período em andamento. Continue organizando seus resumos."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* COLUNA: SESSÕES DO DIA */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
            Grade de Hoje
          </h3>
          <div className="grid gap-3">
            {todayClasses.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center bg-white/[0.02]">
                <p className="text-xs font-medium text-slate-500 italic opacity-60">Nenhum compromisso para este dia.</p>
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate(`/disciplines/${c.id}`)}
                  className="p-5 bg-slate-900/40 border border-white/5 rounded-[32px] flex items-center gap-5 hover:border-primary/40 transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: c.color }}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-white group-hover:text-primary transition-colors truncate">{c.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-slate-500">
                      <span className="text-[10px] font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> {c.start.slice(0, 5)} - {c.end.slice(0, 5)}</span>
                      {c.room && <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded-lg font-black uppercase">Sala {c.room}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-700 group-hover:text-primary transition-all" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUNA: ALERTAS DE ENTREGAS */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alertas Críticos
          </h3>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="p-8 rounded-[32px] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Tudo em dia!</p>
              </div>
            ) : (
              reminders.map((r) => (
                <div key={r.id} onClick={() => navigate('/reminders')} className="p-5 bg-slate-900/60 border border-white/5 rounded-[28px] hover:border-rose-500/30 transition-all cursor-pointer group">
                  <p className="text-sm font-black text-white leading-tight group-hover:text-rose-500 transition-colors">{r.title}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.disciplines?.color }} />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[100px]">{r.disciplines?.name || "Geral"}</span>
                    </div>
                    <Badge variant="destructive" className="text-[8px] font-black px-2 py-0.5 rounded-lg tracking-widest">
                      {format(new Date(r.due_date), "dd/MM")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
