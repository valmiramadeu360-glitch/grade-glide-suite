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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Loader2, Calendar, Palette, Moon, 
  Sun, BellRing, Mail, Smartphone, ArrowLeft,
  Clock, Volume2, Repeat, CheckCircle2, ShieldCheck,
  Trash2, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { mode, setMode, primaryColor, setPrimaryColor, availableColors } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);

  // Danger Zone
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // 1. Motor Cronológico (Dashboard Progress)
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");

  // 2. Notificações Inteligentes
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifyStart, setNotifyStart] = useState("09:00");
  const [notifyEnd, setNotifyEnd] = useState("18:00");
  const [notifyVolume, setNotifyVolume] = useState("3");
  const [notifyFrequency, setNotifyFrequency] = useState("daily");

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (data) {
        setProfileId(data.id);
        setSemesterStart(data.semester_start ?? "");
        setSemesterEnd(data.semester_end ?? "");
        setPushEnabled(data.notification_push ?? true);
        setEmailEnabled(data.notification_email ?? true);
        setNotifyStart(data.notification_start_time ?? "09:00");
        setNotifyEnd(data.notification_end_time ?? "18:00");
        setNotifyVolume("3");
        setNotifyFrequency(data.notification_frequency ?? "daily");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const payload = {
      semester_start: semesterStart || null,
      semester_end: semesterEnd || null,
      notification_push: pushEnabled,
      notification_email: emailEnabled,
      notification_start_time: notifyStart,
      notification_end_time: notifyEnd,
      notification_frequency: notifyFrequency,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", user.id);

      if (error) throw error;
      toast({ title: "Configurações Sincronizadas", description: "O motor do EduFlow foi atualizado." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "EXCLUIR") return;
    setDeleting(true);
    
    try {
      // Deleta todas as disciplinas do usuário (cascade automático nos relacionamentos)
      await supabase.from("disciplines").delete().eq("user_id", user!.id);
      await supabase.from("reminders").delete().eq("user_id", user!.id);
      await supabase.from("profiles").delete().eq("user_id", user!.id);
      
      // Faz logout
      await supabase.auth.signOut();
      
      toast({ 
        title: "Conta Excluída", 
        description: "Todos os seus dados foram removidos permanentemente." 
      });
      
      navigate("/auth");
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Carregando Preferências...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-safe px-4 sm:px-6 overflow-x-hidden">
      
      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-[32px] bg-card border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-2xl font-black tracking-tight text-destructive">
                Excluir Conta Permanentemente
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-muted-foreground pt-4">
              Esta ação é <strong className="text-destructive">irreversível</strong>. Todos os seus dados, disciplinas, 
              anotações e lembretes serão apagados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Digite "EXCLUIR" para confirmar
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="EXCLUIR"
              className="h-14 rounded-2xl text-center font-black text-lg border-destructive/20 bg-destructive/5"
            />
          </div>
          
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-none font-bold uppercase text-[10px] tracking-widest">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "EXCLUIR" || deleting}
              className="h-12 rounded-2xl bg-destructive text-destructive-foreground font-black uppercase text-[10px] tracking-widest hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 1. Header BI-Style com Ação Global */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-12 w-12 rounded-xl bg-card border border-border/40 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-black tracking-tighter">Ajustes <span className="text-primary">Globais</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Controle de motor, estética e alertas</p>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="h-14 px-10 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Alterações
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Coluna: Notificações Inteligentes */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <BellRing className="h-4 w-4 text-emerald-500" /> Canais & Frequência
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 space-y-8 shadow-xl">
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/40">
                <div className="flex items-center gap-4">
                  <Smartphone className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Push (Celular)</span>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/40">
                <div className="flex items-center gap-4">
                  <Mail className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest">E-mail Semanal</span>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Janela de Disponibilidade</Label>
              <div className="flex items-center gap-3">
                <Input type="time" value={notifyStart} onChange={e => setNotifyStart(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" />
                <span className="text-xs font-black opacity-20">ATÉ</span>
                <Input type="time" value={notifyEnd} onChange={e => setNotifyEnd(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Volume Diário</Label>
                <div className="relative">
                  <Input type="number" value={notifyVolume} onChange={e => setNotifyVolume(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/40 font-black text-center" />
                  <Volume2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Recorrência</Label>
                <Select value={notifyFrequency} onValueChange={setNotifyFrequency}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/40 font-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-2xl rounded-2xl">
                    <SelectItem value="daily" className="font-bold py-3 uppercase text-[10px] tracking-widest">Diário</SelectItem>
                    <SelectItem value="weekly" className="font-bold py-3 uppercase text-[10px] tracking-widest">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </section>

        {/* Coluna: Estética & Tema */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <Palette className="h-4 w-4 text-primary" /> Visual & Dashboard
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 space-y-8 shadow-xl">
            
            <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-4">
                {mode === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Esquema de Cores</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Modo {mode === 'dark' ? 'Noturno' : 'Claro'}</p>
                </div>
              </div>
              <Switch checked={mode === 'dark'} onCheckedChange={c => setMode(c ? 'dark' : 'light')} />
            </div>

            {/* Paleta de Cores Compacta */}
            <div className="flex items-center justify-between p-5 bg-muted/10 rounded-2xl border border-border/40">
              <div className="flex items-center gap-4">
                <div 
                  className="h-10 w-10 rounded-xl shadow-lg" 
                  style={{ backgroundColor: `hsl(${primaryColor.hue}, ${primaryColor.saturation}%, ${primaryColor.lightness}%)` }} 
                />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Cor Principal</p>
                  <p className="text-[10px] font-bold text-muted-foreground capitalize">{primaryColor.label}</p>
                </div>
              </div>
              <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-border/40">
                    <Palette className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-card border-border shadow-2xl rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Paleta</p>
                  <div className="grid grid-cols-5 gap-2">
                    {availableColors.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          setPrimaryColor(c);
                          setColorPopoverOpen(false);
                        }}
                        className={cn(
                          "h-10 w-10 rounded-xl transition-all active:scale-90",
                          primaryColor.label === c.label ? "ring-2 ring-foreground ring-offset-2 scale-110 shadow-lg" : "hover:scale-105"
                        )}
                        style={{ backgroundColor: `hsl(${c.hue}, ${c.saturation}%, ${c.lightness}%)` }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* Cronologia do Período */}
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2 pt-4">
            <Calendar className="h-4 w-4 text-amber-500" /> Cronologia Letiva
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 space-y-6 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início das Aulas</Label>
                <Input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/40 font-black cursor-pointer" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Término Previsto</Label>
                <Input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/40 font-black cursor-pointer" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest leading-relaxed">
                Estas datas alimentam o indicador de progresso do seu Dashboard principal.
              </p>
            </div>
          </Card>
        </section>
      </div>

      {/* Danger Zone */}
      <section className="space-y-6 pt-8">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Zona de Perigo
        </h3>
        <Card className="rounded-[32px] border-destructive/20 bg-destructive/5 p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-sm font-black text-destructive">Excluir Conta Permanentemente</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-md">
                Esta ação apagará todos os seus dados, disciplinas, anotações e lembretes. Esta ação não pode ser desfeita.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-destructive/20 shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Conta
            </Button>
          </div>
        </Card>
      </section>

      <div className="pb-24" />
    </div>
  );
}
