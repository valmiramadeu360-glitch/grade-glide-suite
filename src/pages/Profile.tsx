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
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando Perfil...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6 overflow-x-hidden">
      
      {/* Header Principal */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 rounded-2xl bg-muted/30 hover:bg-muted border border-border/40 shrink-0">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter truncate">Perfil <span className="text-primary">Acadêmico</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">Identidade & Networking</p>
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

      {/* Cartão de Visibilidade (Privacidade) */}
      <div className={cn("p-5 sm:p-6 rounded-[24px] border transition-colors flex items-center justify-between cursor-pointer shadow-sm", profileData.is_public ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/30 border-border/50 hover:bg-muted/50")} onClick={() => togglePrivacy(!profileData.is_public)}>
        <div className="flex items-center gap-4">
          <div className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-colors", profileData.is_public ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
            {profileData.is_public ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-foreground">
              {profileData.is_public ? "Perfil Visível na Rede" : "Perfil Oculto (Privado)"}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 max-w-[250px] sm:max-w-none">
              {profileData.is_public ? "Outros estudantes poderão ver sua bio e links no EduFlow Connect." : "Somente o seu nome aparecerá em comentários e posts."}
            </p>
          </div>
        </div>
        <Switch checked={profileData.is_public} onCheckedChange={togglePrivacy} className="data-[state=checked]:bg-primary" />
      </div>

      {/* Cartão do Avatar */}
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
              {profileData.course ? `${profileData.course}` : "Vínculo Institucional Pendente"}
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

            <InstitutionalPicker value={institutional} onChange={handleInstitutionalChange} />
          </Card>
        </section>

        {/* Coluna 2: Biografia (Movida para cima para equilibrar) */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
            <User className="h-4 w-4 text-primary" /> Biografia Acadêmica
          </h3>
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 shadow-lg h-[calc(100%-2.5rem)]">
            <div className="space-y-2 h-full flex flex-col">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sobre mim (Aparece no seu Perfil)</Label>
              <Textarea 
                value={profileData.bio} 
                onChange={handleChange("bio")}
                placeholder="Conte um pouco sobre sua trajetória, interesses de pesquisa, participação em ligas ou diretórios..." 
                className="flex-1 min-h-[180px] rounded-2xl bg-muted/20 border-border/40 font-medium resize-none p-5 text-base sm:text-lg leading-relaxed focus:ring-primary/30" 
              />
            </div>
          </Card>
        </section>

        {/* Gerenciador de Links Dinâmicos */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between ml-2 mr-2">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <Globe className="h-4 w-4 text-amber-500" /> Links & Redes Sociais
            </h3>
            {socialLinks.length < 5 && (
              <Button variant="ghost" size="sm" onClick={addSocialLink} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">
                <Plus className="mr-1 h-4 w-4" /> Adicionar Link
              </Button>
            )}
          </div>
          
          <Card className="rounded-[32px] border-border/40 bg-card p-6 sm:p-8 shadow-lg">
            {socialLinks.length === 0 ? (
              <div className="text-center py-6">
                <LinkIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Nenhum link adicionado.</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Adicione seu Lattes, LinkedIn ou Portfólio.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {socialLinks.map((link, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40 transition-all hover:border-primary/30">
                    <Input 
                      placeholder="Título (Ex: LinkedIn)" 
                      value={link.title}
                      onChange={(e) => updateSocialLink(index, "title", e.target.value)}
                      className="h-12 w-full sm:w-1/3 rounded-xl font-bold bg-background border-border/50"
                    />
                    <Input 
                      placeholder="URL (https://...)" 
                      value={link.url}
                      onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                      className="h-12 flex-1 rounded-xl font-medium text-primary bg-background border-border/50"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeSocialLink(index)} className="h-12 w-12 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

      </div>
    </div>
  );
}
