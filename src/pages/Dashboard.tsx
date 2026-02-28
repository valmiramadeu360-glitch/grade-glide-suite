import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
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
    const today = new Date().getDay();

    const [schedRes, remRes, discRes, profileRes] = await Promise.all([
      supabase
        .from("discipline_schedules")
        .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
        .eq("day_of_week", today),
      supabase
        .from("reminders")
        .select("*, disciplines(name, color)")
        .eq("completed", false)
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(10),
      supabase.from("disciplines").select("id").eq("is_extra_course", false),
      supabase.from("profiles").select("semester_start, semester_end").eq("user_id", user!.id).single(),
    ]);

    if (schedRes.data) {
      setTodayClasses(
        schedRes.data.map((s: any) => ({
          discipline_name: s.disciplines?.name ?? "",
          discipline_id: s.discipline_id,
          color: s.disciplines?.color ?? "#3b82f6",
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
        })).sort((a: TodayClass, b: TodayClass) => a.start_time.localeCompare(b.start_time))
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
      const total = differenceInDays(end, start);
      const elapsed = differenceInDays(now, start);
      setSemesterProgress(Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))));
    }

    setLoading(false);
  }

  function getUrgencyLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d)) return { label: "Hoje", variant: "destructive" as const };
    if (isTomorrow(d)) return { label: "Amanhã", variant: "default" as const };
    const diff = differenceInDays(d, new Date());
    if (diff <= 3) return { label: `${diff} dias`, variant: "secondary" as const };
    return { label: format(d, "dd/MM", { locale: ptBR }), variant: "outline" as const };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disciplinas</p>
              <p className="text-2xl font-bold text-foreground">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aulas Hoje</p>
              <p className="text-2xl font-bold text-foreground">{todayClasses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prazos Pendentes</p>
              <p className="text-2xl font-bold text-foreground">{reminders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Semester progress */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progresso do Semestre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={semesterProgress} className="flex-1" />
            <span className="text-sm font-medium text-muted-foreground">{semesterProgress}%</span>
          </div>
          {semesterProgress === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Configure as datas do semestre nas Configurações.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Aulas de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma aula hoje 🎉</p>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                    className="flex items-center gap-3 w-full rounded-lg p-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <div className="h-8 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{c.discipline_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                        {c.room && ` · ${c.room}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Próximos Prazos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum prazo pendente ✅</p>
            ) : (
              <div className="space-y-3">
                {reminders.slice(0, 5).map((r) => {
                  const urgency = getUrgencyLabel(r.due_date);
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg p-3 bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{r.title}</p>
                        {r.discipline_name && (
                          <p className="text-xs text-muted-foreground">{r.discipline_name}</p>
                        )}
                      </div>
                      <Badge variant={urgency.variant}>{urgency.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
