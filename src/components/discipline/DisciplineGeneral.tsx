import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Save } from "lucide-react";

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, [discipline.id]);

  async function loadSchedules() {
    const { data } = await supabase
      .from("discipline_schedules")
      .select("*")
      .eq("discipline_id", discipline.id)
      .order("day_of_week");
    setSchedules(data?.map((s: any) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time?.slice(0, 5) ?? "08:00",
      end_time: s.end_time?.slice(0, 5) ?? "10:00",
      room: s.room ?? "",
    })) ?? []);
  }

  async function save() {
    setSaving(true);
    await supabase.from("disciplines").update({
      professor: professor || null,
      current_grade: grade ? parseFloat(grade) : null,
    }).eq("id", discipline.id);

    // Delete old and re-insert schedules
    await supabase.from("discipline_schedules").delete().eq("discipline_id", discipline.id);
    if (schedules.length > 0) {
      await supabase.from("discipline_schedules").insert(
        schedules.map((s) => ({
          discipline_id: discipline.id,
          user_id: user!.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room || null,
        }))
      );
    }
    toast({ title: "Salvo!" });
    setSaving(false);
    onUpdate();
  }

  function addSchedule() {
    setSchedules([...schedules, { day_of_week: 1, start_time: "08:00", end_time: "10:00", room: "" }]);
  }

  function removeSchedule(idx: number) {
    setSchedules(schedules.filter((_, i) => i !== idx));
  }

  function updateSchedule(idx: number, field: keyof Schedule, value: any) {
    const updated = [...schedules];
    (updated[idx] as any)[field] = value;
    setSchedules(updated);
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Professor</Label>
              <Input value={professor} onChange={(e) => setProfessor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Média Atual</Label>
              <Input type="number" step="0.1" min="0" max="10" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Horários</CardTitle>
          <Button size="sm" variant="outline" onClick={addSchedule}>
            <Plus className="mr-1 h-3 w-3" /> Horário
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {schedules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum horário cadastrado.</p>
          )}
          {schedules.map((s, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-muted/50">
              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label className="text-xs">Dia</Label>
                <Select value={s.day_of_week.toString()} onValueChange={(v) => updateSchedule(i, "day_of_week", parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input type="time" className="h-9 w-24" value={s.start_time} onChange={(e) => updateSchedule(i, "start_time", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input type="time" className="h-9 w-24" value={s.end_time} onChange={(e) => updateSchedule(i, "end_time", e.target.value)} />
              </div>
              <div className="space-y-1 flex-1 min-w-[80px]">
                <Label className="text-xs">Sala</Label>
                <Input className="h-9" value={s.room} onChange={(e) => updateSchedule(i, "room", e.target.value)} />
              </div>
              <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeSchedule(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}
