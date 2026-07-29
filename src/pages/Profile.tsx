import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, User, Camera, Loader2, Cloud, 
  GraduationCap, Globe, ShieldCheck, 
  Plus, Trash2, Eye, EyeOff, Link as LinkIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { InstitutionalPicker, type InstitutionalSelection } from "@/components/profile/InstitutionalPicker";

// Interface para os links dinâmicos
interface SocialLink {
  title: string;
  url: string;
}

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
    university: "",
    course: "",
    is_public: true, // Controle de privacidade
  });

  const [institutional, setInstitutional] = useState<InstitutionalSelection>({
    university_id: null,
    campus_id: null,
    course_id: null,
    current_period: null,
  });

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
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
          university: data.university ?? "",
          course: data.course ?? "",
          is_public: data.is_public ?? true,
        });
        setSocialLinks((Array.isArray(data.social_links) ? data.social_links : []) as any);
        setAvatarUrl(data.avatar_url ?? "");
        setInstitutional({
          university_id: (data as any).university_id ?? null,
          campus_id: (data as any).campus_id ?? null,
          course_id: (data as any).course_id ?? null,
          current_period: (data as any).current_period ?? null,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  // AutoSave para os campos de texto
  const triggerAutoSave = useCallback((field: string, value: any) => {
    if (!user) return;
    setAutoSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value, updated_at: new Date().toISOString() })
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

  // Funções para os Links Sociais
  const addSocialLink = () => {
    if (socialLinks.length >= 5) {
      toast({ title: "Limite atingido", description: "Você pode adicionar no máximo 5 links." });
      return;
    }
    setSocialLinks([...socialLinks, { title: "", url: "" }]);
  };

  const updateSocialLink = (index: number, field: "title" | "url", value: string) => {
    const newLinks = [...socialLinks];
    newLinks[index][field] = value;
    setSocialLinks(newLinks);
    triggerAutoSave("social_links", newLinks);
  };

  const removeSocialLink = (index: number) => {
    const newLinks = socialLinks.filter((_, i) => i !== index);
    setSocialLinks(newLinks);
    triggerAutoSave("social_links", newLinks);
  };

  async function togglePrivacy(checked: boolean) {
    setProfileData(prev => ({ ...prev, is_public: checked }));
    triggerAutoSave("is_public", checked);
    toast({ 
      title: checked ? "Perfil Público" : "Perfil Privado", 
      description: checked ? "Outros alunos agora podem ver sua biografia." : "Suas informações estão ocultas da rede." 
    });
  }

  async function handleInstitutionalChange(next: InstitutionalSelection) {
    setInstitutional(next);
    setAutoSaveStatus("saving");
    const payload: any = {
      university_id: next.university_id,
      campus_id: next.campus_id,
      course_id: next.course_id,
      current_period: next.current_period,
    };
    if (next.university_name) payload.university = next.university_name;
    if (next.course_name) payload.course = next.course_name;
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", user!.id);
    if (!error) {
      setAutoSaveStatus("saved");
      if (next.university_name) setProfileData((p) => ({ ...p, university: next.university_name! }));
      if (next.course_name) setProfileData((p) => ({ ...p, course: next.course_name! }));
      setTimeout(() => setAutoSaveStatus("idle"), 1500);
    } else {
      setAutoSaveStatus("idle");
      toast({ title: "Erro ao salvar vínculo", variant: "destructive" });
    }
  }

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

      const { data: { publicUrl: rawUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${rawUrl}?v=${Date.now()}`;

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
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando Perfil...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 overflow-x-hidden pt-4">
      
      {/* HEADER PREMIUM */}
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-muted/40 hover:bg-muted border border-border/40 shrink-0 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-foreground truncate">Meu Perfil</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">Identidade Acadêmica</p>
          </div>
        </div>

        {/* Dynamic Auto-Save Pill */}
        <div className={cn("flex items-center justify-center gap-2 px-4 py-2 rounded-full border shadow-sm transition-all duration-500 shrink-0", autoSaveStatus === "saving" ? "bg-card border-primary/20" : "bg-emerald-500/10 border-emerald-500/20")}>
          {autoSaveStatus === "saving" ? (
            <>
              <Cloud className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-primary">Salvando</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Sincronizado</span>
            </>
          )}
        </div>
      </header>

      {/* CARD DO AVATAR */}
      <Card className="rounded-[32px] border-border/20 bg-card overflow-hidden shadow-sm relative">
        <div className="h-32 sm:h-40 bg-gradient-to-tr from-primary/30 via-primary/5 to-background" />
        <CardContent className="px-6 sm:px-8 pb-8 flex flex-col items-center -mt-16 sm:-mt-20 relative z-10">
          <div className="relative group">
            <Avatar className="h-32 w-32 sm:h-36 sm:w-36 border-[6px] border-card shadow-xl transition-transform group-hover:scale-[1.02] duration-500 bg-muted/50">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black uppercase">
                {profileData.full_name?.substring(0, 2) || <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-1 right-1 h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg border-4 border-card hover:scale-105 transition-all active:scale-95">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={isUploading} />
            </label>
          </div>
          
          <div className="text-center mt-5 w-full px-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight truncate text-foreground">{profileData.full_name || "Estudante EduFlow"}</h2>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5 truncate">
              {profileData.course ? `${profileData.course}` : "Vínculo Pendente"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* TOGGLE DE PRIVACIDADE (Estilo iOS) */}
      <div className={cn("p-5 rounded-[24px] border transition-all duration-300 flex items-center justify-between cursor-pointer shadow-sm active:scale-[0.99]", profileData.is_public ? "bg-primary/5 border-primary/20" : "bg-card border-border/40")} onClick={() => togglePrivacy(!profileData.is_public)}>
        <div className="flex items-center gap-4">
          <div className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-colors shadow-inner", profileData.is_public ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground")}>
            {profileData.is_public ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[13px] font-black uppercase tracking-widest text-foreground">
              {profileData.is_public ? "Perfil Público" : "Perfil Privado"}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground mt-0.5 leading-tight">
              {profileData.is_public ? "Outros alunos podem ver sua bio e links no Connect." : "Somente seu nome aparecerá em interações."}
            </p>
          </div>
        </div>
        <Switch checked={profileData.is_public} onCheckedChange={togglePrivacy} className="data-[state=checked]:bg-primary shrink-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLUNA 1: DADOS INSTITUCIONAIS */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground ml-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Identidade Institucional
          </h3>
          <Card className="rounded-[28px] border-0 shadow-sm bg-card p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
              <Input 
                value={profileData.full_name} 
                onChange={handleChange("full_name")}
                placeholder="Como você é conhecido no campus" 
                className="h-14 rounded-2xl bg-muted/30 border-0 font-bold focus-visible:ring-primary text-base shadow-inner" 
              />
            </div>
            
            {/* O Componente do Vínculo foi mantido exatamento como é importado */}
            <div className="pt-2">
              <InstitutionalPicker value={institutional} onChange={handleInstitutionalChange} />
            </div>
          </Card>
        </div>

        {/* COLUNA 2: BIOGRAFIA */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground ml-2">
            <User className="h-4 w-4 text-primary" /> Sobre Mim
          </h3>
          <Card className="rounded-[28px] border-0 shadow-sm bg-card p-6 h-[calc(100%-2.2rem)]">
            <div className="space-y-2 h-full flex flex-col">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Sua Trajetória</Label>
              <Textarea 
                value={profileData.bio} 
                onChange={handleChange("bio")}
                placeholder="Conte um pouco sobre seus interesses, participação em projetos, empresas juniores, ligas..." 
                className="flex-1 min-h-[160px] rounded-2xl bg-muted/30 border-0 font-medium resize-none p-5 text-sm leading-relaxed focus-visible:ring-primary shadow-inner" 
              />
            </div>
          </Card>
        </div>

        {/* SESSÃO: LINKS SOCIAIS (Ocupa 2 colunas no Desktop) */}
        <div className="md:col-span-2 space-y-4 pt-2">
          <div className="flex items-center justify-between ml-2 mr-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4 text-amber-500" /> Links & Portfólio
            </h3>
            {socialLinks.length < 5 && (
              <Button variant="ghost" size="sm" onClick={addSocialLink} className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Link
              </Button>
            )}
          </div>
          
          <Card className="rounded-[28px] border-0 shadow-sm bg-card p-6">
            {socialLinks.length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border/40">
                <LinkIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Nenhum link configurado.</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Conecte seu Lattes, LinkedIn ou Portfólio.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {socialLinks.map((link, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/30 transition-all hover:border-primary/30 group">
                    <Input 
                      placeholder="Título (Ex: LinkedIn)" 
                      value={link.title}
                      onChange={(e) => updateSocialLink(index, "title", e.target.value)}
                      className="h-12 w-full sm:w-1/3 rounded-xl font-bold bg-background border-0 focus-visible:ring-primary shadow-sm"
                    />
                    <Input 
                      placeholder="URL (https://...)" 
                      value={link.url}
                      onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                      className="h-12 flex-1 rounded-xl font-medium text-foreground bg-background border-0 focus-visible:ring-primary shadow-sm"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeSocialLink(index)} className="h-12 w-12 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
