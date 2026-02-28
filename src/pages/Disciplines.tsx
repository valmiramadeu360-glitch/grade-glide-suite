import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline {
  id: string;
  name: string;
  professor: string | null;
  color: string;
  current_grade: number | null;
  is_extra_course: boolean;
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para nova disciplina
  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  useEffect(() => {
    if (user) loadDisciplines();
  }, [user, extraOnly]);

  async function loadDisciplines() {
    setLoading(true);
    const { data, error } = await supabase
      .from("disciplines")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_extra_course", extraOnly)
      .order("name");
    
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
    const { error } = await supabase.from("disciplines").insert({
      user_id: user.id,
      name: newName.trim(),
      professor: newProfessor.trim() || null,
      color: newColor,
      is_extra_course: extraOnly,
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
            {extraOnly ? "Cursos Extras" : "Minhas Disciplinas"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {extraOnly 
              ? "Aprimoramento e nivelamento fora da grade." 
              : `Você tem ${disciplines.length} matérias confirmadas neste semestre.`}
          </p>
        </div>

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
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Ex: Econometria ou BI" 
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Professor Responsável</Label>
                <Input 
                  value={newProfessor} 
                  onChange={(e) => setNewProfessor(e.target.value)} 
                  placeholder="Nome do docente" 
                  className="h-12"
                />
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
      </div>

      {disciplines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[40px] border-2 border-dashed border-border/50">
          <div className="h-20 w-20 rounded-3xl bg-background flex items-center justify-center shadow-inner mb-6">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Sua lista está vazia</h3>
          <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 mb-8 italic">
            Comece cadastrando as disciplinas do seu curso de Economia para organizar seus estudos.
          </p>
          <Button variant="outline" onClick={() => setOpen(true)} className="rounded-full px-8">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar agora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {disciplines.map((d) => (
            <Card
              key={d.id}
              className="group overflow-hidden border-none bg-card hover:bg-muted/30 transition-all cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-1 rounded-[24px]"
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
                  <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </div>
                </div>
                
                {d.current_grade !== null && (
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desempenho Atual</span>
                    <Badge variant="outline" className="font-bold text-sm bg-background/50" style={{ borderColor: `${d.color}40`, color: d.color }}>
                      {d.current_grade.toFixed(1)}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
