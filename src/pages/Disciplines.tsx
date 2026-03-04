import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, Trash2, ChevronDown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Discipline {
  id: string;
  name: string;
  professor: string | null;
  color: string;
  current_grade: number | null;
  is_extra_course: boolean;
  semester: string | null;
}

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Criação
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  
  // GESTÃO DE SEMESTRES (Histórico Acadêmico)
  const [selectedSemester, setSelectedSemester] = useState("2026.1");
  const [newSemester, setNewSemester] = useState("2026.1");

  // Estado de Exclusão Segura
  const [disciplineToDelete, setDisciplineToDelete] = useState<Discipline | null>(null);

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  useEffect(() => {
    if (user) loadDisciplines();
  }, [user, extraOnly, selectedSemester]); // Recarrega ao mudar o semestre

  async function loadDisciplines() {
    setLoading(true);
    let query = supabase
      .from("disciplines")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_extra_course", extraOnly)
      .order("name");

    // Filtra pelo semestre selecionado apenas se não for curso extra
    if (!extraOnly) {
      query = query.eq("semester", selectedSemester);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro de Conexão", description: error.message, variant: "destructive" });
    } else {
      setDisciplines(data ?? []);
    }
    setLoading(false);
  }

  async function createDiscipline() {
    if (!newName.trim() || !user) {
      toast({ title: "Nome obrigatório", description: "Dê um nome para a matéria.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("disciplines").insert({
      user_id: user.id,
      name: newName.trim(),
      professor: newProfessor.trim() || null,
      color: newColor,
      is_extra_course: extraOnly,
      semester: extraOnly ? null : newSemester.trim(), // Vincula ao semestre digitado
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: extraOnly ? "Curso adicionado!" : "Disciplina cadastrada com sucesso!" });
      setNewName("");
      setNewProfessor("");
      setOpen(false);
      loadDisciplines();
    }
    setIsSubmitting(false);
  }

  async function confirmDelete() {
    if (!disciplineToDelete) return;
    
    const { error } = await supabase.from("disciplines").delete().eq("id", disciplineToDelete.id);
    
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluída com sucesso", description: "A disciplina e seus dados foram apagados." });
      setDisciplineToDelete(null);
      loadDisciplines();
    }
  }

  if (loading && disciplines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 bg-slate-950">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Sincronizando Grade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* HEADER: Adaptado para Mobile e com Filtro de Semestre */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-6">
        <div className="space-y-2">
          {!extraOnly && (
            <div className="flex items-center gap-2 mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-primary/10 border-primary/20 text-primary font-black rounded-xl gap-2 hover:bg-primary/20 transition-all">
                    {selectedSemester} <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-white/10 rounded-xl shadow-2xl">
                  <DropdownMenuItem onClick={() => setSelectedSemester("2025.2")} className="text-slate-400 font-bold hover:text-white">2025.2 (Arquivado)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedSemester("2026.1")} className="text-white font-bold">2026.1 (Atual)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Filtrar Período</span>
            </div>
          )}
          
          <h1 className="text-4xl font-black text-white tracking-tighter">
            {extraOnly ? "Cursos Extras" : "Minha Grade"}
          </h1>
          <p className="text-slate-400 font-medium italic">
            {extraOnly
              ? "Aprimoramento e nivelamento fora da grade curricular."
              : `Você tem ${disciplines.length} matérias registradas em ${selectedSemester}.`}
          </p>
        </div>

        {/* MODAL DE CRIAÇÃO (ADD DISCIPLINA) */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8 active:scale-95 transition-all">
              <Plus className="mr-2 h-5 w-5" /> Novo {extraOnly ? "Curso" : "Cadastro"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 rounded-[32px] p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white">Nova {extraOnly ? "Formação" : "Disciplina"}</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium text-xs">
                Preencha os dados abaixo para organizar seu novo conteúdo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Nome da Matéria</Label>
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Ex: Macroeconomia I" 
                  className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
                />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Professor(a)</Label>
                <Input 
                  value={newProfessor} 
                  onChange={(e) => setNewProfessor(e.target.value)} 
                  placeholder="Ex: Dra. Simone Ferreira" 
                  className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
                />
              </div>
              {!extraOnly && (
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Semestre de Vínculo</Label>
                  <Input 
                    value={newSemester} 
                    onChange={(e) => setNewSemester(e.target.value)} 
                    placeholder="Ex: 2026.1" 
                    className="h-14 bg-slate-950/50 border-white/5 rounded-2xl text-white font-bold focus:ring-primary/40 text-base" 
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500 ml-1">Cor de Identificação</Label>
                <div className="flex flex-wrap gap-3 pt-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-10 w-10 rounded-full border-4 transition-all hover:scale-110 shadow-lg",
                        newColor === c ? "border-white ring-2 ring-primary scale-110" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button 
                onClick={createDiscipline} 
                disabled={isSubmitting} 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-4"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Cadastro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* GRID DE DISCIPLINAS OU ESTADO VAZIO */}
      {disciplines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 rounded-[40px] border-2 border-dashed border-white/5">
          <div className="h-24 w-24 rounded-[32px] bg-slate-950 flex items-center justify-center shadow-inner mb-6">
            <GraduationCap className="h-12 w-12 text-slate-700" />
          </div>
          <h3 className="text-xl font-black text-white">Nenhuma matéria encontrada</h3>
          <p className="text-slate-500 text-sm max-w-sm text-center mt-2 mb-8 italic">
            Não há registros para o semestre {selectedSemester}. Adicione suas disciplinas para começar o monitoramento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {disciplines.map((d) => (
            <Card
              key={d.id}
              onClick={() => navigate(`/disciplines/${d.id}`)}
              className="glass-card border-none overflow-hidden transition-all cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-1 rounded-[32px] group active:scale-[0.98] bg-slate-900/60"
            >
              <div className="h-2 w-full transition-all group-hover:h-3" style={{ backgroundColor: d.color }} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:rotate-6 group-hover:scale-110"
                      style={{ backgroundColor: `${d.color}15` }}
                    >
                      <BookOpen className="h-7 w-7" style={{ color: d.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-xl text-white leading-tight truncate group-hover:text-primary transition-colors">{d.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate mt-1">
                        Prof. {d.professor || "Não atribuído"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  {d.current_grade !== null ? (
                    <Badge variant="outline" className="font-black text-sm px-3 py-1 rounded-xl" style={{ borderColor: `${d.color}40`, color: d.color, backgroundColor: `${d.color}10` }}>
                      Nota: {d.current_grade.toFixed(1)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-xl border-white/10 text-slate-500 bg-slate-950/50">
                      Sem Notas
                    </Badge>
                  )}
                  
                  {/* Botão de Excluir que aciona o Modal de Segurança */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setDisciplineToDelete(d); 
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE SEGURANÇA PARA EXCLUSÃO (App-like) */}
      <AlertDialog open={!!disciplineToDelete} onOpenChange={(open) => !open && setDisciplineToDelete(null)}>
        <AlertDialogContent className="bg-slate-950 border-white/10 rounded-[32px] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-white text-xl font-black">
              <AlertTriangle className="h-6 w-6 text-rose-500" /> Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium">
              Deseja realmente excluir <span className="text-white font-bold">{disciplineToDelete?.name}</span>? 
              Esta ação apagará todas as notas, mídias e checklists associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
            <AlertDialogCancel className="rounded-xl h-12 bg-white/5 border-none text-white hover:bg-white/10 font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-xl h-12 bg-rose-500 text-white hover:bg-rose-600 font-black tracking-wider shadow-lg shadow-rose-500/20">
              Sim, Excluir Matéria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
