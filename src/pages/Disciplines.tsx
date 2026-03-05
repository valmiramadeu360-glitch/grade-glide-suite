import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline {
  id: string;
  name: string;
  professor: string | null;
  color: string;
  current_grade: number | null;
  is_extra_course: boolean;
  archived: boolean;
  semester_number: number | null;
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  useEffect(() => {
    if (user) loadDisciplines();
  }, [user, extraOnly, showArchived]);

  async function loadDisciplines() {
    setLoading(true);
    let query = supabase
      .from("disciplines")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_extra_course", extraOnly)
      .order("name");

    if (!showArchived) {
      query = query.or("archived.is.null,archived.eq.false");
    } else {
      query = query.eq("archived", true);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setDisciplines(data ?? []);
    }
    setLoading(false);
  }

  async function createDiscipline() {
    if (!newName.trim() || !user) {
      toast({ title: "O nome é obrigatório", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    // Get current semester from profile
    const { data: profile } = await supabase.from("profiles").select("semester").eq("user_id", user.id).maybeSingle();

    const { error } = await supabase.from("disciplines").insert({
      user_id: user.id,
      name: newName.trim(),
      professor: newProfessor.trim() || null,
      color: newColor,
      is_extra_course: extraOnly,
      semester_number: profile?.semester ?? null,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: extraOnly ? "Curso adicionado!" : "Disciplina cadastrada!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadDisciplines();
    }
    setIsSubmitting(false);
  }

  async function toggleArchive(id: string, currentArchived: boolean) {
    const action = currentArchived ? "desarquivar" : "arquivar";
    if (!window.confirm(`Deseja ${action} esta disciplina?`)) return;

    const { error } = await supabase.from("disciplines").update({ archived: !currentArchived }).eq("id", id);
    if (!error) {
      toast({ title: currentArchived ? "Disciplina restaurada!" : "Disciplina arquivada!" });
      loadDisciplines();
    }
  }

  if (loading && disciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sincronizando grade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            {extraOnly ? "Cursos Extras" : showArchived ? "Arquivo de Disciplinas" : "Minhas Disciplinas"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {showArchived
              ? `${disciplines.length} disciplinas arquivadas de semestres anteriores.`
              : extraOnly
                ? "Aprimoramento e nivelamento fora da grade."
                : `Você tem ${disciplines.length} matérias confirmadas neste semestre.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!extraOnly && (
            <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2">
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="archive-toggle" className="text-xs font-bold cursor-pointer">Arquivo</Label>
              <Switch id="archive-toggle" checked={showArchived} onCheckedChange={setShowArchived} />
            </div>
          )}

          {!showArchived && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-primary/20 font-bold uppercase text-xs tracking-widest">
                  <Plus className="mr-2 h-4 w-4" /> Adicionar {extraOnly ? "Curso" : "Matéria"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Novo Registro</DialogTitle>
                  <DialogDescription>Preencha os dados abaixo para organizar seu novo conteúdo.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 pt-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-muted-foreground">Nome da Disciplina</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Econometria ou BI" className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-muted-foreground">Professor Responsável</Label>
                    <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do docente" className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-muted-foreground">Identidade Visual (Cor)</Label>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={cn(
                            "h-8 w-8 rounded-full border-4 transition-all hover:scale-110 shadow-sm",
                            newColor === c ? "border-foreground/20 ring-2 ring-primary scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-12 font-bold uppercase tracking-widest">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar no Semestre"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {disciplines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[40px] border-2 border-dashed border-border/50">
          <div className="h-20 w-20 rounded-3xl bg-background flex items-center justify-center shadow-inner mb-6">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {showArchived ? "Nenhuma disciplina arquivada" : "Sua lista está vazia"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 mb-8 italic">
            {showArchived
              ? "As disciplinas de semestres anteriores aparecerão aqui quando arquivadas."
              : "Comece cadastrando as disciplinas do seu curso para organizar seus estudos."}
          </p>
          {!showArchived && (
            <Button variant="outline" onClick={() => setOpen(true)} className="rounded-full px-8">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar agora
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {disciplines.map((d) => (
            <Card
              key={d.id}
              className={cn(
                "group overflow-hidden border-none transition-all cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-1 rounded-[24px]",
                d.archived ? "bg-muted/50 opacity-70" : "bg-card hover:bg-muted/30"
              )}
              onClick={() => navigate(`/disciplines/${d.id}`)}
            >
              <div className="h-2 w-full" style={{ backgroundColor: d.color }} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:rotate-6"
                      style={{ backgroundColor: `${d.color}15` }}
                    >
                      <BookOpen className="h-6 w-6" style={{ color: d.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-lg text-foreground leading-tight truncate">{d.name}</h3>
                      <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-tighter italic">
                        {d.professor || "Sem docente atribuído"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.semester_number && (
                      <Badge variant="secondary" className="text-[9px] font-bold">{d.semester_number}º Sem</Badge>
                    )}
                    <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {d.current_grade !== null && (
                    <Badge variant="outline" className="font-bold text-sm bg-background/50" style={{ borderColor: `${d.color}40`, color: d.color }}>
                      {d.current_grade.toFixed(1)}
                    </Badge>
                  )}
                  {!showArchived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); toggleArchive(d.id, d.archived ?? false); }}
                    >
                      <Archive className="h-3 w-3 mr-1" /> Arquivar
                    </Button>
                  )}
                  {showArchived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] text-primary hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); toggleArchive(d.id, true); }}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
