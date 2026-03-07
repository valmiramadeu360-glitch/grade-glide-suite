import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Calendar, Palette, Moon, Sun, BellRing, Mail, Smartphone, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { mode, setMode, primaryColor, setPrimaryColor, availableColors } = useTheme();
  
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Estados de Notificação (Configurações Inteligentes)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifyStart, setNotifyStart] = useState("09:00");
  const [notifyEnd, setNotifyEnd] = useState("18:00");
  const [notifyVolume, setNotifyVolume] = useState("3");
  const [notifyFrequency, setNotifyFrequency] = useState("daily");

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user?.id).maybeSingle();
      if (data) {
        setProfileId(data.id);
        setSemesterStart(data.semester_start ?? "");
        setSemesterEnd(data.semester_end ?? "");
        
        // Carrega prefs de notificação (Se não existirem no DB, usa os defaults do useState)
        if (data.notify_push !== undefined) setPushEnabled(data.notify_push);
        if (data.notify_email !== undefined) setEmailEnabled(data.notify_email);
        if (data.notify_time_start) setNotifyStart(data.notify_time_start);
        if (data.notify_time_end) setNotifyEnd(data.notify_time_end);
        if (data.notify_volume) setNotifyVolume(data.notify_volume.toString());
        if (data.notify_frequency) setNotifyFrequency(data.notify_frequency);
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!user) return;
    setSaving(true);
    try {
      const profileData = {
        semester_start: semesterStart || null,
        semester_end: semesterEnd || null,
        notify_push: pushEnabled,
        notify_email: emailEnabled,
        notify_time_start: notifyStart,
        notify_time_end: notifyEnd,
        notify_volume: parseInt(notifyVolume) || 3,
        notify_frequency: notifyFrequency,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (profileId) {
        ({ error } = await supabase.from("profiles").update(profileData).eq("id", profileId));
      } else {
        const res = await supabase.from("profiles").insert({ ...profileData, user_id: user.id }).select().single();
        error = res.error;
        if (res.data) setProfileId(res.data.id);
      }

      if (error) throw error;
      toast({ title: "Configurações salvas! ⚙️", description: "Suas preferências foram aplicadas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Tratativa PWA (Pedir permissão de Push Notification)
  async function handlePushToggle(checked: boolean) {
    if (checked && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setPushEnabled(true);
        toast({ title: "Notificações Ativadas!", description: "Você receberá alertas no seu celular." });
      } else {
        setPushEnabled(false);
        toast({ title: "Permissão Negada", description: "Habilite as notificações nas configurações do seu navegador/celular.", variant: "destructive" });
      }
    } else {
      setPushEnabled(checked);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando Preferências...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-700 pb-32 px-4 sm:px-6">
      
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6">
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
              Configurações
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              Preferências do Aplicativo
            </p>
          </div>
        </div>

        {/* Botão de salvar no Topo para não precisar rolar até o fim */}
        <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto shadow-xl shadow-primary/20 font-black uppercase text-[10px] sm:text-xs tracking-widest h-14 px-8 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6">

        {/* Módulo de Notificações Inteligentes */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px]">
          <div className="h-2 w-full bg-emerald-500" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground">
              <BellRing className="h-5 w-5 text-emerald-500" /> Alertas & Lembretes
            </CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Como e quando o EduFlow deve contatar você.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 sm:px-8 pb-8">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Push Switch */}
              <div className="flex items-center justify-between p-5 bg-background border border-border/50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Smartphone className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">Push Celular</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Alertas na tela</p>
                  </div>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={handlePushToggle} className="data-[state=checked]:bg-emerald-500" />
              </div>

              {/* Email Switch */}
              <div className="flex items-center justify-between p-5 bg-background border border-border/50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">E-mails</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Resumo de Tarefas</p>
                  </div>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} className="data-[state=checked]:bg-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Janela de Tempo (Início - Fim)</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={notifyStart} onChange={(e) => setNotifyStart(e.target.value)} className="h-14 bg-background border-border/50 focus:ring-emerald-500/20 rounded-2xl font-bold [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
                  <span className="text-muted-foreground font-black">às</span>
                  <Input type="time" value={notifyEnd} onChange={(e) => setNotifyEnd(e.target.value)} className="h-14 bg-background border-border/50 focus:ring-emerald-500/20 rounded-2xl font-bold [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Volume Diário</Label>
                  <Input type="number" min="1" max="20" value={notifyVolume} onChange={(e) => setNotifyVolume(e.target.value)} className="h-14 bg-background border-border/50 focus:ring-emerald-500/20 rounded-2xl font-bold text-center" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Frequência</Label>
                  <Select value={notifyFrequency} onValueChange={setNotifyFrequency}>
                    <SelectTrigger className="h-14 rounded-2xl bg-background border border-border/50 font-bold text-foreground focus:ring-emerald-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-popover border border-border shadow-xl">
                      <SelectItem value="daily" className="py-3 font-medium">Diário</SelectItem>
                      <SelectItem value="weekly" className="py-3 font-medium">Semanal</SelectItem>
                      <SelectItem value="monthly" className="py-3 font-medium">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Theme Card */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px]">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground">
              <Palette className="h-5 w-5 text-primary" /> Aparência e Tema
            </CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Personalize as cores e o modo de visualização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 sm:px-8 pb-8">
            {/* Dark mode toggle */}
            <div className="flex items-center justify-between p-5 bg-background border border-border/50 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {mode === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-amber-500" />}
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">{mode === "dark" ? "Modo Escuro Ativo" : "Modo Claro Ativo"}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Alterne para reduzir o cansaço visual</p>
                </div>
              </div>
              <Switch checked={mode === "dark"} onCheckedChange={(checked) => setMode(checked ? "dark" : "light")} className="data-[state=checked]:bg-primary" />
            </div>

            {/* Color picker */}
            <div className="space-y-3 p-5 bg-background border border-border/50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cor Primária do App</Label>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{primaryColor.label}</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {availableColors.map((c) => {
                  const isSelected = primaryColor.label === c.label;
                  return (
                    <button
                      key={c.label}
                      title={c.label}
                      onClick={() => setPrimaryColor(c)}
                      className={cn(
                        "h-10 w-full sm:w-10 rounded-xl transition-all shadow-sm border-2",
                        isSelected ? "border-foreground ring-2 ring-offset-2 ring-offset-background scale-110 shadow-md" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: `hsl(${c.hue}, ${c.saturation}%, ${c.lightness}%)` }}
                      type="button"
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Semester Period Card (Motor da Barra de Progresso) */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px]">
          <div className="h-2 w-full bg-amber-500" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground">
              <Calendar className="h-5 w-5 text-amber-500" /> Cronologia do Semestre
            </CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Controla a barra de progresso no Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data de Início das Aulas</Label>
                <Input type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} className="h-14 bg-background border-border/50 focus:ring-amber-500/20 rounded-2xl font-bold cursor-pointer [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data de Término (Férias)</Label>
                <Input type="date" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} className="h-14 bg-background border-border/50 focus:ring-amber-500/20 rounded-2xl font-bold cursor-pointer [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
