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
import { ArrowLeft, User, Camera, Loader2, Cloud, Link2, GraduationCap, Target, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
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

    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("materials").getPublicUrl(path);
    const url = urlData.publicUrl;

    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    toast({ title: "Foto atualizada!" });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="min-h-14 min-w-14 h-14 w-14 rounded-full hover:bg-muted shrink-0"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-foreground tracking-tight">Perfil Acadêmico</h1>
          <p className="text-muted-foreground font-medium text-sm">Sua identidade no EduFlow</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
          {autoSaveStatus === "saving" ? (
            <span className="flex items-center gap-1 text-primary animate-pulse"><Cloud className="h-3 w-3" /> Salvando...</span>
          ) : autoSaveStatus === "saved" ? (
            <span className="flex items-center gap-1 text-emerald-500"><Cloud className="h-3 w-3" /> Salvo</span>
          ) : null}
        </div>
      </div>

      {/* Avatar */}
      <Card className="glass-card border-none shadow-md overflow-hidden bg-card rounded-[32px]">
        <CardContent className="flex flex-col items-center py-10 gap-4">
          <div className="relative group">
            <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-xl">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-black">
                {fullName ? fullName[0].toUpperCase() : <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </label>
          </div>
          <div className="text-center">
            <p className="font-black text-xl text-foreground">{fullName || "Estudante"}</p>
            <p className="text-xs text-muted-foreground font-medium">
              {university && course ? `${course} · ${university}` : "Configure seu perfil abaixo"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="grid gap-6">
        <Card className="glass-card border-none shadow-md overflow-hidden bg-card rounded-[32px]">
          <div className="h-1 w-full bg-primary/40" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
              <Input value={fullName} onChange={handleChange(setFullName, "full_name")} placeholder="Seu nome" className="h-11 bg-muted/30 focus:bg-background" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" /> Universidade
                </Label>
                <Input value={university} onChange={handleChange(setUniversity, "university")} placeholder="Ex: UFMG" className="h-11 bg-muted/30 focus:bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Curso</Label>
                <Input value={course} onChange={handleChange(setCourse, "course")} placeholder="Ex: Direito" className="h-11 bg-muted/30 focus:bg-background" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none shadow-md overflow-hidden bg-card rounded-[32px]">
          <div className="h-1 w-full bg-amber-500/40" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" /> Sobre Você
            </CardTitle>
            <CardDescription className="text-xs">Compartilhe seus objetivos e aspirações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Biografia</Label>
              <Textarea value={bio} onChange={handleChange(setBio, "bio")} placeholder="Conte um pouco sobre você..." className="min-h-[100px] bg-muted/30 focus:bg-background resize-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carreira Almejada / Área de Pesquisa</Label>
              <Input value={careerGoal} onChange={handleChange(setCareerGoal, "career_goal")} placeholder="Ex: Advocacia Trabalhista, Pesquisa em Biotecnologia" className="h-11 bg-muted/30 focus:bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Planos de Estudo
              </Label>
              <Textarea value={studyPlans} onChange={handleChange(setStudyPlans, "study_plans")} placeholder="Seus objetivos de aprendizado para este semestre..." className="min-h-[80px] bg-muted/30 focus:bg-background resize-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Currículo Lattes ou Portfólio
              </Label>
              <Input value={portfolioUrl} onChange={handleChange(setPortfolioUrl, "portfolio_url")} placeholder="https://lattes.cnpq.br/..." className="h-11 bg-muted/30 focus:bg-background" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
