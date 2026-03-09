import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent } from "@/components/ui/card";
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
  Volume2, CheckCircle2, Trash2, AlertTriangle
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

  // Motor Cronológico
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");

  // Notificações Inteligentes
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
      const { data } = await supabase
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
        setNotifyVolume(data.notification_volume?.toString() ?? "3");
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
      notification_volume: parseInt(notifyVolume),
      notification_frequency: notifyFrequency,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", user.id);

      if (error) throw error;
      toast({ title: "Sistema Atualizado", description: "Suas preferências globais foram salvas." });
    } catch (e: any) {
      toast({ title: "Falha na sincronização", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "EXCLUIR") return;
    setDeleting(true);
    
    try {
      // 1. Limpeza Ativa: Força a deleção dos dados relacionais caso o banco não tenha cascade
      await Promise.all([
        supabase.from("disciplines").delete().eq("user_id", user!.id),
        supabase.from("reminders").delete().eq("user_id", user!.id),
      ]);
      
      // 2. Deleta o perfil
      await supabase.from("profiles").delete().eq("user_id", user!.id);
      
      // 3. O usuário em si (tabela auth) muitas vezes precisa de uma RPC/Edge Function 
      // ou intervenção do admin para apagar por completo. O SignOut é garantido:
      await supabase.auth.signOut();
      
      toast({ 
        title: "Acesso Encerrado", 
        description: "Sua conta e dados foram removidos da plataforma." 
      });
      
      navigate("/auth");
    } catch (e: any) {
      toast({ title: "Erro na exclusão", description: "Falha ao limpar seus dados: " + e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando Sistema...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* Modal Danger Zone (Exclusão) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] bg-card border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-destructive text-left">
                Destruição Total
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-muted-foreground text-left text-sm leading-relaxed">
              Esta ação é <strong className="text-destructive">permanente e irreversível</strong>. Todo o seu histórico, anotações, notas e acessos serão apagados dos nossos servidores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Para prosseguir, digite <strong className="text-foreground">EXCLUIR</strong>
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="EXCLUIR"
              className="h-14 rounded-2xl text-center font-black text-xl tracking-widest border-destructive/30 bg-destructive/5 text-destructive focus:ring-destructive/40 transition-colors"
            />
          </div>
          
          <AlertDialogFooter className="gap-3 sm:gap-0 mt-2">
            <AlertDialogCancel className="h-14 sm:h-12 rounded-2xl border-none font-bold uppercase text-[10px] tracking-widest bg-muted/50 hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "EXCLUIR" || deleting}
              className="h-14 sm:h-12 rounded-2xl bg-destructive text-white font-black uppercase text-[10px] tracking-widest hover:bg-destructive/90 active:scale-95 transition-all"
            >
              {deleting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Apagar Meus Dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Responsivo */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 hover:bg-muted border border-border/40 shrink-0 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter truncate">Ajustes <span className="text-primary">Globais</span></h1>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">Controle de motor, estética e alertas</p>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="h-14 sm:h-16 px-8 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all w-full md:w-auto"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> Salvar Sistema</>}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Coluna 1: Notificações & Alertas */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <BellRing className="h-4 w-4 text-emerald-500" /> Canais & Frequência
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 space-y-6 shadow-xl">
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-5 bg-background rounded-2xl border border-border/50 shadow-sm transition-colors hover:bg-muted/10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Push Mobile</span>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} className="data-[state=checked]:bg-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-5 bg-background rounded-2xl border border-border/50 shadow-sm transition-colors hover:bg-muted/10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">E-mail Semanal</span>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Janela de Disponibilidade</Label>
              <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-[20px] border border-border/40">
                <Input type="time" value={notifyStart} onChange={e => setNotifyStart(e.target.value)} className="h-12 border-none bg-transparent font-black shadow-none focus-visible:ring-0" />
                <div className="h-8 w-px bg-border/50" />
                <Input type="time" value={notifyEnd} onChange={e => setNotifyEnd(e.target.value)} className="h-12 border-none bg-transparent font-black shadow-none focus-visible:ring-0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Volume Diário</Label>
                <div className="relative">
                  <Input type="number" min="0" max="20" value={notifyVolume} onChange={e => setNotifyVolume(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black text-center pl-10" />
                  <Volume2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Recorrência</Label>
                <Select value={notifyFrequency} onValueChange={setNotifyFrequency}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border shadow-2xl rounded-2xl">
                    <SelectItem value="daily" className="font-bold py-3 uppercase text-[10px] tracking-widest">Diário</SelectItem>
                    <SelectItem value="weekly" className="font-bold py-3 uppercase text-[10px] tracking-widest">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </section>

        {/* Coluna 2: Interface e Cronologia */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <Palette className="h-4 w-4 text-primary" /> Visual & Identidade
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 space-y-6 shadow-xl">
            
            <div className="flex items-center justify-between p-5 bg-background rounded-2xl border border-border/50 transition-colors hover:bg-muted/10 cursor-pointer" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
              <div className="flex items-center gap-4">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-colors", mode === 'dark' ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500")}>
                  {mode === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Esquema de Cores</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{mode === 'dark' ? 'Modo Noturno' : 'Modo Claro'}</p>
                </div>
              </div>
              <Switch checked={mode === 'dark'} onCheckedChange={c => setMode(c ? 'dark' : 'light')} className="pointer-events-none" />
            </div>

            {/* Popover da Paleta */}
            <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-4">
                <div 
                  className="h-10 w-10 rounded-xl shadow-inner border border-black/10 dark:border-white/10" 
                  style={{ backgroundColor: `hsl(${primaryColor.hue}, ${primaryColor.saturation}%, ${primaryColor.lightness}%)` }} 
                />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-primary">Cor Principal</p>
                  <p className="text-[10px] font-bold text-muted-foreground capitalize mt-0.5">{primaryColor.label}</p>
                </div>
              </div>
              <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-primary/20 bg-background hover:bg-primary/10 transition-colors">
                    <Palette className="h-5 w-5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-5 bg-popover border-border shadow-2xl rounded-[24px]" align="end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 text-center">Defina sua Identidade</p>
                  <div className="grid grid-cols-5 gap-3">
                    {availableColors.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          setPrimaryColor(c);
                          setColorPopoverOpen(false);
                        }}
                        className={cn(
                          "h-12 w-12 rounded-2xl transition-all active:scale-90 flex items-center justify-center shadow-sm",
                          primaryColor.label === c.label ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: `hsl(${c.hue}, ${c.saturation}%, ${c.lightness}%)` }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* Setup do Motor de Semestre */}
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2 pt-4">
            <Calendar className="h-4 w-4 text-amber-500" /> Cronologia Letiva
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início das Aulas</Label>
                <Input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black px-4 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Término Previsto</Label>
                <Input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black px-4 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>
            <div className="p-4 sm:p-5 rounded-[20px] bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
              <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest leading-relaxed">
                As datas acima calibram o motor de cálculo da barra de progresso no painel principal.
              </p>
            </div>
          </Card>
        </section>
      </div>

      {/* Danger Zone Separada */}
      <section className="space-y-6 pt-10 border-t border-border/40">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Zona de Risco
        </h3>
        <Card className="rounded-[32px] border-destructive/20 bg-destructive/5 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <p className="text-base sm:text-lg font-black text-destructive">Destruir Conta Permanentemente</p>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground leading-relaxed max-w-lg">
                Remova sua presença digital, grade curricular e arquivos associados. O encerramento não permite recuperação posterior.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-destructive/20 shrink-0 w-full sm:w-auto active:scale-95 transition-transform"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Definitivo
            </Button>
          </div>
        </Card>
      </section>

    </div>
  );
}
