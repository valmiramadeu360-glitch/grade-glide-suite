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
      toast({ title: "Modo Offline", description: "Conecte-se à internet para salvar as alterações no banco.", variant: "destructive" });
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

      toast({ 
        title: "Alterações salvas com sucesso! 💾",
        description: "Seu painel foi atualizado."
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
        <div className="bg-destructive/10 text-destructive p-3.5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest animate-pulse border border-destructive/20">
          <CloudOff className="h-4 w-4" />
          Modo offline - Edições de painel bloqueadas
        </div>
      )}

      {/* Cartão de Informações Gerais */}
      <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
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
                className="h-14 rounded-2xl bg-background border-border/50 text-base font-bold focus:ring-primary/20 shadow-sm"
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
                className="h-14 rounded-2xl bg-background border-border/50 text-base font-bold focus:ring-primary/20 shadow-sm"
                value={grade} 
                onChange={(e) => setGrade(e.target.value)} 
                disabled={isOffline}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartão de Grade de Horários */}
      <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
        <CardHeader className="pb-4 pt-6 px-6 sm:px-8 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Grade de Horários
          </CardTitle>
          <Button size="sm" onClick={addSchedule} disabled={isOffline} className="h-10 sm:h-12 px-5 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar Aula
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6 sm:p-8 bg-card/30">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border/50 rounded-[28px] bg-background">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-bold text-foreground">Nenhum horário definido.</p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">Adicione os dias de aula desta matéria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {schedules.map((s, i) => (
                <div key={i} className="flex flex-col gap-5 p-5 sm:p-6 rounded-[24px] bg-background border border-border/60 shadow-sm relative group hover:border-primary/40 transition-colors">
                  
                  {/* Cabeçalho do Card Interno */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5 w-full pr-4">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Dia da Semana</Label>
                      <Select disabled={isOffline} value={s.day_of_week.toString()} onValueChange={(v) => updateSchedule(i, "day_of_week", parseInt(v))}>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border font-bold text-sm focus:ring-primary/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-popover border-border shadow-2xl">
                          {DAYS.map((d, idx) => (
                            <SelectItem key={idx} value={idx.toString()} className="font-medium py-2.5 cursor-pointer">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botão de Excluir Grande e Seguro para Mobile */}
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      disabled={isOffline}
                      className="h-12 w-12 shrink-0 rounded-xl text-destructive hover:bg-destructive/10 bg-destructive/5 sm:bg-transparent sm:opacity-0 group-hover:opacity-100 transition-all self-end" 
                      onClick={() => removeSchedule(i)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Horários */}
                  <div className="flex items-center gap-4">
                    <div className="space-y-1.5 w-full">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Início</Label>
                      <Input 
                        type="time" 
                        disabled={isOffline} 
                        className="h-12 rounded-xl bg-muted/20 border-border font-bold w-full focus:ring-primary/20 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" 
                        value={s.start_time} 
                        onChange={(e) => updateSchedule(i, "start_time", e.target.value)} 
                      />
                    </div>
                    <div className="space-y-1.5 w-full">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Fim</Label>
                      <Input 
                        type="time" 
                        disabled={isOffline} 
                        className="h-12 rounded-xl bg-muted/20 border-border font-bold w-full focus:ring-primary/20 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" 
                        value={s.end_time} 
                        onChange={(e) => updateSchedule(i, "end_time", e.target.value)} 
                      />
                    </div>
                  </div>

                  {/* Sala / Local */}
                  <div className="space-y-1.5">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> Sala / Local
                    </Label>
                    <Input 
                      placeholder="Ex: Laboratório 3, Bloco A" 
                      disabled={isOffline} 
                      className="h-12 rounded-xl bg-muted/20 border-border font-bold focus:ring-primary/20" 
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

      {/* Botão de Salvar Global */}
      <div className="flex flex-col items-center gap-4 pt-6 pb-2">
        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-4 py-2 rounded-full">
          <Bell className="h-3 w-3 text-primary" />
          Alterações geram notificações para a equipe
        </div>
        <Button 
          onClick={save} 
          disabled={saving || isOffline} 
          className="w-full sm:w-auto sm:min-w-[300px] h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform"
        >
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
