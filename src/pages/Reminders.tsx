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
import { Plus, Bell, Trash2, Calendar, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format, isPast, differenceInDays, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline { id: string; name: string; }
interface Reminder {
  id: string;
  title: string;
  type: string;
  due_date: string;
  completed: boolean;
  discipline_id: string | null;
  disciplines?: { name: string } | null;
}

export default function Reminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados do formulário
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("none");

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    const [remRes, discRes] = await Promise.all([
      supabase
        .from("reminders")
        .select("*, disciplines(name)")
        .eq("user_id", user?.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("disciplines")
        .select("id, name")
        .eq("user_id", user?.id)
        .order("name"),
    ]);
    setReminders(remRes.data ?? []);
    setDisciplines(discRes.data ?? []);
    setLoading(false);
  }

  async function create() {
    if (!title.trim() || !dueDate || !user) {
      toast({ title: "Preencha o título e a data", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      title: title.trim(),
      type,
      due_date: new Date(dueDate).toISOString(),
      discipline_id: discId === "none" ? null : discId,
    });

    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lembrete criado!" });
      setTitle("");
      setDueDate("");
      setDiscId("none");
      setOpen(false);
      load();
    }
    setSubmitting(false);
  }

  async function toggle(r: Reminder) {
    const { error } = await supabase
      .from("reminders")
      .update({ completed: !r.completed })
      .eq("id", r.id);
    
    if (!error) load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (!error) {
      toast({ title: "Lembrete removido" });
      load();
    }
  }

  const typeLabels: Record<string, string> = { 
    exam: "Prova", 
    assignment: "Trabalho", 
    other: "Outro" 
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sincronizando prazos...</p>
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 px-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Cronograma de Prazos</h1>
          <p className="text-muted-foreground font-medium">Gestão de entregas e avaliações</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20 font-bold uppercase text-xs tracking-widest h-12 px-6">
              <Plus className="mr-2 h-4 w-4" /> Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Novo Lembrete</DialogTitle>
              <DialogDescription>Agende um novo prazo para suas disciplinas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Título do Evento</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: P1 de Microeconomia" className="h-12" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Categoria</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Prova 📝</SelectItem>
                      <SelectItem value="assignment">Trabalho 📚</SelectItem>
                      <SelectItem value="other">Outro 📍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Disciplina</Label>
                  <Select value={discId} onValueChange={setDiscId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Escolha..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geral / Extra</SelectItem>
                      {disciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Data e Horário Limite</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12" />
              </div>

              <Button onClick={create} disabled={submitting} className="w-full h-12 font-bold uppercase tracking-widest shadow-lg">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Agendar Lembrete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {/* Seção de Pendentes */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Pendentes ({pending.length})
          </h3>
          
          {pending.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-[32px] bg-muted/10">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground italic">Nenhum compromisso para os próximos dias.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pending.map((r) => {
                const date = new Date(r.due_date);
                const overdue = isPast(date) && !isToday(date);
                const isUrgent = differenceInDays(date, new Date()) <= 2;
                
                return (
                  <div key={r.id} className={cn(
                    "flex items-center gap-4 rounded-2xl p-4 transition-all border group",
                    overdue ? "bg-rose-500/5 border-rose-500/20" : "bg-card border-border/50 hover:border-primary/40 shadow-sm"
                  )}>
                    <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-5 w-5 rounded-md border-primary/30" />
                    
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-bold text-sm text-foreground", overdue && "text-rose-600")}>{r.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(date, "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {r.disciplines?.name && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-bold border-primary/20 text-primary uppercase">
                            {r.disciplines.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Badge variant={overdue ? "destructive" : isUrgent ? "default" : "secondary"} className="text-[10px] font-bold shrink-0">
                      {overdue ? "ATRASADO" : isUrgent ? "URGENTE" : typeLabels[r.type]}
                    </Badge>

                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Seção de Concluídos */}
        {done.length > 0 && (
          <section className="space-y-4 pt-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Finalizados
            </h3>
            <div className="grid gap-2 opacity-60">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-xl p-3 bg-muted/40 border border-transparent group">
                  <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-4 w-4 rounded-md" />
                  <p className="flex-1 text-sm text-muted-foreground line-through font-medium truncate">{r.title}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3 w-3" />
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
