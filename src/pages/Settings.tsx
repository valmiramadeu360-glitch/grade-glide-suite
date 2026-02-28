import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, User, GraduationCap, Calendar, Sparkles } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("1");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name ?? "");
        setUniversity(data.university ?? "");
        setCourse(data.course ?? "");
        setSemester(data.semester?.toString() ?? "1");
        setSemesterStart(data.semester_start ?? "");
        setSemesterEnd(data.semester_end ?? "");
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!user?.id) return;
    setSaving(true);

    try {
      // Upsert robusto: Garante que os dados sejam salvos mesmo se o registro não existir
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: fullName.trim(),
        university: university.trim(),
        course: course.trim(),
        semester: parseInt(semester) || 1,
        semester_start: semesterStart || null,
        semester_end: semesterEnd || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

      if (error) throw error;

      toast({ 
        title: "Perfil Sincronizado!", 
        description: "As alterações já estão ativas no seu Dashboard." 
      });
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Acessando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4">
      <header className="pt-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Personalização</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter">Configurações</h1>
        <p className="text-slate-500 font-medium italic text-sm">
          Ajuste sua identidade e o cronograma do seu período letivo.
        </p>
      </header>

      <div className="grid gap-8">
        {/* Identidade Acadêmica */}
        <Card className="border-none bg-slate-900/40 rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/5">
          <CardHeader className="pb-4 px-10 pt-10">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
              <User className="h-4 w-4 text-primary" />
              Identidade do Aluno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-10 pb-10">
            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Nome de Exibição</Label>
              <Input 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Como quer ser chamado no app?"
                className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white placeholder:text-slate-800"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Instituição</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-4.5 h-4 w-4 text-slate-700" />
                  <Input 
                    value={university} 
                    onChange={(e) => setUniversity(e.target.value)} 
                    placeholder="Sua Universidade"
                    className="h-14 pl-10 bg-slate-950/50 border-white/5 rounded-2xl text-white placeholder:text-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Curso Atual</Label>
                <Input 
                  value={course} 
                  onChange={(e) => setCourse(e.target.value)} 
                  placeholder="Ex: Economia"
                  className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white placeholder:text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2.5 w-full sm:w-1/3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Semestre Atual</Label>
              <Input 
                type="number" 
                min="1" 
                value={semester} 
                onChange={(e) => setSemester(e.target.value)} 
                className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-black"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gestão de Período */}
        <Card className="border-none bg-slate-900/40 rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/5">
          <CardHeader className="pb-4 px-10 pt-10">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-3">
              <Calendar className="h-4 w-4" />
              Cronograma do Período
            </CardTitle>
            <CardDescription className="text-slate-500 text-[11px] font-medium leading-relaxed">
              Datas usadas para calcular o progresso semestral no seu Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Início das Aulas</Label>
                <Input 
                  type="date" 
                  value={semesterStart} 
                  onChange={(e) => setSemesterStart(e.target.value)} 
                  className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white [color-scheme:dark]"
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Término do Período</Label>
                <Input 
                  type="date" 
                  value={semesterEnd} 
                  onChange={(e) => setSemesterEnd(e.target.value)} 
                  className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white [color-scheme:dark]"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-6">
        <Button 
          onClick={save} 
          disabled={saving} 
          className="h-16 px-12 rounded-3xl shadow-2xl shadow-primary/30 font-black uppercase text-xs tracking-widest gap-3 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Sincronizar Dados
        </Button>
      </div>
    </div>
  );
}
