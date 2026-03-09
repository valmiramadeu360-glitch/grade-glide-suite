import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, User, Camera, Loader2, Cloud, 
  GraduationCap, Target, BookOpen, 
  Globe, ShieldCheck, Mail, Hash, Linkedin
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  
  // Adicionados os novos campos que os universitários precisam
  const [profileData, setProfileData] = useState({
    full_name: "",
    bio: "",
    career_goal: "",
    study_plans: "",
    portfolio_url: "",
    university: "",
    course: "",
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
          course: data.course ?? "",
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

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 2MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setAutoSaveStatus("saving");

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 rounded-2xl bg-muted/30 hover:bg-muted border border-border/40 shrink-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter truncate">Perfil <span className="text-primary">Acadêmico</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">Configurações de Identidade Social</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 bg-card border border-border/50 px-5 py-3 rounded-2xl shadow-sm w-full md:w-auto shrink-0">
          {autoSaveStatus === "saving" ? (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <Cloud className="h-4 w-4 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest">Salvando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-500">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest">Protegido</span>
            </div>
          )}
        </div>
      </header>

      <Card className="rounded-[40px] border-border/40 bg-card overflow-hidden shadow-xl relative">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/5 to-background" />
        <CardContent className="px-6 sm:px-8 pb-10 flex flex-col items-center -mt-16 relative z-10">
          <div className="relative group">
            <Avatar className="h-32 w-32 sm:h-36 sm:w-36 border-[6px] border-card shadow-2xl transition-transform group-hover:scale-105 duration-500">
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
          
          <div className="text-center mt-6 w-full px-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight truncate">{profileData.full_name || "Estudante EduFlow"}</h2>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2 truncate">
              {profileData.course ? `${profileData.course} • ${profileData.current_period || '1º'} Período` : "Vínculo Institucional Pendente"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Coluna 1: Dados Institucionais */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Instituição & Vínculo
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 space-y-5 shadow-lg">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
              <Input 
                value={profileData.full_name} 
                onChange={handleChange("full_name")}
                placeholder="Ex: João da Silva" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5"><Hash className="h-3 w-3" /> Matrícula (RA)</Label>
                <Input 
                  value={profileData.registration_number} 
                  onChange={handleChange("registration_number")}
                  placeholder="00000000" 
                  className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Período Atual</Label>
                <Input 
                  value={profileData.current_period} 
                  onChange={handleChange("current_period")}
                  placeholder="Ex: 4º Semestre" 
                  className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Universidade / Faculdade</Label>
              <Input 
                value={profileData.university} 
                onChange={handleChange("university")}
                placeholder="Ex: Universidade Federal..." 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Curso de Graduação</Label>
              <Input 
                value={profileData.course} 
                onChange={handleChange("course")}
                placeholder="Ex: Direito, Medicina, Economia..." 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5"><Mail className="h-3 w-3" /> E-mail Institucional</Label>
              <Input 
                value={profileData.institutional_email} 
                onChange={handleChange("institutional_email")}
                placeholder="aluno@instituicao.edu.br" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold text-primary focus:ring-primary/30" 
              />
            </div>
          </Card>
        </section>

        {/* Coluna 2: Metas e Networking */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <Target className="h-4 w-4 text-amber-500" /> Carreira & Networking
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 space-y-5 shadow-lg">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objetivo Profissional</Label>
              <Input 
                value={profileData.career_goal} 
                onChange={handleChange("career_goal")}
                placeholder="Ex: Desenvolvedor Sênior, Juiz Federal..." 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold focus:ring-primary/30" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Globe className="h-3 w-3" /> Currículo Lattes
              </Label>
              <Input 
                value={profileData.portfolio_url} 
                onChange={handleChange("portfolio_url")}
                placeholder="http://lattes.cnpq.br/..." 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-medium text-primary focus:ring-primary/30" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Linkedin className="h-3 w-3 text-blue-500" /> Perfil LinkedIn
              </Label>
              <Input 
                value={profileData.linkedin_url} 
                onChange={handleChange("linkedin_url")}
                placeholder="https://linkedin.com/in/seu-perfil" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-medium text-blue-500 focus:ring-primary/30" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> Planos para este Período
              </Label>
              <Textarea 
                value={profileData.study_plans} 
                onChange={handleChange("study_plans")}
                placeholder="Quais seus objetivos para o semestre? (Ex: Conseguir estágio, focar em TCC...)" 
                className="min-h-[120px] rounded-2xl bg-muted/20 border-border/40 font-medium resize-none p-4 focus:ring-primary/30 leading-relaxed" 
              />
            </div>
          </Card>
        </section>

        {/* Biografia em largura total */}
        <section className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <User className="h-4 w-4 text-primary" /> Biografia Acadêmica
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 shadow-lg">
            <Textarea 
              value={profileData.bio} 
              onChange={handleChange("bio")}
              placeholder="Conte um pouco sobre sua trajetória acadêmica, interesses de pesquisa, participação em ligas ou diretórios..." 
              className="min-h-[150px] rounded-2xl bg-muted/20 border-border/40 font-medium resize-none p-5 text-base sm:text-lg leading-relaxed focus:ring-primary/30" 
            />
          </Card>
        </section>
      </div>

    </div>
  );
}

