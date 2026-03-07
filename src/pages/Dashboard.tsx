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
// Importamos o Calendar (Componente) e o CalendarIcon (Ícone) separadamente para não dar conflito
import { Calendar as CalendarIcon, BookOpen, Clock, AlertTriangle, CheckCircle2, ArrowRight, Cloud, CloudOff, History, Loader2 } from "lucide-react";
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

// Sugere automaticamente o próximo período lógico (Ex: 2026.1 -> 2026.2)
function getNextSemesterLabel(current: string): string {
  const match = current.match(/^(\d{4})\.(\d+)/);
  if (!match) return `${new Date().getFullYear()}.2`;
  const year = parseInt(match[1]);
  const period = parseInt(match[2]);
  if (period >= 2) return `${year + 1}.1`;
  return `${year}.${period + 1}`;
}

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

  // Fluxo de Encerrar Semestre
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
      // 1. Busca os dados do Perfil para saber qual é o semestre "Real/Atual" do aluno
      const { data: profileData } = await supabase
        .from("profiles")
        .select("semester, semester_start, semester_end")
        .eq("user_id", user!.id)
        .maybeSingle();

      const realActiveSemester = profileData?.semester || currentLabel;
      const isPastSemester = currentLabel !== realActiveSemester;
      setIsHistoricalView(isPastSemester);

      // 2. Busca disciplinas do semestre selecionado (MÁQUINA DO TEMPO)
      // Removemos o filtro de 'archived' para que o aluno veja a contagem correta se voltar no tempo
      const { data: semDisciplines } = await supabase
        .from("disciplines")
        .select("id")
        .eq("user_id", user!.id)
        .eq("semester", currentLabel);

      const discIds = (semDisciplines ?? []).map(d => d.id);
      setDisciplineCount(discIds.length);

      // 3. Aulas de hoje (só faz sentido se não for visão histórica)
      let todayClassesResult: TodayClass[] = [];
      if (discIds.length > 0 && !isPastSemester) {
        const { data: schedData } = await supabase
          .from("discipline_schedules")
          .select("day_of_week, start_time, end_time, room, discipline_id, disciplines(name, color)")
          .eq("day_of_week", today)
          .eq("user_id", user!.id)
          .in("discipline_id", discIds);

        todayClassesResult = (schedData ?? []).map((s: any) => ({
          discipline_name: s.disciplines?.name ?? "Módulo",
          discipline_id: s.discipline_id,
          color: s.disciplines?.color ?? "#6366f1",
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
        })).sort((a, b) => a.start_time.localeCompare(b.start_time));
      }
      setTodayClasses(todayClassesResult);

      // 4. Lembretes pendentes do semestre
      const { data: remData } = await supabase
        .from("reminders")
        .select("*, disciplines(name, color)")
        .eq("completed", false)
        .eq("user_id", user!.id)
        .gte("due_date", startOfDay(new Date()).toISOString())
        .order("due_date", { ascending: true })
        .limit(8);

      const filteredReminders = (remData ?? []).filter((r: any) =>
        !r.discipline_id || discIds.includes(r.discipline_id)
      );
      
      setReminders(isPastSemester ? [] : filteredReminders.map((r: any) => ({
        ...r,
        discipline_name: r.disciplines?.name,
        discipline_color: r.disciplines?.color,
      })));

      // 5. Barra de Progresso Inteligente
      if (isPastSemester) {
        setSemesterProgress(100); // Semestres antigos sempre 100% concluídos
      } else if (profileData?.semester_start && profileData?.semester_end) {
        const start = new Date(profileData.semester_start);
        const end = new Date(profileData.semester_end);
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

  // Encerra o semestre atual e prepara o terreno para o novo
  async function endSemester() {
    if (!user || !nextSemesterInput.trim()) return;
    setEndingSemester(true);

    try {
      // Arquiva todas as matérias atuais
      await supabase
        .from("disciplines")
        .update({ archived: true })
        .eq("user_id", user.id)
        .eq("semester", currentLabel)
        .or("archived.is.null,archived.eq.false");

      // Atualiza o perfil do aluno para o novo semestre letivo
      await supabase
        .from("profiles")
        .update({
          semester: nextSemesterInput.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      setCurrentLabel(nextSemesterInput.trim());
      await loadSemesters();

      toast({ title: "Semestre encerrado! 🎉", description: `Bem-vindo ao período letivo ${nextSemesterInput.trim()}.` });
      setShowEndSemester(false);
      navigate("/disciplines"); // Redireciona para adicionar novas matérias
    } catch (error: any) {
      toast({ title: "Erro na migração", description: error.message, variant: "destructive" });
    } finally {
      setEndingSemester(false);
    }
  }

  // Formatação de URGÊNCIA exigida pelo Master Prompt
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Carregando Máquina do Tempo...</p>
        </div>
      </div>
    );
  }

  return (
    // Adicionado pb-24 para respeitar a Safe Area do iPhone
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* Modal: Encerrar Semestre */}
      <AlertDialog open={showEndSemester} onOpenChange={setShowEndSemester}>
        <AlertDialogContent className="rounded-[32px] bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-foreground">Encerrar Período Letivo?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium text-muted-foreground">
              Todas as disciplinas do semestre <strong className="text-foreground">{currentLabel}</strong> serão transferidas para o seu histórico.
              Confirme o identificador do próximo período:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={nextSemesterInput}
            onChange={e => setNextSemesterInput(e.target.value)}
            placeholder="Ex: 2026.2"
            className="h-14 rounded-2xl text-lg font-bold text-center bg-background border-border"
          />
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-2xl font-bold uppercase tracking-widest text-xs border-none bg-secondary/50 hover:bg-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={endSemester}
              disabled={endingSemester || !nextSemesterInput.trim()}
              className="h-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {endingSemester ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar e Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-6">
        <div className="space-y-3">
          {/* Seletor Global de Semestre (Máquina do Tempo) */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={currentLabel} onValueChange={setCurrentLabel}>
              <SelectTrigger className="w-auto h-10 bg-primary/10 text-primary border-none font-bold text-sm gap-2 rounded-xl px-4 hover:bg-primary/20 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-popover border border-border shadow-xl">
                {allSemesters.map(s => (
                  <SelectItem key={s} value={s} className="font-medium cursor-pointer">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {isHistoricalView ? "Visualizando Histórico" : "Período Atual"}
            </span>

            {/* Oculta o botão de encerrar se o aluno já estiver vendo o passado */}
            {disciplineCount > 0 && !isHistoricalView && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-[10px] font-bold uppercase tracking-widest rounded-xl border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all ml-auto sm:ml-0"
                onClick={() => {
                  setNextSemesterInput(getNextSemesterLabel(currentLabel));
                  setShowEndSemester(true);
                }}
              >
                <History className="mr-2 h-4 w-4" /> Encerrar Semestre
              </Button>
            )}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter flex items-center gap-3">
            Olá, Estudante! <span className="text-4xl animate-bounce">👋</span>
          </h1>
          <p className="text-muted-foreground font-medium text-base sm:text-lg max-w-xl">
            {isHistoricalView 
              ? `Você está consultando os arquivos e métricas do semestre ${currentLabel}.`
              : `Seu desempenho no semestre ${currentLabel} está sendo monitorado em tempo real.`}
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ml-1 sm:ml-0">
            {!isOnline ? (
              <span className="flex items-center gap-1.5 text-rose-500"><CloudOff className="h-3.5 w-3.5" /> Modo Offline (Sincronizando...)</span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-500"><Cloud className="h-3.5 w-3.5" /> Nuvem Conectada</span>
            )}
          </div>

          {/* Calendário Interativo (Modal) */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-12 w-full sm:w-auto bg-card border-border hover:bg-accent/10 hover:text-accent rounded-2xl flex items-center gap-3 shadow-sm px-5">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-[32px] p-6">
              <DialogHeader>
                <DialogTitle className="text-center font-black text-xl mb-4">Calendário Acadêmico</DialogTitle>
              </DialogHeader>
              {/* O input nativo de data é a forma mais leve e sem bugs de abrir um calendário mobile no iOS/Android */}
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground text-center mb-2">Selecione uma data para consulta rápida:</p>
                <input 
                  type="date" 
                  className="w-full h-14 bg-background border border-border rounded-2xl px-4 font-bold text-foreground [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Grid de Estatísticas Dinâmico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        <Card onClick={() => navigate('/disciplines')} className="glass-card border-border/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group bg-card rounded-[28px]">
          <CardContent className="flex items-center gap-5 p-6 sm:p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-inner">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matérias Registradas</p>
              <p className="text-4xl font-black text-foreground">{disciplineCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`glass-card border-border/50 shadow-lg transition-all rounded-[28px] ${isHistoricalView ? 'opacity-50 grayscale' : ''}`}>
          <CardContent className="flex items-center gap-5 p-6 sm:p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-inner">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aulas Hoje</p>
              <p className="text-4xl font-black text-foreground">{isHistoricalView ? '0' : todayClasses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => !isHistoricalView && navigate('/reminders')} className={`glass-card border-border/50 shadow-lg transition-all rounded-[28px] ${isHistoricalView ? 'opacity-50 grayscale' : 'hover:shadow-xl hover:-translate-y-1 cursor-pointer group'}`}>
          <CardContent className="flex items-center gap-5 p-6 sm:p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors shadow-inner">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prazos Críticos</p>
              <p className="text-4xl font-black text-foreground">{isHistoricalView ? '0' : reminders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso do Semestre */}
      <Card className="glass-card border-border/50 shadow-inner bg-card rounded-[32px] overflow-hidden">
        <CardHeader className="pb-3 px-6 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center justify-between">
            {isHistoricalView ? "STATUS DO PERÍODO ARQUIVADO" : "PROGRESSO DO PERÍODO LETIVO"}
            <span className="text-foreground/10 font-black text-5xl absolute right-6 sm:right-8 top-4 z-0 pointer-events-none">
              {semesterProgress}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10">
          <Progress value={semesterProgress} className="h-5 shadow-sm bg-muted/50 [&>div]:bg-primary rounded-full" />
          <p className="mt-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {isHistoricalView 
              ? "ESTE SEMESTRE FOI CONCLUÍDO E ENCONTRA-SÉ ARQUIVADO."
              : semesterProgress === 0 
                ? "Configure seu período letivo nas configurações para ativar." 
                : "PERÍODO EM ANDAMENTO. MANTENHA O RITMO DE ESTUDOS."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Coluna Esquerda: Aulas */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3 ml-2">
            <div className={`h-2.5 w-2.5 rounded-full ${isHistoricalView ? 'bg-muted' : 'bg-amber-500 animate-pulse'}`} />
            {isHistoricalView ? "Aulas do Período" : "Sessões de Hoje"}
          </h3>

          <div className="grid gap-4">
            {isHistoricalView || todayClasses.length === 0 ? (
              <div className="p-10 sm:p-14 border-2 border-dashed border-border/50 rounded-[32px] flex flex-col items-center justify-center text-muted-foreground bg-card/30">
                <p className="text-sm font-medium italic opacity-60 text-center">
                  {isHistoricalView ? "Visualização diária indisponível para o histórico." : "Nenhuma aula programada para hoje."}
                </p>
                {!isHistoricalView && (
                  <button onClick={() => navigate('/disciplines')} className="text-xs mt-5 font-black uppercase text-primary hover:text-primary/80 transition-colors bg-primary/10 px-6 py-3 rounded-xl">
                    Ver grade completa
                  </button>
                )}
              </div>
            ) : (
              todayClasses.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/disciplines/${c.discipline_id}`)}
                  className="group flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 w-full rounded-[28px] p-5 bg-card border border-border/50 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all text-left"
                >
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg group-hover:scale-110 transition-transform shrink-0" style={{ backgroundColor: c.color }}>
                    {c.discipline_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-lg text-foreground group-hover:text-primary transition-colors truncate">
                      {c.discipline_name}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-md border border-border/50">
                        <Clock className="h-3.5 w-3.5 text-primary" /> {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                      </span>
                      {c.room && (
                        <span className="bg-muted/80 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest">
                          SALA {c.room}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="hidden sm:block h-6 w-6 text-muted-foreground/30 group-hover:text-primary transition-colors mr-2" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Coluna Direita: Lembretes */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-destructive ml-2">
            <AlertTriangle className="h-4 w-4" />
            Entregas Próximas
          </h3>
          <div className="space-y-4">
            {isHistoricalView || reminders.length === 0 ? (
              <div className="p-10 rounded-[32px] bg-emerald-500/5 border border-emerald-500/20 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Tranquilidade Acadêmica</p>
                <p className="text-[10px] text-emerald-600/70 mt-1.5 uppercase tracking-wide">
                  {isHistoricalView ? "Semestres passados não possuem prazos." : "Nenhuma entrega pendente detectada."}
                </p>
              </div>
            ) : (
              reminders.map((r) => {
                const urgency = getUrgencyLabel(r.due_date, r.type);
                return (
                  <div key={r.id} onClick={() => navigate('/reminders')} className="cursor-pointer group flex flex-col gap-3 rounded-[28px] p-5 sm:p-6 bg-card border border-border/50 hover:border-destructive/40 transition-all shadow-sm hover:shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-2">
                      <div className="min-w-0 order-2 sm:order-1">
                        <p className="font-black text-sm sm:text-base text-foreground leading-tight group-hover:text-destructive transition-colors">{r.title}</p>
                        <div className="flex items-center gap-2.5 mt-2.5 bg-background border border-border/50 px-2.5 py-1.5 rounded-lg w-fit">
                          <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: r.discipline_color || '#64748b' }} />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[160px]">
                            {r.discipline_name || "Contexto Geral"}
                          </span>
                        </div>
                      </div>
                      <Badge variant={urgency.variant} className="order-1 sm:order-2 shrink-0 text-[10px] font-black px-3 py-1.5 tracking-widest rounded-xl self-start">
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

