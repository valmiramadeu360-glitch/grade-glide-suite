import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle2, Loader2, ChevronDown, Edit2, Check, AlertTriangle } from "lucide-react";
import { format, isPast, differenceInDays, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline { id: string; name: string; semester: string | null; }
interface Reminder {
  id: string;
  title: string;
  type: string;
  due_date: string;
  completed: boolean;
  discipline_id: string | null;
  disciplines?: { name: string; color: string; semester: string | null } | null;
}

export default function Reminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  
  // Estados UI
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState("2026.1"); // BI Acadêmico

  // Estados de Criação
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("none");

  // Estados de Edição em Tempo Real (O "Pilar" do App)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Estados de Exclusão Segura
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user, selectedSemester]);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  async function load() {
    setLoading(true);
    const [remRes, discRes] = await Promise.all([
      supabase
        .from("reminders")
        .select("*, disciplines(name, color, semester)")
        .eq("user_id", user?.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("disciplines")
        .select("id, name, semester")
        .eq("user_id", user?.id)
        .eq("semester", selectedSemester) // Traz apenas disciplinas do semestre atual
        .order("name"),
    ]);

    // Filtra lembretes para mostrar apenas os do semestre selecionado (ou gerais)
    const filteredReminders = (remRes.data ?? []).filter((r: any) => 
      !r.disciplines || r.disciplines.semester === selectedSemester
    );

    setReminders(filteredReminders);
    setDisciplines(discRes.data ?? []);
    setLoading(false);
  }

  // --- CRUD FUNCTIONS ---

  async function create() {
    if (!title.trim() || !dueDate || !user) {
      toast({ title: "Dados incompletos", description: "O título e a data são obrigatórios.", variant: "destructive" });
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
      toast({ title: "Erro de Servidor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prazo Agendado!" });
      setTitle(""); setDueDate(""); setDiscId("none"); setOpen(false);
      load();
    }
    setSubmitting(false);
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    
    setSavingEdit(true);
    const { error } = await supabase.from("reminders").update({ title: editTitle.trim() }).eq("id", editingId);
    
    if (error) {
      toast({ title: "Falha ao editar", description: error.message, variant: "destructive" });
    } else {
      setReminders(reminders.map(r => r.id === editingId ? { ...r, title: editTitle.trim() } : r));
    }
    setSavingEdit(false);
    setEditingId(null);
  }

  async function toggle(r: Reminder) {
    const { error } = await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    if (!error) setReminders(reminders.map(item => item.id === r.id ? { ...item, completed: !r.completed } : item));
  }

  async function confirmDelete() {
    if (!reminderToDelete) return;
    const { error } = await supabase.from("reminders").delete().eq("id", reminderToDelete.id);
    
    if (!error) {
      toast({ title: "Removido", description: "O prazo foi excluído do histórico." });
      setReminders(reminders.filter(r => r.id !== reminderToDelete.id));
    }
    setReminderToDelete(null);
  }

  const typeLabels: Record<string, string> = { exam: "Prova", assignment: "Trabalho", other: "Geral" };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 bg-slate-950">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Buscando Prazos...</p>
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* HEADER: App-like com Filtro de Semestre (BI) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
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
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Histórico Temporal</span>
          </div>
          
          <h1 className="text-4xl font-black text-white tracking-tighter">Cronograma</h1>
          <p className="text-slate-400 font-medium italic">Gestão de entregas e avaliações do semestre.</p>
        </div>
        
        {/* MODAL DE CRIAÇÃO (ADD LEMBRETE) */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8 active:scale-95 transition-all">
              <Plus className="mr-2 h-5 w-5" /> Agendar Prazo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 rounded-[32px] p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white">Novo Compromisso</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium text-xs">
                Configure um prazo para ser avisado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Título do Evento</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Entrega do Artigo" className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Categoria</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 rounded-xl text-white">
                      <SelectItem value="exam">Prova 📝</SelectItem>
                      <SelectItem value="assignment">Trabalho 📚</SelectItem>
                      <SelectItem value="other">Outro 📍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Matéria ({selectedSemester})</Label>
                  <Select value={discId} onValueChange={setDiscId}>
                    <SelectTrigger className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 truncate"><SelectValue placeholder="Escolha..." /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 rounded-xl text-white max-h-[200px]">
                      <SelectItem value="none" className="font-bold text-primary">Sem Vínculo / Geral</SelectItem>
                      {disciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Data e Horário Limite</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 [color-scheme:dark]" />
              </div>

              <Button onClick={create} disabled={submitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-4">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Agendamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {/* SEÇÃO 1: PENDENTES */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Entregas Futuras ({pending.length})
          </h3>
          
          {pending.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-[40px] border-white/5 bg-slate-900/40">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3 opacity-80" />
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Agenda Livre!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pending.map((r) => {
                const date = new Date(r.due_date);
                const overdue = isPast(date) && !isToday(date);
                const isUrgent = differenceInDays(date, new Date()) <= 2 && !overdue;
                const discColor = r.disciplines?.color || "#3b82f6";
                
                return (
                  <div key={r.id} className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-4 rounded-[28px] p-5 transition-all group border",
                    overdue ? "bg-rose-950/20 border-rose-500/20 shadow-inner" : "bg-slate-900/60 border-white/5 hover:border-primary/40 shadow-lg"
                  )}>
                    <div className="flex items-start sm:items-center gap-4 flex-1 w-full">
                      <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-6 w-6 rounded-lg border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 mt-1 sm:mt-0" />
                      
                      <div className="flex-1 min-w-0">
                        {/* MÓDULO DE EDIÇÃO DIRETA NO CARD */}
                        {editingId === r.id ? (
                           <div className="flex items-center gap-2 mb-1">
                             <Input 
                               ref={editInputRef}
                               value={editTitle}
                               onChange={(e) => setEditTitle(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                               className="h-9 bg-slate-950/80 border-primary/50 text-white font-black rounded-xl text-sm w-full max-w-[200px]"
                             />
                             <Button size="icon" onClick={saveEdit} className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white">
                               {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                             </Button>
                           </div>
                        ) : (
                          <div className="flex items-center gap-2 group/edit cursor-text w-fit" onClick={() => { setEditingId(r.id); setEditTitle(r.title); }}>
                            <p className={cn("font-black text-lg sm:text-base text-white leading-tight", overdue && "text-rose-400")}>{r.title}</p>
                            <Edit2 className="h-3 w-3 text-slate-600 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg">
                            <Calendar className="h-3 w-3 text-primary" />
                            {format(date, "dd MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {r.disciplines?.name && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: discColor }} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate max-w-[100px] sm:max-w-none">{r.disciplines.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <Badge variant={overdue ? "destructive" : isUrgent ? "default" : "outline"} className={cn("text-[9px] font-black px-3 py-1 rounded-xl tracking-widest", !overdue && !isUrgent && "border-white/10 text-slate-400")}>
                        {overdue ? "ATRASADO" : isUrgent ? "URGENTE" : typeLabels[r.type]}
                      </Badge>

                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-10 w-10 sm:h-8 sm:w-8 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all" 
                        onClick={() => setReminderToDelete(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SEÇÃO 2: CONCLUÍDOS */}
        {done.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Prazos Vencidos ({done.length})
            </h3>
            <div className="grid gap-2 opacity-60">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-[20px] p-4 bg-slate-900/20 border border-transparent group transition-colors hover:bg-slate-900/40 hover:border-white/5">
                  <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="h-5 w-5 rounded-lg border-emerald-500/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                  <p className="flex-1 text-sm text-slate-500 line-through font-bold truncate">{r.title}</p>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl" onClick={() => setReminderToDelete(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MODAL DE SEGURANÇA PARA EXCLUSÃO (App-like) */}
        <AlertDialog open={!!reminderToDelete} onOpenChange={(open) => !open && setReminderToDelete(null)}>
          <AlertDialogContent className="bg-slate-950 border-white/10 rounded-[32px] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-white text-xl font-black">
                <AlertTriangle className="h-6 w-6 text-rose-500" /> Descartar Lembrete
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 font-medium">
                Deseja excluir permanentemente o aviso de <span className="text-white font-bold">{reminderToDelete?.title}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
              <AlertDialogCancel className="rounded-xl h-12 bg-white/5 border-none text-white hover:bg-white/10 font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="rounded-xl h-12 bg-rose-500 text-white hover:bg-rose-600 font-black tracking-wider shadow-lg shadow-rose-500/20">
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
