import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Save, Clock, MapPin, User as UserIcon, Loader2 } from "lucide-react";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Schedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

export function DisciplineGeneral({ discipline, onUpdate }: { discipline: any; onUpdate: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [professor, setProfessor] = useState(discipline.professor ?? "");
  const [grade, setGrade] = useState(discipline.current_grade?.toString() ?? "");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (discipline?.id) {
      loadSchedules();
    }
  }, [discipline.id]);

  async function loadSchedules() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("discipline_schedules")
        .select("*")
        .eq("discipline_id", discipline.id)
        .order("day_of_week");
      
      if (error) throw error;

      setSchedules(data?.map((s: any) => ({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time?.slice(0, 5) ?? "08:00",
        end_time: s.end_time?.slice(0, 5) ?? "10:00",
        room: s.room ?? "",
      })) ?? []);
    } catch (err) {
      console.error("Erro ao carregar horários:", err);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!user || !discipline?.id) return;
    setSaving(true);
    
    try {
      // 1. Atualiza dados básicos
      const { error: discError } = await supabase.from("disciplines").update({
        professor: professor.trim() || null,
        current_grade: grade !== "" ? parseFloat(grade.replace(',', '.')) : null,
      }).eq("id", discipline.id);

      if (discError) throw discError;

      // 2. Sincroniza horários
      await supabase.from("discipline_schedules").delete().eq("discipline_id", discipline.id);

      if (schedules.length > 0) {
        const { error: insError } = await supabase.from("discipline_schedules").insert(
          schedules.map((s) => ({
            discipline_id: discipline.id,
            user_id: user.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room?.trim() || null,
          }))
        );
        if (insError) throw insError;
      }

      toast({ title: "Sucesso!", description: "Dados atualizados." });
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Informações Básicas */}
      <Card className="glass-card border-none shadow-xl bg-card/60 rounded-[32px]">
        <CardHeader className="pb-3 pt-6 px-6">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5" /> Gestão Docente
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase ml-1 opacity-60">Professor(a)</Label>
              <Input 
                className="rounded-2xl bg-muted/20 border-border/40 focus:ring-primary/20"
                placeholder="Ex: Dr. Silva"
                value={professor} 
                onChange={(e) => setProfessor(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase ml-1 opacity-60">Sua Média</Label>
              <Input 
                className="rounded-2xl bg-muted/20 border-border/40 font-bold"
                type="text" 
                placeholder="0,0"
                value={grade} 
                onChange={(e) => setGrade(e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cronograma de Aulas */}
      <Card className="glass-card border-none shadow-xl bg-card/60 rounded-[32px]">
        <CardHeader className="pb-3 pt-6 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Agenda Semanal
          </CardTitle>
          <Button size="sm" variant="ghost" className="text-primary font-black text-[10px] uppercase hover:bg-primary/10 rounded-xl" onClick={() => setSchedules([...schedules, { day_of_week: 1, start_time: "08:00", end_time: "10:00", room: "" }])}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          {schedules.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-3xl opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest">Nenhum horário definido</p>
            </div>
          ) : (
            schedules.map((s, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 rounded-3xl bg-muted/20 border border-border/20 relative group">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase opacity-40">Dia</Label>
                    <Select value={s.day_of_week.toString()} onValueChange={(v) => {
                      const updated = [...schedules];
                      updated[i].day_of_week = parseInt(v);
                      setSchedules(updated);
                    }}>
                      <SelectTrigger className="h-10 rounded-xl bg-background/50 border-none shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d, idx) => <SelectItem key={idx} value={idx.toString()}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase opacity-40">Horário</Label>
                    <div className="flex items-center gap-1">
                      <Input type="time" className="h-10 rounded-xl bg-background/50 border-none shadow-sm text-xs" value={s.start_time} onChange={(e) => {
                        const updated = [...schedules];
                        updated[i].start_time = e.target.value;
                        setSchedules(updated);
                      }} />
                      <span className="text-muted-foreground text-xs">às</span>
                      <Input type="time" className="h-10 rounded-xl bg-background/50 border-none shadow-sm text-xs" value={s.end_time} onChange={(e) => {
                        const updated = [...schedules];
                        updated[i].end_time = e.target.value;
                        setSchedules(updated);
                      }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase opacity-40">Sala</Label>
                    <div className="relative">
                      <Input placeholder="Local" className="h-10 pl-8 rounded-xl bg-background/50 border-none shadow-sm text-xs" value={s.room} onChange={(e) => {
                        const updated = [...schedules];
                        updated[i].room = e.target.value;
                        setSchedules(updated);
                      }} />
                      <MapPin className="absolute left-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="absolute -top-2 -right-2 h-7 w-7 bg-background shadow-md text-destructive hover:bg-destructive/10 rounded-full" onClick={() => setSchedules(schedules.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full h-14 rounded-[24px] font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? "Processando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
}
