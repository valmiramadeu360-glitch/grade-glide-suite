import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Loader2, Calendar, Palette, Moon, 
  Sun, BellRing, Mail, Smartphone, ArrowLeft,
  Volume2, Trash2, AlertTriangle, Settings2, FileText, Shield
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSemesterStart(data.semester_start || "");
        setSemesterEnd(data.semester_end || "");
        
        setPushEnabled(data.notification_push ?? true);
        setEmailEnabled(data.notification_email ?? true);
        setNotifyStart(data.notification_start_time || "09:00");
        setNotifyEnd(data.notification_end_time || "18:00");
        setNotifyVolume(data.notification_volume?.toString() || "3");
        setNotifyFrequency(data.notification_frequency || "daily");
      }
    } catch (err) {
      console.error("Erro ao carregar configurações", err);
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
      
      toast({ title: "Sistema Atualizado", description: "Suas preferências globais foram salvas com sucesso." });
    } catch (e: any) {
      console.error("Erro no Update:", e);
      toast({ 
        title: "Falha na sincronização", 
        description: "Não foi possível salvar os dados. Verifique a estrutura do banco.", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "EXCLUIR") return;
    setDeleting(true);
    
    try {
      await Promise.all([
        supabase.from("disciplines").delete().eq("user_id", user!.id),
        supabase.from("reminders").delete().eq("user_id", user!.id),
      ]);
      
      const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", user!.id);
      if (profileError) throw profileError;

      await supabase.auth.signOut();
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-700 pb-32 px-4 sm:px-6 pt-6 overflow-x-hidden">
      
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

      {/* Header Fixo (Responsivo) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 rounded-2xl bg-muted/30 border border-border/40 shrink-0">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              Ajustes <Settings2 className="h-7 w-7 text-primary" />
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Configurações Gerais do App</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="h-14 px-8 rounded-[20px] font-black uppercase text-xs tracking-widest bg-primary text-white shadow-xl shadow-primary/20 hidden sm:flex hover:-translate-y-0.5 active:scale-95 transition-all">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
        </Button>
      </header>

      {/* ESTRUTURA DE ACORDEÃO (Estilo Configurações de Celular) */}
      <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="visual">
        
        {/* BLOCO 1: VISUAL & TEMA */}
        <AccordionItem value="visual" className="border border-border/40 bg-card rounded-[32px] px-2 shadow-sm data-[state=open]:shadow-md transition-all">
          <AccordionTrigger className="hover:no-underline py-5 px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-base sm:text-lg font-black text-foreground">Visual & Interface</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Modo Noturno e Cores</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border/50 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
                <div className="flex items-center gap-4">
                  {mode === 'dark' ? <Moon className="h-6 w-6 text-primary" /> : <Sun className="h-6 w-6 text-amber-500" />}
                  <span className="font-bold text-sm">Modo Escuro</span>
                </div>
                <Switch checked={mode === 'dark'} className="pointer-events-none data-[state=checked]:bg-primary" />
              </div>
              
              <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border/50 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-6 w-6 rounded-full shadow-inner border border-black/10 dark:border-white/10" style={{ backgroundColor: `hsl(${primaryColor.hue}, ${primaryColor.saturation}%, ${primaryColor.lightness}%)` }} />
                      <span className="font-bold text-sm">Cor do Sistema</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Alterar</span>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 rounded-[24px] border-border shadow-2xl">
                  <div className="grid grid-cols-5 gap-2">
                    {availableColors.map(c => (
                      <button
                        key={c.label}
                        onClick={() => { setPrimaryColor(c); setColorPopoverOpen(false); }}
                        className={cn(
                          "h-10 w-10 rounded-full shadow-sm transition-all", 
                          primaryColor.label === c.label ? "ring-2 ring-offset-2 ring-foreground scale-110" : "opacity-80 hover:opacity-100 hover:scale-105"
                        )}
                        style={{ backgroundColor: `hsl(${c.hue}, ${c.saturation}%, ${c.lightness}%)` }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* BLOCO 2: NOTIFICAÇÕES */}
        <AccordionItem value="notifications" className="border border-border/40 bg-card rounded-[32px] px-2 shadow-sm data-[state=open]:shadow-md transition-all">
          <AccordionTrigger className="hover:no-underline py-5 px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <BellRing className="h-6 w-6 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="text-base sm:text-lg font-black text-foreground">Alertas & Notificações</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Sinos, E-mails e Frequência</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-6 pt-2 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border/50 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-emerald-500"/>
                    <span className="font-bold text-sm">Avisos no App</span>
                  </div>
                  <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} className="data-[state=checked]:bg-emerald-500" />
               </div>
               <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border/50 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary"/>
                    <span className="font-bold text-sm">Resumo no E-mail</span>
                  </div>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} className="data-[state=checked]:bg-primary" />
               </div>
            </div>
            
            <div className="bg-muted/20 p-5 rounded-2xl border border-border/50">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">Período de Alertas (Não Perturbe fora desse horário)</Label>
              <div className="flex items-center gap-4">
                <Input type="time" value={notifyStart} onChange={e => setNotifyStart(e.target.value)} className="h-12 bg-background font-bold text-center border-border/40 focus:ring-primary/30" />
                <span className="text-xs font-bold text-muted-foreground">Até</span>
                <Input type="time" value={notifyEnd} onChange={e => setNotifyEnd(e.target.value)} className="h-12 bg-background font-bold text-center border-border/40 focus:ring-primary/30" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Volume Diário</Label>
                <div className="relative">
                  <Input type="number" min="0" max="20" value={notifyVolume} onChange={e => setNotifyVolume(e.target.value)} className="h-12 rounded-xl bg-background border-border/50 font-black text-center pl-10 focus:ring-primary/30" />
                  <Volume2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Frequência</Label>
                <Select value={notifyFrequency} onValueChange={setNotifyFrequency}>
                  <SelectTrigger className="h-12 rounded-xl bg-background border-border/50 font-bold px-4 focus:ring-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border shadow-2xl rounded-2xl">
                    <SelectItem value="daily" className="font-bold py-3 uppercase text-[10px] tracking-widest">Diário</SelectItem>
                    <SelectItem value="weekly" className="font-bold py-3 uppercase text-[10px] tracking-widest">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* BLOCO 3: CRONOGRAMA LETIVO */}
        <AccordionItem value="calendar" className="border border-border/40 bg-card rounded-[32px] px-2 shadow-sm data-[state=open]:shadow-md transition-all">
          <AccordionTrigger className="hover:no-underline py-5 px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-base sm:text-lg font-black text-foreground">Cronologia Letiva</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Datas do Semestre Atual</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-6 pt-2 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início das Aulas</Label>
                <Input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black px-4 focus:ring-primary/30 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Término Previsto</Label>
                <Input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-black px-4 focus:ring-primary/30 [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest leading-relaxed">
                As datas definem o cálculo automático da barra de progresso no seu painel principal (Dashboard).
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* BLOCO 4: TERMOS E CONDIÇÕES */}
        <AccordionItem value="terms" className="border border-border/40 bg-card rounded-[32px] px-2 shadow-sm data-[state=open]:shadow-md transition-all">
          <AccordionTrigger className="hover:no-underline py-5 px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="text-left">
                <p className="text-base sm:text-lg font-black text-foreground">Termos & Políticas</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Diretrizes de Uso do App</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-6 pt-2">
            <div className="bg-muted/20 border border-border/50 rounded-[20px] p-5 h-56 overflow-y-auto custom-scrollbar space-y-4 shadow-inner">
              
              <div>
                <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> 1. Propósito do EduFlow
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 font-medium">O EduFlow é um ecossistema de gestão acadêmica projetado para auxiliar estudantes na organização de disciplinas, prazos e materiais. A rede social "Connect" destina-se exclusivamente ao networking educacional construtivo.</p>
              </div>

              <div className="w-full h-px bg-border/50" />
              
              <div>
                <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> 2. Moderação e Respeito
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 font-medium">O ambiente deve ser seguro. Publicações ofensivas, de ódio, spam ou que violem leis serão sumariamente removidas. Os administradores do EduFlow reservam-se o direito de banir definitivamente contas que quebrarem as diretrizes de convivência acadêmica.</p>
              </div>

              <div className="w-full h-px bg-border/50" />
              
              <div>
                <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Save className="h-4 w-4 text-emerald-500" /> 3. Tratamento de Dados
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 font-medium">Seus resumos, anotações privadas e arquivos na biblioteca são criptografados e armazenados com segurança. Nós não vendemos ou compartilhamos seus dados acadêmicos com terceiros. Você tem o direito de solicitar a exclusão total da sua conta e dados a qualquer momento na aba "Segurança".</p>
              </div>

            </div>
            <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] mt-4 text-muted-foreground/60">
              EduFlow Academy v2.0 - Desenvolvido no Brasil.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* BLOCO 5: ZONA DE RISCO (EXCLUSÃO) */}
        <AccordionItem value="danger" className="border border-destructive/20 bg-destructive/5 rounded-[32px] px-2 transition-all hover:bg-destructive/10">
          <AccordionTrigger className="hover:no-underline py-5 px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-destructive" />
              </div>
              <div className="text-left">
                <p className="text-base sm:text-lg font-black text-destructive">Conta & Segurança</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-destructive/70 mt-1">Exclusão de Dados</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-6 pt-2">
             <Card className="border-destructive/20 shadow-none bg-card">
               <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-foreground">Deletar minha conta</p>
                    <p className="text-xs font-bold text-muted-foreground max-w-sm">Apaga todo o seu histórico, anotações e retira seu acesso à plataforma EduFlow.</p>
                  </div>
                  <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest w-full sm:w-auto shadow-lg shadow-destructive/20">
                    Apagar Conta
                  </Button>
               </CardContent>
             </Card>
          </AccordionContent>
        </AccordionItem>

      </Accordion>

      {/* Botão de Salvar Flutuante no Mobile */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/40 sm:hidden z-40">
         <Button onClick={handleSave} disabled={saving} className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest bg-primary text-white shadow-xl shadow-primary/20 active:scale-95 transition-all">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
        </Button>
      </div>

    </div>
  );
}
