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
import { format, isPast, differenceInDays, isToday, isTomorrow, parseISO } from "date-fns";
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

  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("none");

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    try {
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
    } catch (err) {
      console.error("Erro ao carregar lembretes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!title.trim() || !dueDate || !user) {
      toast({ title: "Dados incompletos", description: "Preencha o título e a data do compromisso.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        title: title.trim(),
        type,
        due_date: dueDate, // Mantém a string local do input datetime-local
        discipline_id: discId === "none" ? null : discId,
        completed: false
      });

      if (error) throw error;

      toast({ title: "Agendado!", description: "Lembrete adicionado ao seu cronograma." });
      setTitle("");
      setDueDate("");
      setDiscId("none");
      setOpen(false);
      load();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(r: Reminder) {
    // Atualização Otimista
    const newStatus = !r.completed;
    setReminders(prev => prev.map(item => item.id === r.id ? { ...item, completed: newStatus } : item));

    const { error } = await supabase
      .from("reminders")
      .update({ completed: newStatus })
      .eq("id", r.id);
    
    if (error) load(); // Reverte se falhar
  }

  async function remove(id: string) {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (!error) {
      setReminders(prev => prev.filter(item => item.id !== id));
      toast({ title: "Removido", description: "O lembrete foi excluído." });
    }
  }

  const typeLabels: Record<string, string> = { 
    exam: "Prova", 
    assignment: "Trabalho", 
    other: "Outro" 
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando Agenda</p>
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter">Cronograma de Prazos</h1>
          <p className="text-slate-500 font-medium italic text-sm">Controle total de avaliações e entregas.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-2xl px-6 shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
              <Plus className="mr-2 h-4 w-4" /> Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none bg-slate-900 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white">Novo Lembrete</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium tracking-tight">Agende um novo compromisso para suas disciplinas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Título do Evento</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Entrega do BI" className="h-12 bg-slate-950 border-white/5 rounded-xl text-white placeholder:text-slate-700" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Categoria</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-12 bg-slate-950 border-white/5 rounded-xl text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="exam">Prova 📝</SelectItem>
                      <SelectItem value="assignment">Trabalho 📚</SelectItem>
                      <SelectItem value="other">Outro 📍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Disciplina</Label>
                  <Select value={discId} onValueChange={setDiscId}>
                    <SelectTrigger className="h-12 bg-slate-950 border-white/5 rounded-xl text-white"><SelectValue placeholder="Escolha..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Geral / Extra</SelectItem>
                      {disciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Data e Horário</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12 bg-slate-950 border-white/5 rounded-xl text-white [color-scheme:dark]" />
              </div>

              <Button onClick={create} disabled={submitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Agendar Compromisso"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-10">
        <section className="space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
            <AlertCircle className="h-4 w-4" /> Próximas Entregas ({pending.length})
          </h3>
          
          {pending.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-slate-900/20">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold text-slate-500 italic">Tudo em dia por enquanto.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pending.map((r) => {
                const date = parseISO(r.due_date);
                const overdue = isPast(date) && !isToday(date);
                const urgent = differenceInDays(date, new Date()) <= 2;
                
                return (
                  <div key={r.id} className={cn(
                    "flex items-center gap-5 rounded-[32px] p-5 transition-all border group",
                    overdue ? "bg-rose-500/5 border-rose-500/20" : "bg-slate-900/40 border-white/5 hover:border-primary/30 shadow-xl"
                  )}>
                    <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-6 w-6 rounded-lg border-primary/30 data-[state=checked]:bg-primary transition-all" />
                    
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-black text-base text-white tracking-tight leading-none mb-2", overdue && "text-rose-500")}>{r.title}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {format(date, "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {r.disciplines?.name && (
                          <span className="text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary px-3 py-1 rounded-full">
                            {r.disciplines.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge variant={overdue ? "destructive" : urgent ? "default" : "secondary"} className="text-[9px] font-black px-3 py-1.5 tracking-widest rounded-full uppercase border-none shadow-lg">
                      {overdue ? "ATRASADO" : urgent ? "URGENTE" : typeLabels[r.type]}
                    </Badge>

                    <Button size="icon" variant="ghost" className="h-10 w-10 text-slate-700 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/10 hover:text-rose-500 rounded-xl" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section className="space-y-5 pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4" /> Concluídos
            </h3>
            <div className="grid gap-3 opacity-40 grayscale hover:grayscale-0 hover:opacity-70 transition-all">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-5 rounded-3xl p-4 bg-slate-900/40 border border-transparent group">
                  <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-5 w-5 rounded-lg" />
                  <p className="flex-1 text-sm text-slate-400 line-through font-bold truncate tracking-tight">{r.title}</p>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100" onClick={() => remove(r.id)}>
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
