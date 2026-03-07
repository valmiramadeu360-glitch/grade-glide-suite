import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("none");

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    const [remRes, discRes] = await Promise.all([
      supabase.from("reminders").select("*, disciplines(name, color)").eq("user_id", user?.id).order("due_date", { ascending: true }),
      supabase.from("disciplines").select("id, name").eq("user_id", user?.id).order("name"),
    ]);
    setReminders(remRes.data ?? []);
    setDisciplines(discRes.data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setTitle("");
    setType("exam");
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
      toast({ title: "Preencha o título e a data", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const payload = {
      title: title.trim(),
      type,
      due_date: new Date(dueDate).toISOString(),
      discipline_id: discId === "none" ? null : discId,
    };

    // TODO: Web Push - Implement ServiceWorkerRegistration.showNotification here for scheduled push

    if (editId) {
      const { error } = await supabase.from("reminders").update(payload).eq("id", editId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Lembrete atualizado com sucesso!" });
        setOpen(false);
        load();
      }
    } else {
      const { error } = await supabase.from("reminders").insert({ ...payload, user_id: user.id });
      if (error) {
        toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Prazo agendado na sua agenda!" });
        setOpen(false);
        load();
      }
    }
    setSubmitting(false);
  }

  async function toggle(r: Reminder) {
    // Optimistic update para UX perfeita (não espera o banco para piscar na tela)
    const newReminders = reminders.map(item => item.id === r.id ? { ...item, completed: !item.completed } : item);
    setReminders(newReminders);

    const { error } = await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    if (error) load(); // Se der erro, recarrega a verdade do banco
  }

  async function remove(id: string) {
    if (!window.confirm("Deseja excluir permanentemente este lembrete?")) return;
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (!error) {
      toast({ title: "Lembrete excluído." });
      load();
    }
  }

  // Formatação de URGÊNCIA exigida pelo Master Prompt
  function getUrgencyBadge(dateStr: string, rType: string) {
    const date = new Date(dateStr);
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    const typeLabel = typeLabels[rType] || rType;

    const overdue = isPast(date) && !isToday(date);
    const daysDiff = differenceInDays(target, today);
    const isUrgent = daysDiff <= 2 && daysDiff >= 0;

    if (overdue) {
      return { label: `ATRASADO • ${typeLabel.toUpperCase()}`, variant: "destructive" as const };
    }
    if (isUrgent) {
      return { label: `URGENTE • ${typeLabel.toUpperCase()}`, variant: "secondary" as const };
    }
    return { label: typeLabel.toUpperCase(), variant: "outline" as const };
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Sincronizando Agenda...</p>
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    // Safe Area inferior pb-24
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 px-4 sm:px-6 pb-24 pt-6">
      
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted shrink-0 transition-all"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight truncate">
              Cronograma
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              Gestão de Entregas e Avaliações
            </p>
          </div>
        </div>

        <Button onClick={openNew} className="w-full sm:w-auto shadow-xl shadow-primary/20 font-black uppercase text-[10px] sm:text-xs tracking-widest h-14 px-8 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-5 w-5" /> Agendar Lembrete
        </Button>
      </div>

      {/* Dialog Edit/New com fundos sólidos para correção de transparência */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] bg-card border-border p-6 sm:p-8">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-black text-foreground">
              {editId ? "Editar Compromisso" : "Novo Agendamento"}
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground text-sm mt-1">
              Organize seus prazos e defina a data de entrega da sua tarefa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título da Tarefa</Label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Ex: P1 de Anatomia, Fichamento 01" 
                className="h-14 rounded-2xl bg-background border-border text-base font-bold focus:ring-primary/20" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Categoria</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background border border-border font-bold text-foreground focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                    <SelectItem value="exam" className="py-3 font-medium">Prova 📝</SelectItem>
                    <SelectItem value="assignment" className="py-3 font-medium">Trabalho 📚</SelectItem>
                    <SelectItem value="seminar" className="py-3 font-medium">Seminário 🎤</SelectItem>
                    <SelectItem value="presentation" className="py-3 font-medium">Apresentação 🖥️</SelectItem>
                    <SelectItem value="other" className="py-3 font-medium">Outro 📍</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Disciplina/Curso</Label>
                <Select value={discId} onValueChange={setDiscId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background border border-border font-bold text-foreground focus:ring-primary/20">
                    <SelectValue placeholder="Escolha..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl max-h-[250px]">
                    <SelectItem value="none" className="py-3 font-black text-primary">Contexto Geral</SelectItem>
                    {disciplines.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="py-3 font-medium">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Data de Entrega</Label>
              {/* O input nativo 'datetime-local' abre o seletor nativo lindo do iOS/Android */}
              <Input 
                type="datetime-local" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
                className="h-14 rounded-2xl bg-background border-border font-bold focus:ring-primary/20 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" 
              />
            </div>

            <Button 
              onClick={save} 
              disabled={submitting} 
              className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editId ? "Salvar Alterações" : "Agendar Prazo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-10 mt-8">
        {/* Sessão Pendentes */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-foreground">
              Entregas Pendentes <span className="text-muted-foreground ml-1">({pending.length})</span>
            </h3>
          </div>

          {pending.length === 0 ? (
            <div className="p-14 text-center border-2 border-dashed border-border/50 rounded-[40px] bg-card/50 shadow-sm">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-5">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <p className="text-lg font-black text-foreground">Tudo em dia!</p>
              <p className="text-sm text-muted-foreground font-medium mt-2 max-w-xs mx-auto">Sua agenda está limpa. Nenhum compromisso ou entrega para os próximos dias.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pending.map((r) => {
                const date = new Date(r.due_date);
                const badge = getUrgencyBadge(r.due_date, r.type);

                return (
                  <Card 
                    key={r.id} 
                    className="group overflow-hidden border border-border/50 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 rounded-[28px] bg-card"
                    onClick={() => openEdit(r)}
                  >
                    <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
                      
                      {/* Checkbox Gigante */}
                      <div className="flex-shrink-0 pt-1 sm:pt-0">
                        <Checkbox
                          checked={r.completed}
                          onCheckedChange={(e) => { e; toggle(r); }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl border-2 border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-inner transition-colors"
                        />
                      </div>

                      <div className="flex-1 min-w-0 order-3 sm:order-2 w-full">
                        <p className={cn("font-black text-base sm:text-lg leading-tight truncate", badge.variant === "destructive" ? "text-destructive" : "text-foreground")}>
                          {r.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2.5">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 bg-background border border-border/50 px-2.5 py-1 rounded-md">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {format(date, "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {r.disciplines?.name && (
                            <div className="flex items-center gap-1.5 bg-background border border-border/50 px-2.5 py-1 rounded-md max-w-[140px] sm:max-w-xs">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.disciplines.color || '#64748b' }} />
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">
                                {r.disciplines.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto order-2 sm:order-3">
                        <Badge variant={badge.variant} className="text-[10px] sm:text-[11px] font-black px-3 py-1.5 tracking-widest rounded-xl shrink-0">
                          {badge.label}
                        </Badge>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all ml-auto sm:ml-0"
                          onClick={(e) => { e.stopPropagation(); remove(r.id); }}
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

        {/* Sessão Finalizados */}
        {done.length > 0 && (
          <section className="space-y-5 pt-8 border-t border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest text-muted-foreground">
                Tarefas Concluídas
              </h3>
            </div>
            <div className="grid gap-3 opacity-70">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-2xl p-4 sm:p-5 bg-card border border-border/30 group hover:opacity-100 transition-opacity">
                  <Checkbox 
                    checked={r.completed} 
                    onCheckedChange={() => toggle(r)} 
                    className="h-6 w-6 rounded-lg data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" 
                  />
                  <p className="flex-1 text-sm sm:text-base text-muted-foreground line-through font-bold truncate">
                    {r.title}
                  </p>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-10 w-10 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-all" 
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
