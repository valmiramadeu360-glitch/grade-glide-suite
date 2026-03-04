import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Loader2, BookOpen, Check, Pencil, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

// Importação dos Módulos Internos
import { DisciplineGeneral } from "@/components/discipline/DisciplineGeneral";
import { DisciplineChecklist } from "@/components/discipline/DisciplineChecklist";
import { DisciplineMaterials } from "@/components/discipline/DisciplineMaterials";
import { DisciplineBooks } from "@/components/discipline/DisciplineBooks";
import { DisciplineNotes } from "@/components/discipline/DisciplineNotes";

export default function DisciplineDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [discipline, setDiscipline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Estados de Edição Dinâmica (O "Pilar" do App)
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && id) loadDiscipline();
  }, [user, id]);

  // Foco automático ao iniciar a edição
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  async function loadDiscipline() {
    try {
      const { data, error } = await supabase
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id)
        .single();

      if (error || !data) throw error;
      setDiscipline(data);
      setTempName(data.name);
    } catch {
      toast({ title: "Erro de Acesso", description: "Matéria não encontrada.", variant: "destructive" });
      navigate("/disciplines");
    } finally {
      setLoading(false);
    }
  }

  // Função CRUD Dinâmica (Edição de Título em Tempo Real)
  async function handleUpdateName() {
    if (tempName.trim() === "" || tempName === discipline.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from("disciplines")
        .update({ name: tempName })
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      setDiscipline({ ...discipline, name: tempName });
      toast({ title: "Título atualizado!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setTempName(discipline.name); // Reverte se falhar
    } finally {
      setIsSavingName(false);
      setIsEditingName(false);
    }
  }

  async function deleteDiscipline() {
    if (!id || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("disciplines").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      
      toast({ title: "Exclusão Concluída", description: "O histórico da matéria foi apagado." });
      navigate("/disciplines");
    } catch (error: any) {
      toast({ title: "Erro Crítico", description: error.message, variant: "destructive" });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Carregando Matéria</p>
        </div>
      </div>
    );
  }

  const disciplineColor = discipline?.color || "#3b82f6";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-6">
      
      {/* Botão Voltar Estilo App */}
      <div className="pt-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/disciplines")} 
          className="w-fit gap-2 text-slate-500 hover:text-primary transition-all rounded-xl pl-0"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Grade
        </Button>
      </div>

      {/* Cabeçalho Interativo e Editável */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 backdrop-blur-xl p-6 md:p-8 rounded-[32px] border border-white/5 shadow-2xl">
        <div className="flex items-start md:items-center gap-5 w-full md:w-auto">
          <div 
            className="h-16 w-16 md:h-20 md:w-20 rounded-[22px] flex items-center justify-center shadow-inner shrink-0" 
            style={{ backgroundColor: `${disciplineColor}15` }}
          >
            <BookOpen className="h-8 w-8 md:h-10 md:w-10" style={{ color: disciplineColor }} />
          </div>
          
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={nameInputRef}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                  className="text-2xl md:text-3xl font-black bg-slate-950/50 border-primary/40 h-12 w-full max-w-sm rounded-xl focus-visible:ring-primary/40"
                  disabled={isSavingName}
                />
                <Button 
                  size="icon" 
                  onClick={handleUpdateName} 
                  disabled={isSavingName}
                  className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl h-12 w-12"
                >
                  {isSavingName ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                </Button>
              </div>
            ) : (
              <div className="group flex items-center gap-3 cursor-pointer" onClick={() => setIsEditingName(true)}>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter truncate max-w-[200px] sm:max-w-md group-hover:text-primary transition-colors">
                  {discipline?.name}
                </h1>
                <Pencil className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: disciplineColor }} />
              <p className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest truncate">
                Prof. {discipline?.professor || "Não atribuído"}
              </p>
            </div>
          </div>
        </div>

        {/* Modal de Segurança para Exclusão (Substitui o window.confirm) */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="text-rose-500 hover:bg-rose-500/10 font-black text-[10px] md:text-xs uppercase tracking-widest gap-2 rounded-2xl h-12 w-full md:w-auto"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Apagando..." : "Excluir Matéria"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-950 border-white/10 rounded-[32px] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-white text-xl font-black">
                <AlertTriangle className="h-6 w-6 text-rose-500" /> Ação Irreversível
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 font-medium">
                Tem certeza que deseja excluir <span className="text-white font-bold">{discipline?.name}</span>? 
                Todos os seus resumos, checklist de estudos e mídias vinculadas a este semestre serão apagados para sempre.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
              <AlertDialogCancel className="rounded-xl h-12 bg-white/5 border-none text-white hover:bg-white/10 font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteDiscipline} className="rounded-xl h-12 bg-rose-500 text-white hover:bg-rose-600 font-black tracking-wider shadow-lg shadow-rose-500/20">
                Sim, Excluir Tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Navegação por Abas Responsiva (App Mobile) */}
      <Tabs defaultValue="general" className="w-full">
        <div className="overflow-x-auto no-scrollbar mb-6">
          <TabsList className="inline-flex w-max sm:w-full bg-slate-900/60 p-1.5 rounded-[24px] border border-white/5 gap-1 shadow-inner">
            <TabsTrigger value="general" className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary transition-all">
              Início
            </TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary transition-all">
              Estudos
            </TabsTrigger>
            <TabsTrigger value="materials" className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary transition-all">
              Mídia
            </TabsTrigger>
            <TabsTrigger value="books" className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary transition-all">
              Livros
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary transition-all">
              Resumos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="outline-none">
          <TabsContent value="general" className="mt-0 focus-visible:ring-0">
            <DisciplineGeneral discipline={discipline} onUpdate={loadDiscipline} />
          </TabsContent>
          <TabsContent value="checklist" className="mt-0 focus-visible:ring-0">
            <DisciplineChecklist disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="materials" className="mt-0 focus-visible:ring-0">
            <DisciplineMaterials disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="books" className="mt-0 focus-visible:ring-0">
            {/* A nova aba solicitada */}
            <DisciplineBooks disciplineId={discipline.id} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0 focus-visible:ring-0">
            {/* A aba onde implementaremos o Editor Rico e a Impressão A4 */}
            <DisciplineNotes disciplineId={discipline.id} disciplineName={discipline.name} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
