import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_extra_course", extraOnly)
        .order("name");
      
      if (error) throw error;
      setDisciplines(data ?? []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createDiscipline() {
    if (!newName.trim() || !user) {
      toast({ title: "O nome é obrigatório", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from("disciplines").insert({
        user_id: user.id,
        name: newName.trim(),
        professor: newProfessor.trim() || null,
        color: newColor,
        is_extra_course: extraOnly,
      });

      if (error) throw error;

      toast({ title: extraOnly ? "Curso adicionado!" : "Disciplina cadastrada!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadDisciplines();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading && disciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sincronizando Grade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter">
            {extraOnly ? "Cursos Extras" : "Grade Curricular"}
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">
            {extraOnly 
              ? "Aprimoramento e nivelamento além da universidade." 
              : `Gerenciando ${disciplines.length} matérias confirmadas.`}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-2xl px-6 shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">
              <Plus className="mr-2 h-4 w-4" /> Adicionar {extraOnly ? "Curso" : "Matéria"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none bg-slate-900 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight text-white">Novo Registro</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium">Preencha os dados para organizar seu novo conteúdo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Nome da Disciplina</Label>
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Ex: Microeconomia ou BI" 
                  className="h-12 bg-slate-950 border-white/5 rounded-xl text-white placeholder:text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Professor Responsável</Label>
                <Input 
                  value={newProfessor} 
                  onChange={(e) => setNewProfessor(e.target.value)} 
                  placeholder="Nome do docente" 
                  className="h-12 bg-slate-950 border-white/5 rounded-xl text-white placeholder:text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Identidade Visual</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-9 w-9 rounded-xl border-2 transition-all hover:scale-110 shadow-lg",
                        newColor === c ? "border-white ring-2 ring-primary ring-offset-2 ring-offset-slate-900 scale-110" : "border-transparent opacity-60"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={createDiscipline} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Cadastro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {disciplines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-900/40 rounded-[48px] border-2 border-dashed border-white/5">
          <div className="h-20 w-20 rounded-[24px] bg-slate-950 flex items-center justify-center shadow-2xl mb-6 ring-1 ring-white/5">
            <GraduationCap className="h-10 w-10 text-primary opacity-20" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Sua grade está vazia</h3>
          <p className="text-slate-500 text-sm max-w-xs text-center mt-2 mb-10 italic font-medium">
            Comece cadastrando as disciplinas do seu curso para centralizar seus estudos e mídias.
          </p>
          <Button variant="outline" onClick={() => setOpen(true)} className="rounded-2xl px-10 h-12 font-black uppercase text-[10px] tracking-widest border-white/10 hover:bg-white/5 text-slate-300">
            <Plus className="mr-2 h-4 w-4" /> Criar Primeira Matéria
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {disciplines.map((d) => (
            <Card
              key={d.id}
              className="group overflow-hidden border-none bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-md transition-all cursor-pointer shadow-xl hover:shadow-primary/5 hover:-translate-y-2 rounded-[36px] ring-1 ring-white/5"
              onClick={() => navigate(`/disciplines/${d.id}`)}
            >
              <div className="h-2 w-full opacity-60 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: d.color }} />
              <CardContent className="p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div 
                      className="h-14 w-14 rounded-[20px] flex items-center justify-center shadow-2xl transition-all group-hover:rotate-12" 
                      style={{ backgroundColor: `${d.color}15` }}
                    >
                      <BookOpen className="h-7 w-7" style={{ color: d.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-xl text-white leading-tight truncate tracking-tight">{d.name}</h3>
                      <p className="text-[10px] font-black text-slate-500 truncate uppercase tracking-[0.2em] mt-1">
                        {d.professor || "Docente não atribuído"}
                      </p>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                </div>
                
                {d.current_grade !== null && (
                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Média Atual</span>
                    <Badge variant="outline" className="font-black text-xs px-3 py-1 rounded-full border-white/10 bg-slate-950/50" style={{ color: d.color }}>
                      {d.current_grade.toFixed(1).replace('.', ',')}
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
