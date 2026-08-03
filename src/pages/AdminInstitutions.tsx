import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GraduationCap, Building2, BookOpen, Plus, Trash2, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Tela de cadastro do catálogo institucional (universidade -> campus -> curso).
// Antes desta tela, nada no app permitia inserir nessas tabelas — só ler
// (InstitutionalPicker, ImportAtestado). Acesso restrito ao admin oficial.

type University = { id: string; name: string; acronym: string; state: string };
type Campus = { id: string; university_id: string; name: string; state: string | null };
type Course = { id: string; campus_id: string; name: string; degree: string };

const ADMIN_EMAIL = "eduflow.adm.academy@gmail.com";

export default function AdminInstitutions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [universities, setUniversities] = useState<University[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<string | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uName, setUName] = useState("");
  const [uAcronym, setUAcronym] = useState("");
  const [uState, setUState] = useState("");
  const [cName, setCName] = useState("");
  const [cState, setCState] = useState("");
  const [crName, setCrName] = useState("");
  const [crDegree, setCrDegree] = useState("Bacharelado");

  useEffect(() => { loadUniversities(); }, []);
  useEffect(() => { if (selectedUniversity) loadCampuses(selectedUniversity); else setCampuses([]); setSelectedCampus(null); }, [selectedUniversity]);
  useEffect(() => { if (selectedCampus) loadCourses(selectedCampus); else setCourses([]); }, [selectedCampus]);

  async function loadUniversities() {
    setLoading(true);
    const { data } = await supabase.from("universities").select("id,name,acronym,state").order("name");
    setUniversities(data ?? []);
    setLoading(false);
  }
  async function loadCampuses(universityId: string) {
    const { data } = await supabase.from("campuses").select("id,university_id,name,state").eq("university_id", universityId).order("name");
    setCampuses(data ?? []);
  }
  async function loadCourses(campusId: string) {
    const { data } = await supabase.from("courses").select("id,campus_id,name,degree").eq("campus_id", campusId).order("name");
    setCourses(data ?? []);
  }

  async function addUniversity() {
    if (!uName.trim() || !uAcronym.trim()) {
      toast({ title: "Preencha nome e sigla da universidade", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("universities").insert({ name: uName.trim(), acronym: uAcronym.trim().toUpperCase(), state: uState.trim() || "AL" });
      if (error) throw error;
      setUName(""); setUAcronym(""); setUState("");
      toast({ title: "Universidade cadastrada! 🎓" });
      loadUniversities();
    } catch (e: any) {
      toast({ title: "Erro ao cadastrar universidade", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function addCampus() {
    if (!selectedUniversity || !cName.trim()) {
      toast({ title: "Selecione a universidade e informe o nome do campus", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("campuses").insert({ university_id: selectedUniversity, name: cName.trim(), state: cState.trim() || null });
      if (error) throw error;
      setCName(""); setCState("");
      toast({ title: "Campus cadastrado! 📍" });
      loadCampuses(selectedUniversity);
    } catch (e: any) {
      toast({ title: "Erro ao cadastrar campus", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function addCourse() {
    if (!selectedCampus || !crName.trim()) {
      toast({ title: "Selecione o campus e informe o nome do curso", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("courses").insert({ campus_id: selectedCampus, name: crName.trim(), degree: crDegree });
      if (error) throw error;
      setCrName("");
      toast({ title: "Curso cadastrado! 📚" });
      loadCourses(selectedCampus);
    } catch (e: any) {
      toast({ title: "Erro ao cadastrar curso", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function removeRow(table: "universities" | "campuses" | "courses", id: string) {
    if (!confirm("Remover este item? Isso pode afetar alunos já vinculados a ele.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Removido." });
    if (table === "universities") { loadUniversities(); setSelectedUniversity(null); }
    else if (table === "campuses" && selectedUniversity) { loadCampuses(selectedUniversity); setSelectedCampus(null); }
    else if (table === "courses" && selectedCampus) loadCourses(selectedCampus);
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center pt-20 space-y-3 px-4">
        <p className="text-lg font-black text-foreground">Acesso restrito</p>
        <p className="text-sm text-muted-foreground font-medium">Só o administrador oficial do EduFlow acessa esta tela.</p>
        <Button onClick={() => navigate("/")} className="rounded-2xl font-black h-11 px-6 mt-2">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-8">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl bg-muted/40 hover:bg-muted border border-border/40 shrink-0" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Universidades, Campus e Cursos</h1>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Catálogo institucional do EduFlow</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="rounded-[28px] border-0 bg-card shadow-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Universidades</h3>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="space-y-2 bg-muted/30 p-3 rounded-2xl border border-border/30">
              <Input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Nome (ex: Universidade Federal de Alagoas)" className="h-10 rounded-xl bg-background border-0 text-xs font-bold" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={uAcronym} onChange={(e) => setUAcronym(e.target.value)} placeholder="Sigla (UFAL)" className="h-9 rounded-xl bg-background border-0 text-xs" />
                <Input value={uState} onChange={(e) => setUState(e.target.value)} placeholder="UF (AL)" className="h-9 rounded-xl bg-background border-0 text-xs" />
              </div>
              <Button size="sm" onClick={addUniversity} disabled={saving} className="w-full h-9 rounded-xl font-black text-xs gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : universities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 font-medium">Nenhuma universidade cadastrada.</p>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {universities.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUniversity(u.id)}
                    className={cn("flex items-center justify-between p-3 rounded-xl cursor-pointer text-xs font-bold transition-all", selectedUniversity === u.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-foreground border border-transparent")}
                  >
                    <span className="truncate">{u.acronym} — {u.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); removeRow("universities", u.id); }} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-card shadow-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Campus</h3>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {!selectedUniversity ? (
              <p className="text-xs text-muted-foreground text-center py-8 font-medium">Selecione uma universidade ao lado.</p>
            ) : (
              <>
                <div className="space-y-2 bg-muted/30 p-3 rounded-2xl border border-border/30">
                  <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Nome (ex: Campus A.C. Simões)" className="h-10 rounded-xl bg-background border-0 text-xs font-bold" />
                  <Input value={cState} onChange={(e) => setCState(e.target.value)} placeholder="Cidade/UF (opcional)" className="h-9 rounded-xl bg-background border-0 text-xs" />
                  <Button size="sm" onClick={addCampus} disabled={saving} className="w-full h-9 rounded-xl font-black text-xs gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
                  </Button>
                </div>

                {campuses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 font-medium">Nenhum campus cadastrado nesta universidade.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                    {campuses.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCampus(c.id)}
                        className={cn("flex items-center justify-between p-3 rounded-xl cursor-pointer text-xs font-bold transition-all", selectedCampus === c.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-foreground border border-transparent")}
                      >
                        <span className="truncate">{c.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); removeRow("campuses", c.id); }} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-card shadow-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cursos</h3>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {!selectedCampus ? (
              <p className="text-xs text-muted-foreground text-center py-8 font-medium">Selecione um campus ao lado.</p>
            ) : (
              <>
                <div className="space-y-2 bg-muted/30 p-3 rounded-2xl border border-border/30">
                  <Input value={crName} onChange={(e) => setCrName(e.target.value)} placeholder="Nome (ex: Ciências Econômicas)" className="h-10 rounded-xl bg-background border-0 text-xs font-bold" />
                  <select value={crDegree} onChange={(e) => setCrDegree(e.target.value)} className="w-full h-9 rounded-xl bg-background border-0 px-3 text-xs font-bold">
                    <option value="Bacharelado">Bacharelado</option>
                    <option value="Licenciatura">Licenciatura</option>
                    <option value="Tecnólogo">Tecnólogo</option>
                  </select>
                  <Button size="sm" onClick={addCourse} disabled={saving} className="w-full h-9 rounded-xl font-black text-xs gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
                  </Button>
                </div>

                {courses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 font-medium">Nenhum curso cadastrado neste campus.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                    {courses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl text-xs font-bold border border-transparent hover:bg-muted/50">
                        <div className="truncate">
                          <span>{c.name}</span>
                          <span className="ml-2 text-[9px] uppercase tracking-wider text-muted-foreground">{c.degree}</span>
                        </div>
                        <button onClick={() => removeRow("courses", c.id)} className="text-muted-foreground hover:text-destructive p-1 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
  }
