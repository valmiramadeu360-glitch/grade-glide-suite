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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Bell, Trash2 } from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  const [title, setTitle] = useState("");
  const [type, setType] = useState("exam");
  const [dueDate, setDueDate] = useState("");
  const [discId, setDiscId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    const [remRes, discRes] = await Promise.all([
      supabase.from("reminders").select("*, disciplines(name)").order("due_date"),
      supabase.from("disciplines").select("id, name").order("name"),
    ]);
    setReminders(remRes.data ?? []);
    setDisciplines(discRes.data ?? []);
    setLoading(false);
  }

  async function create() {
    if (!title.trim() || !dueDate) return;
    await supabase.from("reminders").insert({
      user_id: user!.id,
      title: title.trim(),
      type,
      due_date: new Date(dueDate).toISOString(),
      discipline_id: discId || null,
    });
    setTitle("");
    setDueDate("");
    setOpen(false);
    load();
  }

  async function toggle(r: Reminder) {
    await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    load();
  }

  async function remove(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    load();
  }

  const typeLabels: Record<string, string> = { exam: "Prova", assignment: "Trabalho", other: "Outro" };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lembretes</h1>
          <p className="text-sm text-muted-foreground">Provas, trabalhos e prazos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lembrete</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Prova de Cálculo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Prova</SelectItem>
                      <SelectItem value="assignment">Trabalho</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Disciplina</Label>
                  <Select value={discId} onValueChange={setDiscId}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {disciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Button onClick={create} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum lembrete cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-3"><CardTitle className="text-base">Pendentes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {pending.map((r) => {
                  const overdue = isPast(new Date(r.due_date));
                  const diff = differenceInDays(new Date(r.due_date), new Date());
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg p-3 bg-muted/50 group">
                      <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.disciplines?.name && `${r.disciplines.name} · `}
                          {format(new Date(r.due_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={overdue ? "destructive" : diff <= 2 ? "default" : "secondary"}>
                        {typeLabels[r.type]}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => remove(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {done.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-3"><CardTitle className="text-base text-muted-foreground">Concluídos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {done.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg p-3 bg-muted/30 group">
                    <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} />
                    <p className="flex-1 text-sm text-muted-foreground line-through">{r.title}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
