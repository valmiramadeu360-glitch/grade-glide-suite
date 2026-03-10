import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, CloudOff, Loader2, Bell, Clock, MapPin, User, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

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
      toast({ title: "Modo Offline", description: "Conecte-se à internet para salvar as alterações no banco.", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    try {
      const { error: discError } = await supabase.from("disciplines").update({
        professor: professor.trim() || null,
        current_grade: grade !== "" ? parseFloat(grade) : null,
      }).eq("id", discipline.id);

      if (discError) throw discError;

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

      toast({ 
        title: "Alterações Salvas 💾",
        description: "As informações da matéria foram atualizadas."
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
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {isOffline && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest animate-pulse border border-destructive/20 shadow-inner">
          <CloudOff className="h-5 w-5 shrink-0" />
          Offline: Edições de painel temporariamente bloqueadas
        </div>
      )}

      {/* Informações Gerais */}
      <Card className={cn("glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden transition-opacity", isOffline && "opacity-60")}>
        <CardHeader className="pb-4 pt-6 px-6 sm:px-8 border-b border-border/40">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6 sm:px-8 sm:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Docente / Responsável</Label>
              <Input 
                placeholder="Ex: Prof. Dr. Silva"
                className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/30 transition-all"
                value={professor} 
                onChange={(e) => setProfessor(e.target.value)} 
                disabled={isOffline}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <GraduationCap className="h-3 w-3" /> Média Atual / Nota
              </Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0" 
                max="10" 
                placeholder="Ex: 8.5"
                className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-black text-primary focus:ring-primary/30 transition-all"
                value={grade} 
                onChange={(e) => setGrade(e.target.value)} 
                disabled={isOffline}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade de Horários */}
      <Card className={cn("glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden transition-opacity", isOffline && "opacity-60")}>
        <CardHeader className="pb-4 pt-6 px-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Grade de Horários
          </CardTitle>
          <Button size="sm" onClick={addSchedule} disabled={isOffline} className="h-12 w-full sm:w-auto px-6 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform">
            <Plus className="mr-2 h-4 w-4" /> Adicionar Aula
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6 sm:p-8 bg-card/30">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-background">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-black text-foreground">Nenhum horário definido</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Configure os dias de aula desta matéria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {schedules.map((s, i) => (
                <div key={i} className="flex flex-col gap-5 p-5 sm:p-6 rounded-[28px] bg-background border border-border/60 shadow-sm relative group hover:border-primary/40 transition-colors">
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 w-full pr-4">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Dia da Semana</Label>
                      <Select disabled={isOffline} value={s.day_of_week.toString()} onValueChange={(v) => updateSchedule(i, "day_of_week", parseInt(v))}>
                        <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black text-sm focus:ring-primary/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl bg-popover border-border shadow-2xl">
                          {DAYS.map((d, idx) => (
                            <SelectItem key={idx} value={idx.toString()} className="font-bold py-3 cursor-pointer">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      size="icon" 
                      variant="ghost" 
                      disabled={isOffline}
                      className="h-14 w-14 shrink-0 rounded-2xl text-destructive hover:bg-destructive/10 bg-destructive/5 sm:bg-transparent sm:opacity-0 group-hover:opacity-100 transition-all self-end active:scale-90" 
                      onClick={() => removeSchedule(i)}
                    >
                      <Trash2 className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="space-y-2 w-full">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Início</Label>
                      <Input 
                        type="time" 
                        disabled={isOffline} 
                        className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black w-full focus:ring-primary/30 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" 
                        value={s.start_time} 
                        onChange={(e) => updateSchedule(i, "start_time", e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2 w-full">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Fim</Label>
                      <Input 
                        type="time" 
                        disabled={isOffline} 
                        className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black w-full focus:ring-primary/30 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" 
                        value={s.end_time} 
                        onChange={(e) => updateSchedule(i, "end_time", e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> Sala / Laboratório
                    </Label>
                    <Input 
                      placeholder="Ex: Sala 42, Bloco C..." 
                      disabled={isOffline} 
                      className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold focus:ring-primary/30" 
                      value={s.room} 
                      onChange={(e) => updateSchedule(i, "room", e.target.value)} 
                    />
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex flex-col items-center gap-5 pt-8 pb-4">
        <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-card border border-border/40 px-5 py-3 rounded-full shadow-sm">
          <Bell className="h-4 w-4 text-primary" />
          A grade sincroniza com o seu calendário na home
        </div>
        <Button 
          onClick={save} 
          disabled={saving || isOffline} 
          className="w-full sm:w-auto sm:min-w-[320px] h-16 rounded-[24px] font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Atualizando...
            </>
          ) : (
            <>
              <Save className="mr-3 h-6 w-6" /> Salvar Informações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
