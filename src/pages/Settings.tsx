import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, User, GraduationCap, Calendar } from "lucide-react";

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
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

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
    if (!user) return;
    setSaving(true);

    try {
      // Usamos o user_id como chave para o upsert (update or insert)
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: fullName.trim(),
        university: university.trim(),
        course: course.trim(),
        semester: parseInt(semester) || 1,
        semester_start: semesterStart || null,
        semester_end: semesterEnd || null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ 
        title: "Perfil atualizado!", 
        description: "Suas configurações foram salvas com sucesso." 
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
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          Configurações
        </h1>
        <p className="text-muted-foreground font-medium italic">
          Personalize sua identidade e período acadêmico.
        </p>
      </header>

      <div className="grid gap-6">
        {/* Card de Identidade */}
        <Card className="glass-card border-none shadow-md overflow-hidden">
          <div className="h-1 w-full bg-primary/40" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identidade
            </CardTitle>
            <CardDescription className="text-xs">Seus dados básicos de estudante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
              <Input 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Ex: João da Silva"
                className="h-11 bg-muted/30 focus:bg-background"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                   <GraduationCap className="h-3 w-3" /> Universidade
                </Label>
                <Input 
                  value={university} 
                  onChange={(e) => setUniversity(e.target.value)} 
                  placeholder="Ex: UFAL"
                  className="h-11 bg-muted/30 focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Curso</Label>
                <Input 
                  value={course} 
                  onChange={(e) => setCourse(e.target.value)} 
                  placeholder="Ex: Economia"
                  className="h-11 bg-muted/30 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-2 w-full sm:w-1/3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Semestre Atual</Label>
              <Input 
                type="number" 
                min="1" 
                value={semester} 
                onChange={(e) => setSemester(e.target.value)} 
                className="h-11 bg-muted/30 focus:bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card do Semestre */}
        <Card className="glass-card border-none shadow-md overflow-hidden">
          <div className="h-1 w-full bg-amber-500/40" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Período Letivo
            </CardTitle>
            <CardDescription className="text-xs">Essas datas controlam o gráfico de progresso no Dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Início</Label>
                <Input 
                  type="date" 
                  value={semesterStart} 
                  onChange={(e) => setSemesterStart(e.target.value)} 
                  className="h-11 bg-muted/30 focus:bg-background cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Término</Label>
                <Input 
                  type="date" 
                  value={semesterEnd} 
                  onChange={(e) => setSemesterEnd(e.target.value)} 
                  className="h-11 bg-muted/30 focus:bg-background cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          onClick={save} 
          disabled={saving} 
          className="h-12 px-10 shadow-lg shadow-primary/20 font-bold uppercase text-xs tracking-widest gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
