import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Camera, Loader2, Cloud, Link2, GraduationCap, Target, BookOpen, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [careerGoal, setCareerGoal] = useState("");
  const [studyPlans, setStudyPlans] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) loadProfile();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setFullName(data.full_name ?? "");
      setBio(data.bio ?? "");
      setCareerGoal(data.career_goal ?? "");
      setStudyPlans(data.study_plans ?? "");
      setPortfolioUrl(data.portfolio_url ?? "");
      setAvatarUrl(data.avatar_url ?? "");
      setUniversity(data.university ?? "");
      setCourse(data.course ?? "");
    }
    setLoading(false);
  }

  const triggerAutoSave = useCallback((field: string, value: string) => {
    if (!user) return;
    setAutoSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value.trim() || null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (!error) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        setAutoSaveStatus("idle");
      }
    }, 800);
  }, [user]);

  function handleChange(setter: (v: string) => void, field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setter(val);
      triggerAutoSave(field, val);
    };
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    toast({ title: "Atualizando foto...", description: "Aguarde um instante." });

    // Truque mestre: Adicionar Date.now() no nome do arquivo para o navegador não usar o cache antigo
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;

    // Vamos tentar salvar no bucket 'avatars'. Se você não tiver criado, ele tenta no 'materials'
    let bucketName = "avatars";
    let { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });

    if (uploadError) {
      bucketName = "materials"; // Fallback caso o bucket avatars não exista
      const fallbackUpload = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
      uploadError = fallbackUpload.error;
    }

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const url = urlData.publicUrl;

    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    
    setAvatarUrl(url);
    setIsUploading(false);
    toast({ title: "Foto atualizada com sucesso! 📸" });

    // Dispara um evento global para que o Menu inferior (Navigation) saiba que a foto mudou e atualize sozinho!
    window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: url }));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Identidade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
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
              Perfil Acadêmico
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              Sua identidade no EduFlow
            </p>
          </div>
        </div>

        {/* Indicador de Auto-Save Inteligente */}
        <div className="flex items-center justify-end sm:justify-start gap-2 bg-background border border-border/50 px-4 py-2.5 rounded-2xl shadow-sm">
          {autoSaveStatus === "saving" ? (
            <span className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">
              <Cloud className="h-4 w-4" /> Salvando...
            </span>
          ) : autoSaveStatus === "saved" ? (
            <span className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="h-4 w-4" /> Salvo na Nuvem
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
              <Cloud className="h-4 w-4" /> Sincronizado
            </span>
          )}
        </div>
      </div>

      {/* Cartão do Avatar Redesenhado */}
      <Card className="glass-card border-border/50 shadow-xl overflow-hidden bg-card rounded-[32px] relative mt-4">
        <div className="absolute top-0 left-0 w-full h-24 sm:h-32 bg-gradient-to-r from-primary/40 to-primary/10" />
        <CardContent className="flex flex-col items-center pt-12 sm:pt-16 pb-10 gap-5 relative z-10">
          <div className="relative group">
            <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-card shadow-2xl bg-card transition-transform duration-500 group-hover:scale-105">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl sm:text-5xl font-black">
                {fullName ? fullName[0].toUpperCase() : <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
            
            <label className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-xl hover:bg-primary/90 transition-all active:scale-95 border-4 border-card">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 sm:h-6 sm:w-6" />}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={isUploading} />
            </label>
          </div>
          
          <div className="text-center space-y-1 mt-2">
            <p className="font-black text-2xl sm:text-3xl text-foreground tracking-tight">
              {fullName || "Nome não definido"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase tracking-widest">
              {university && course ? `${course} • ${university}` : "Configure seu curso abaixo"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulários de Informação */}
      <div className="grid gap-6 sm:grid-cols-2 items-start">
        {/* Coluna 1: Dados Pessoais */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px]">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground">
              <User className="h-5 w-5 text-primary" /> Dados Institucionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
              <Input value={fullName} onChange={handleChange(setFullName, "full_name")} placeholder="Como você quer ser chamado" className="h-14 bg-background border-border/50 focus:ring-primary/20 rounded-2xl font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Instituição de Ensino
              </Label>
              <Input value={university} onChange={handleChange(setUniversity, "university")} placeholder="Ex: Universidade Federal" className="h-14 bg-background border-border/50 focus:ring-primary/20 rounded-2xl font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Curso Acadêmico</Label>
              <Input value={course} onChange={handleChange(setCourse, "course")} placeholder="Ex: Medicina, Direito, Engenharia" className="h-14 bg-background border-border/50 focus:ring-primary/20 rounded-2xl font-bold" />
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2: Metas e Links */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px]">
          <div className="h-2 w-full bg-amber-500" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground">
              <Target className="h-5 w-5 text-amber-500" /> Metas & Carreira
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Carreira Almejada / Foco</Label>
              <Input value={careerGoal} onChange={handleChange(setCareerGoal, "career_goal")} placeholder="Ex: Pesquisador, Auditor, Cirurgião" className="h-14 bg-background border-border/50 focus:ring-primary/20 rounded-2xl font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Link do Currículo Lattes
              </Label>
              <Input value={portfolioUrl} onChange={handleChange(setPortfolioUrl, "portfolio_url")} placeholder="https://lattes.cnpq.br/..." className="h-14 bg-background border-border/50 focus:ring-primary/20 rounded-2xl font-bold text-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Planos de Estudo do Semestre
              </Label>
              <Textarea value={studyPlans} onChange={handleChange(setStudyPlans, "study_plans")} placeholder="Quais são as suas metas acadêmicas atuais?" className="min-h-[120px] bg-background border-border/50 focus:ring-primary/20 resize-none rounded-2xl font-medium p-4" />
            </div>
          </CardContent>
        </Card>

        {/* Bio (Ocupa as duas colunas em telas maiores) */}
        <Card className="glass-card border-border/50 shadow-lg overflow-hidden bg-card rounded-[32px] sm:col-span-2">
          <CardContent className="pt-8 px-6 sm:px-8 pb-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Biografia Pessoal</Label>
              <Textarea value={bio} onChange={handleChange(setBio, "bio")} placeholder="Escreva um breve resumo sobre a sua jornada profissional e acadêmica..." className="min-h-[140px] bg-background border-border/50 focus:ring-primary/20 resize-none rounded-2xl font-medium p-4 text-base" />
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
