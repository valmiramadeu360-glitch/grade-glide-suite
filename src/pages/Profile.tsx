import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, User, Camera, Loader2, Cloud, 
  Link2, GraduationCap, Target, BookOpen, 
  CheckCircle2, Globe, ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileData, setProfileData] = useState({
    full_name: "",
    bio: "",
    career_goal: "",
    study_plans: "",
    portfolio_url: "",
    university: "",
    course: ""
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) loadProfile();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [user]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (data) {
        setProfileData({
          full_name: data.full_name ?? "",
          bio: data.bio ?? "",
          career_goal: data.career_goal ?? "",
          study_plans: data.study_plans ?? "",
          portfolio_url: data.portfolio_url ?? "",
          university: data.university ?? "",
          course: data.course ?? ""
        });
        setAvatarUrl(data.avatar_url ?? "");
      }
    } finally {
      setLoading(false);
    }
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
        toast({ title: "Erro ao sincronizar", variant: "destructive" });
      }
    }, 1000);
  }, [user, toast]);

  const handleChange = (field: keyof typeof profileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setProfileData(prev => ({ ...prev, [field]: value }));
    triggerAutoSave(field, value);
  };

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validação de tamanho para mobile (limite 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 2MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setAutoSaveStatus("saving");

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload para o Bucket 'avatars' (Certifique-se que é PÚBLICO no Supabase)
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setAutoSaveStatus("saved");
      toast({ title: "Foto atualizada!", description: "Sua identidade foi sincronizada." });
      
      // Evento global para atualizar a Sidebar/BottomNav
      window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: publicUrl }));
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando Perfil...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-safe px-4 sm:px-6">
      
      {/* 1. Header BI-Style */}
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
            <h1 className="text-4xl font-black tracking-tighter">Perfil <span className="text-primary">Acadêmico</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Configurações de Identidade Social</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border/50 px-5 py-3 rounded-2xl shadow-sm">
          {autoSaveStatus === "saving" ? (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <Cloud className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Salvando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-500">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Protegido</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Hero Section (Avatar & Banner) */}
      <Card className="rounded-[40px] border-border/40 bg-card overflow-hidden shadow-2xl relative">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/5 to-background" />
        <CardContent className="px-8 pb-10 flex flex-col items-center -mt-16 relative z-10">
          <div className="relative group">
            <Avatar className="h-36 w-36 border-[6px] border-card shadow-2xl transition-transform group-hover:scale-105 duration-500">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black uppercase">
                {profileData.full_name?.substring(0, 2) || <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-1 right-1 h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-xl border-4 border-card hover:bg-primary/90 transition-all active:scale-90">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={isUploading} />
            </label>
          </div>
          
          <div className="text-center mt-6">
            <h2 className="text-2xl font-black tracking-tight">{profileData.full_name || "Estudante EduFlow"}</h2>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">
              {profileData.course ? `${profileData.course} • ${profileData.university}` : "Vínculo Institucional Pendente"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Grid de Informações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Coluna: Dados Acadêmicos */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Instituição & Curso
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 space-y-6 shadow-xl">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
              <Input 
                value={profileData.full_name} 
                onChange={handleChange("full_name")}
                placeholder="Ex: Anatomia Souza" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Universidade / Faculdade</Label>
              <Input 
                value={profileData.university} 
                onChange={handleChange("university")}
                placeholder="Ex: Universidade Federal" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Curso / Área de Estudo</Label>
              <Input 
                value={profileData.course} 
                onChange={handleChange("course")}
                placeholder="Ex: Direito Penal" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" 
              />
            </div>
          </Card>
        </section>

        {/* Coluna: Objetivos & Links */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <Target className="h-4 w-4 text-amber-500" /> Carreira & Metas
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 space-y-6 shadow-xl">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Carreira Almejada</Label>
              <Input 
                value={profileData.career_goal} 
                onChange={handleChange("career_goal")}
                placeholder="Ex: Pesquisador Acadêmico" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Globe className="h-3 w-3" /> Currículo Lattes / Portfólio
              </Label>
              <Input 
                value={profileData.portfolio_url} 
                onChange={handleChange("portfolio_url")}
                placeholder="https://lattes.cnpq.br/..." 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold text-primary" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> Planos para este Período
              </Label>
              <Textarea 
                value={profileData.study_plans} 
                onChange={handleChange("study_plans")}
                placeholder="Quais seus objetivos para o semestre?" 
                className="min-h-[100px] rounded-2xl bg-muted/20 border-border/40 font-medium resize-none p-4" 
              />
            </div>
          </Card>
        </section>

        {/* Biografia: Full Width */}
        <section className="md:col-span-2 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <User className="h-4 w-4 text-primary" /> Sobre Mim
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-8 shadow-xl">
            <Textarea 
              value={profileData.bio} 
              onChange={handleChange("bio")}
              placeholder="Conte um pouco sobre sua trajetória acadêmica e interesses de pesquisa..." 
              className="min-h-[150px] rounded-2xl bg-muted/20 border-border/40 font-medium resize-none p-5 text-lg leading-relaxed" 
            />
          </Card>
        </section>
      </div>

      {/* iOS Safe Area Spacer */}
      <div className="pb-24" />
    </div>
  );
}

