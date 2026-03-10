import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Bell, Trash2, Calendar, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { format, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Discipline { id: string; name: string; }
interface Reminder {
  id: string;
  title: string;
  type: string;
  due_date: string;
  completed: boolean;
  discipline_id: string | null;
  disciplines?: { name: string; color?: string } | null;
}

const typeLabels: Record<string, string> = {
  exam: "Prova",
  assignment: "Trabalho",
  seminar: "Seminário",
  presentation: "Apresentação",
  other: "Outro",
};

export default function Reminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados do Modal
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("none");

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const [remRes, discRes] = await Promise.all([
        supabase.from("reminders").select("*, disciplines(name, color)").eq("user_id", user?.id).order("due_date", { ascending: true }),
        supabase.from("disciplines").select("id, name").eq("user_id", user?.id).eq("archived", false).order("name"),
      ]);
      setReminders(remRes.data ?? []);
      setDisciplines(discRes.data ?? []);
    } catch (error) {
      console.error("Erro ao carregar lembretes:", error);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditId(null);
    setTitle("");
    setType("assignment"); // Mudado padrão para 'trabalho' que é mais comum
    setDueDate("");
    setDiscId("none");
    setOpen(true);
  }

  function openEdit(r: Reminder) {
    setEditId(r.id);
    setTitle(r.title);
    setType(r.type);
    setDueDate(format(new Date(r.due_date), "yyyy-MM-dd'T'HH:mm"));
    setDiscId(r.discipline_id || "none");
    setOpen(true);
  }

  async function save() {
    if (!title.trim() || !dueDate || !user) {
      toast({ title: "Atenção", description: "O título e a data de entrega são obrigatórios.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    
    // Tratamento de fuso horário seguro
    const safeDate = new Date(dueDate);

    const payload = {
      title: title.trim(),
      type,
      due_date: safeDate.toISOString(),
      discipline_id: discId === "none" ? null : discId,
    };

    try {
      if (editId) {
        const { error } = await supabase.from("reminders").update(payload).eq("id", editId).eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Lembrete atualizado!" });
      } else {
        const { error } = await supabase.from("reminders").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast({ title: "Prazo adicionado à agenda!" });
      }
      setOpen(false);
      load();
    } catch (error: any) {
      toast({ title: "Erro na operação", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(r: Reminder) {
    // Optimistic Update (Ação Imediata na tela)
    const newReminders = reminders.map(item => item.id === r.id ? { ...item, completed: !item.completed } : item);
    setReminders(newReminders);

    // Feedback visual rápido se marcou como concluído
    if (!r.completed) {
       toast({ title: "Tarefa Finalizada! 🎉", description: "Menos uma pendência na sua lista.", duration: 2000 });
    }

    try {
      const { error } = await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
      if (error) throw error;
    } catch (error) {
      // Se falhar no banco, reverte a UI
      toast({ title: "Erro de sincronização", description: "Não foi possível salvar o status.", variant: "destructive" });
      load(); 
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Deseja excluir permanentemente este lembrete?")) return;
    try {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Lembrete descartado." });
      load();
    } catch (error) {
       toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  function getUrgencyBadge(dateStr: string, rType: string) {
    const date = new Date(dateStr);
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    const typeLabel = typeLabels[rType] || rType;

    const overdue = isPast(date) && !isToday(date);
    const daysDiff = differenceInDays(target, today);
    const isUrgent = daysDiff <= 2 && daysDiff >= 0;

    if (overdue) return { label: `ATRASADO • ${typeLabel.toUpperCase()}`, variant: "destructive" as const };
    if (isToday(date)) return { label: `HOJE • ${typeLabel.toUpperCase()}`, variant: "destructive" as const };
    if (isTomorrow(date)) return { label: `AMANHÃ • ${typeLabel.toUpperCase()}`, variant: "default" as const };
    if (isUrgent) return { label: `URGENTE • ${typeLabel.toUpperCase()}`, variant: "secondary" as const };
    
    return { label: typeLabel.toUpperCase(), variant: "outline" as const };
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Consultando Prazos...</p>
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 px-4 sm:px-6 pb-24 pt-6 overflow-x-hidden">
      
      {/* Header Responsivo */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted shrink-0 transition-all"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight truncate">
              Cronograma
            </h1>
            <p className="text-muted-foreground font-bold text-[10px] sm:text-xs mt-1 uppercase tracking-widest truncate">
              Gestão de Entregas e Avaliações
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="w-full sm:w-auto shadow-xl shadow-primary/20 font-black uppercase text-[10px] sm:text-xs tracking-widest h-14 sm:h-16 px-8 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all">
              <Plus className="mr-2 h-5 w-5" /> Agendar Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] bg-card border-border p-6 sm:p-8 shadow-2xl">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">
                {editId ? "Editar Compromisso" : "Novo Agendamento"}
              </DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm">
                Mapeie seus prazos e defina a data limite para a sua tarefa.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título da Tarefa</Label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Ex: Fichamento 01, Prova Final..." 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/30" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoria</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border border-border/50 font-bold text-foreground focus:ring-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                      <SelectItem value="exam" className="py-3 font-bold">Prova 📝</SelectItem>
                      <SelectItem value="assignment" className="py-3 font-bold">Trabalho 📚</SelectItem>
                      <SelectItem value="seminar" className="py-3 font-bold">Seminário 🎤</SelectItem>
                      <SelectItem value="presentation" className="py-3 font-bold">Apresentação 🖥️</SelectItem>
                      <SelectItem value="other" className="py-3 font-bold">Outro 📍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Módulo/Curso</Label>
                  <Select value={discId} onValueChange={setDiscId}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border border-border/50 font-bold text-foreground focus:ring-primary/30">
                      <SelectValue placeholder="Escolha..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl max-h-[250px]">
                      <SelectItem value="none" className="py-3 font-black text-primary">Contexto Geral</SelectItem>
                      {disciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="py-3 font-bold">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data e Hora Limite</Label>
                <Input 
                  type="datetime-local" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)} 
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold focus:ring-primary/30 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark] text-sm sm:text-base px-5 w-full appearance-none block" 
                />
              </div>

              <Button 
                onClick={save} 
                disabled={submitting} 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 active:scale-95 transition-all"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editId ? "Atualizar Prazo" : "Salvar na Agenda"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Listagem de Tarefas */}
      <div className="space-y-12 mt-10">
        
        {/* Entregas Pendentes */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 bg-card p-4 rounded-[24px] border border-border/40 shadow-sm w-fit">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                Lista de Prioridades
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest mt-0.5">
                {pending.length} Pendentes
              </p>
            </div>
          </div>

          {pending.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-card/20 shadow-inner flex flex-col items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 shadow-sm">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <p className="text-xl font-black text-foreground">Sua agenda está limpa!</p>
              <p className="text-sm text-muted-foreground font-medium mt-2 max-w-xs leading-relaxed">
                Nenhum compromisso pendente. Aproveite para adiantar os resumos das próximas aulas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pending.map((r) => {
                const date = new Date(r.due_date);
                const badge = getUrgencyBadge(r.due_date, r.type);

                return (
                  <Card 
                    key={r.id} 
                    className="group overflow-hidden border-border/40 hover:border-primary/40 hover:bg-accent/5 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl rounded-[28px] bg-card active:scale-[0.98]"
                    onClick={() => openEdit(r)}
                  >
                    <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                      
                      <div className="flex-shrink-0 pt-1 sm:pt-0">
                        <Checkbox
                          checked={r.completed}
                          onCheckedChange={(e) => { e; toggle(r); }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 w-8 rounded-xl border-2 border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-inner transition-all hover:scale-110"
                        />
                      </div>

                      <div className="flex-1 min-w-0 order-3 sm:order-2 w-full space-y-2">
                        <p className={cn("font-black text-lg leading-tight truncate transition-colors", badge.variant === "destructive" ? "text-destructive group-hover:text-destructive/80" : "text-foreground group-hover:text-primary")}>
                          {r.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 bg-background border border-border/50 px-3 py-1.5 rounded-lg shadow-sm">
                            <Calendar className="h-3 w-3 text-primary" />
                            {format(date, "dd MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {r.disciplines?.name && (
                            <div className="flex items-center gap-2 bg-background border border-border/50 px-3 py-1.5 rounded-lg shadow-sm max-w-full">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.disciplines.color || '#64748b' }} />
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">
                                {r.disciplines.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:flex-col gap-3 w-full sm:w-auto order-2 sm:order-3 sm:items-end">
                        <Badge variant={badge.variant} className="text-[9px] font-black px-3 py-1 tracking-widest rounded-xl shrink-0 uppercase shadow-sm">
                          {badge.label}
                        </Badge>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all focus:opacity-100"
                          onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                          title="Excluir Lembrete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Tarefas Concluídas (Histórico) */}
        {done.length > 0 && (
          <section className="space-y-5 pt-10 border-t border-border/30">
            <div className="flex items-center gap-4 px-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Arquivo de Concluídas
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-2xl p-4 sm:p-5 bg-card/50 border border-border/30 group hover:opacity-100 transition-all hover:bg-card">
                  <Checkbox 
                    checked={r.completed} 
                    onCheckedChange={() => toggle(r)} 
                    className="h-7 w-7 rounded-xl data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 transition-transform hover:scale-105" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-muted-foreground line-through font-bold truncate">
                      {r.title}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1">
                      {r.disciplines?.name || "Geral"}
                    </p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-10 w-10 rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-all" 
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
