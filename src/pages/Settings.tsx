import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, User, GraduationCap, Calendar, LogOut, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  // Estados do Perfil
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("2026.1"); // BI: Formato "Ano.Período"
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  
  // Estados UI
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfileId(data.id);
        setFullName(data.full_name ?? "");
        setUniversity(data.university ?? "");
        setCourse(data.course ?? "");
        // Atualizado para receber String (ex: "2026.1") ou converter o número antigo
        setSemester(data.semester?.toString() ?? "2026.1"); 
        setSemesterStart(data.semester_start ?? "");
        setSemesterEnd(data.semester_end ?? "");
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      toast({ title: "Erro de sincronização", description: "Não foi possível carregar seus dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Função robusta de salvamento (Resolve o erro da universidade)
  async function save() {
    if (!user) return;
    setSaving(true);

    try {
      const profileData = {
        full_name: fullName.trim(),
        university: university.trim(),
        course: course.trim(),
        semester: semester.trim() || "2026.1", // Permite "2026.1"
        semester_start: semesterStart || null,
        semester_end: semesterEnd || null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (profileId) {
        // Se existe perfil, atualiza pelo ID
        const res = await supabase.from("profiles").update(profileData).eq("id", profileId);
        error = res.error;
      } else {
        // Se não existe, insere um novo
        const res = await supabase.from("profiles").insert({ ...profileData, user_id: user.id }).select().single();
        error = res.error;
        if (res.data) setProfileId(res.data.id);
      }

      if (error) throw error;

      toast({ title: "Perfil atualizado!", description: "Suas configurações foram salvas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: "Verifique a conexão e os dados inseridos.", variant: "destructive" });
      console.error("Erro Save:", error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 bg-slate-950">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Buscando Identidade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* HEADER: Padrão App Moderno */}
      <header className="mt-6">
        <h1 className="text-4xl font-black text-white tracking-tighter">Configurações</h1>
        <p className="text-slate-400 font-medium italic mt-1">Sua identidade acadêmica e preferências do sistema.</p>
      </header>

      <div className="grid gap-6">
        {/* CARD 1: IDENTIDADE */}
        <Card className="glass-card border-none bg-slate-900/60 shadow-2xl overflow-hidden rounded-[32px]">
          <div className="h-2 w-full bg-primary/80" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-xl font-black text-white flex items-center gap-3">
              <User className="h-6 w-6 text-primary" /> Dados Pessoais
            </CardTitle>
            <CardDescription className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Informações do seu perfil de estudante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome de Exibição</Label>
              <Input 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Como você quer ser chamado?" 
                className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" /> Instituição
                </Label>
                <Input 
                  value={university} 
                  onChange={(e) => setUniversity(e.target.value)} 
                  placeholder="Ex: USP, UFAL" 
                  className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Curso de Graduação</Label>
                <Input 
                  value={course} 
                  onChange={(e) => setCourse(e.target.value)} 
                  placeholder="Ex: Economia" 
                  className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: PERÍODO LETIVO (BI) */}
        <Card className="glass-card border-none bg-slate-900/60 shadow-2xl overflow-hidden rounded-[32px]">
          <div className="h-2 w-full bg-amber-500/80" />
          <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
            <CardTitle className="text-xl font-black text-white flex items-center gap-3">
              <Calendar className="h-6 w-6 text-amber-500" /> Histórico Letivo
            </CardTitle>
            <CardDescription className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Base para os cálculos de produtividade e histórico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8">
            <div className="space-y-2 w-full sm:w-1/2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identificador do Semestre</Label>
              <Input 
                type="text" 
                value={semester} 
                onChange={(e) => setSemester(e.target.value)} 
                placeholder="Ex: 2026.1"
                className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-amber-500/40 text-base" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Início das Aulas</Label>
                <Input 
                  type="date" 
                  value={semesterStart} 
                  onChange={(e) => setSemesterStart(e.target.value)} 
                  className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-amber-500/40 text-base [color-scheme:dark]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fim das Aulas (Exames)</Label>
                <Input 
                  type="date" 
                  value={semesterEnd} 
                  onChange={(e) => setSemesterEnd(e.target.value)} 
                  className="h-14 bg-slate-950/80 border-white/5 rounded-2xl text-white font-bold focus:ring-amber-500/40 text-base [color-scheme:dark]" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AÇÕES FIXAS (App Style) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 mt-4">
        
        {/* Modal de Logout Seguro */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 px-6 w-full sm:w-auto">
              <LogOut className="h-4 w-4" /> Sair da Conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-950 border-white/10 rounded-[32px] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-white text-xl font-black">
                <ShieldAlert className="h-6 w-6 text-rose-500" /> Encerrar Sessão
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 font-medium">
                Deseja sair do aplicativo? Seus dados acadêmicos continuarão salvos na nuvem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
              <AlertDialogCancel className="rounded-xl h-12 bg-white/5 border-none text-white hover:bg-white/10 font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => signOut()} className="rounded-xl h-12 bg-rose-500 text-white hover:bg-rose-600 font-black tracking-wider shadow-lg shadow-rose-500/20">
                Sim, Sair agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button 
          onClick={save} 
          disabled={saving} 
          className="h-14 px-10 shadow-xl shadow-primary/20 font-black uppercase text-xs tracking-widest gap-2 w-full sm:w-auto rounded-2xl active:scale-[0.98] transition-all"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Salvando Dados..." : "Gravar Configurações"}
        </Button>
      </div>
    </div>
  );
}
