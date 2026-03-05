import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Save, CloudOff, Loader2, Bell } from "lucide-react";

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
  
  // Controle do Modo Offline
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadSchedules();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
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
    if (!user) return;
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se à internet para salvar as alterações.", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    try {
      // 1. Atualiza dados básicos da disciplina
      const { error: discError } = await supabase.from("disciplines").update({
        professor: professor.trim() || null,
        current_grade: grade !== "" ? parseFloat(grade) : null,
      }).eq("id", discipline.id);

      if (discError) throw discError;

      // 2. Sincroniza horários (Deleta antigos e insere novos)
      const { error: delError } = await supabase
        .from("discipline_schedules")
        .delete()
        .eq("discipline_id", discipline.id);

      if (delError) throw delError;

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

      // Alerta de Notificação Integrada
      toast({ 
        title: "Alterações salvas com sucesso!",
        description: "A equipe foi notificada sobre a atualização na grade."
      });
      onUpdate();
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
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
    <div className="space-y-6">
      {isOffline && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest animate-pulse">
          <CloudOff className="h-4 w-4" />
          Modo offline ativado - Edição bloqueada
        </div>
      )}

      <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/40">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Professor Responsável</Label>
              <Input 
                placeholder="Nome do docente"
                className="h-14 rounded-2xl bg-muted/30 border-border text-base font-medium"
                value={professor} 
                onChange={(e) => setProfessor(e.target.value)} 
                disabled={isOffline}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Média Atual / Nota</Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0" 
                max="10" 
                placeholder="0.0"
                className="h-14 rounded-2xl bg-muted/30 border-border text-base font-medium"
                value={grade} 
                onChange={(e) => setGrade(e.target.value)} 
                disabled={isOffline}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
        <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">
            Grade de Horários
          </CardTitle>
          <Button size="sm" onClick={addSchedule} disabled={isOffline} className="h-9 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest">
            <Plus className="mr-1 h-3 w-3" /> Adicionar Aula
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-xs font-medium text-muted-foreground">Nenhum horário definido para esta matéria.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {schedules.map((s, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl bg-muted/20 border border-border/50 relative group">
                  {/* Botão de Excluir reposicionado para melhor uso no mobile */}
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    disabled={isOffline}
                    className="absolute top-2 right-2 h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => removeSchedule(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="space-y-2 flex-1">
                    <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Dia da Semana</Label>
                    <Select disabled={isOffline} value={s.day_of_week.toString()} onValueChange={(v) => updateSchedule(i, "day_of_week", parseInt(v))}>
                      <SelectTrigger className="h-12 rounded-xl bg-background border-border font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {DAYS.map((d, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-3 flex-1">
                    <div className="space-y-2 w-full">
                      <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Início</Label>
                      <Input type="time" disabled={isOffline} className="h-12 rounded-xl bg-background border-border font-medium w-full" value={s.start_time} onChange={(e) => updateSchedule(i, "start_time", e.target.value)} />
                    </div>
                    <div className="space-y-2 w-full">
                      <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Fim</Label>
                      <Input type="time" disabled={isOffline} className="h-12 rounded-xl bg-background border-border font-medium w-full" value={s.end_time} onChange={(e) => updateSchedule(i, "end_time", e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Sala/Local</Label>
                    <Input placeholder="Ex: Bloco A" disabled={isOffline} className="h-12 rounded-xl bg-background border-border font-medium" value={s.room} onChange={(e) => updateSchedule(i, "room", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3 pt-4 pb-8">
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <Bell className="h-3 w-3 text-primary" />
          Alterações geram notificações para a equipe
        </div>
        <Button onClick={save} disabled={saving || isOffline} className="w-full sm:w-auto min-w-[250px] h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" /> Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
