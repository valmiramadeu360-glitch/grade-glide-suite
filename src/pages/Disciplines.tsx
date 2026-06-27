import { useEffect, useState, useMemo } from "react"; import { supabase } from "@/integrations/supabase/client"; import { useAuth } from "@/hooks/useAuth"; import { useSemester } from "@/hooks/useSemester"; import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card"; import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Plus, BookOpen, ChevronRight, GraduationCap, Loader2, History, ArrowLeft, RefreshCcw, Search, Trash2, AlertTriangle } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface Discipline { id: string; name: string; professor: string | null; color: string; archived: boolean; is_extra_course: boolean; semester_label: string | null; }

export default function Disciplines({ extraOnly = false }: { extraOnly?: boolean }) {

const { user } = useAuth();

const { currentLabel, setCurrentLabel, loadSemesters, isLoading: isSwapping } = useSemester();

const navigate = useNavigate();

const { toast } = useToast();

const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]); const [loading, setLoading] = useState(true);

const [activeTab, setActiveTab] = useState("active");

const [searchQuery, setSearchQuery] = useState("");

const [open, setOpen] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false); const [isProcessing, setIsProcessing] = useState(false);

const [restoreDialogOpen, setRestoreDialogOpen] = useState(false); const [restoreTargetLabel, setRestoreTargetLabel] = useState(""); const [restorePeriodLabel, setRestorePeriodLabel] = useState("");

const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); const [deleteTargetLabel, setDeleteTargetLabel] = useState("");

const [newName, setNewName] = useState(""); const [newProfessor, setNewProfessor] = useState(""); const [newColor, setNewColor] = useState("#6366F1");

useEffect(() => { if (user) loadDisciplines(); }, [user, extraOnly, currentLabel]);

async function loadDisciplines() {

setLoading(true);

try {

const { data, error } = await supabase .from("disciplines") .select("*") .eq("user_id", user!.id) .eq("is_extra_course", extraOnly) .order("name");

if (error) throw error;

setAllDisciplines(data || []);

} catch (e: any) {

toast({ title: "Erro de Sincronização", description: e.message, variant: "destructive" });

} finally { setLoading(false); }

}

const activeDisciplines = useMemo(() => {

return allDisciplines.filter(d => !d.archived && d.semester_label === currentLabel && d.name.toLowerCase().includes(searchQuery.toLowerCase()) );

}, [allDisciplines, currentLabel, searchQuery]);

const archivedBySemester = useMemo(() => {

const archived = allDisciplines.filter(d => d.archived && d.name.toLowerCase().includes(searchQuery.toLowerCase()) );

const grouped: Record<string, Discipline[]> = {};

archived.forEach(d => {

const sem = d.semester_label || "Sem Período";

if (!grouped[sem]) grouped[sem] = [];

grouped[sem].push(d);

});

return Object.entries(grouped);

}, [allDisciplines, searchQuery]);

async function handleCreate() {

if (!newName.trim()) return;

setIsSubmitting(true);

try {

const { error } = await supabase .from("disciplines") .insert({ user_id: user!.id, name: newName.trim(), professor: newProfessor || null, color: newColor, is_extra_course: extraOnly, semester_label: currentLabel, archived: false });

if (error) throw error;

toast({ title: "Disciplina criada" });

setOpen(false);

setNewName(""); setNewProfessor("");

await loadDisciplines();

} catch (e: any) {

toast({ title: "Erro", description: e.message, variant: "destructive" });

} finally { setIsSubmitting(false); }

}

async function handleRestorePeriod() {

if (!restorePeriodLabel.trim() || !user) return;

setIsProcessing(true);

try {

const newLabel = restorePeriodLabel.trim();

const isNullTarget = restoreTargetLabel === "Sem Período" || !restoreTargetLabel;

console.log("Restaurando período", { target: restoreTargetLabel, novo: newLabel });

let query = supabase .from("disciplines") .update({ archived: false, semester_label: newLabel }) .eq("user_id", user.id) .eq("archived", true) .select();

if (isNullTarget) {

query = query.is("semester_label", null);

} else {

query = query.eq("semester_label", restoreTargetLabel);

}

const { data, error } = await query;

if (error) throw error;

console.log("Linhas restauradas:", data?.length);

await supabase .from("profiles") .update({ current_semester_label: newLabel, updated_at: new Date().toISOString() }) .eq("user_id", user.id);

if (setCurrentLabel) { await setCurrentLabel(newLabel); }

setAllDisciplines([]);

if (loadSemesters) { await loadSemesters(); }

await loadDisciplines();

setActiveTab("active");

setRestoreDialogOpen(false);

toast({ title: "Período restaurado", description: `${data?.length || 0} disciplinas movidas` });

} catch (e: any) {

toast({ title: "Erro na restauração", description: e.message, variant: "destructive" });

} finally {

setIsProcessing(false);

}

}

async function handleDeletePeriod() {

if (!user) return;

setIsProcessing(true);

try {

const isNullTarget = deleteTargetLabel === "Sem Período" || !deleteTargetLabel;

let query = supabase .from("disciplines") .delete() .eq("user_id", user.id) .eq("archived", true);

if (isNullTarget) {

query = query.is("semester_label", null);

} else {

query = query.eq("semester_label", deleteTargetLabel);

}

const { error } = await query;

if (error) throw error;

await loadDisciplines();

toast({ title: "Histórico excluído" });

setDeleteDialogOpen(false);

} catch (e: any) {

toast({ title: "Erro", description: e.message, variant: "destructive" });

} finally {

setIsProcessing(false);

}

}


  if (loading || isSwapping) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const title = extraOnly ? "Cursos Extras" : "Disciplinas";
  const emptyMsg = extraOnly
    ? "Nenhum curso extra cadastrado."
    : "Nenhuma disciplina no período atual.";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground font-semibold">
              {extraOnly ? "Cursos complementares" : `Período ${currentLabel || "—"}`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full font-bold gap-1">
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>
                {extraOnly ? "Novo Curso Extra" : "Nova Disciplina"}
              </DialogTitle>
              <DialogDescription>
                {extraOnly
                  ? "Cadastre um curso complementar."
                  : `Será vinculada ao período ${currentLabel}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Anatomia Humana"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Professor (opcional)</Label>
                <Input
                  value={newProfessor}
                  onChange={(e) => setNewProfessor(e.target.value)}
                  placeholder="Nome do docente"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {["#6366F1","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#8B5CF6","#84CC16"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`h-8 w-8 rounded-full transition-all ${newColor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !newName.trim()}
                className="w-full rounded-full font-bold"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar..."
          className="pl-9 rounded-full bg-muted/40 border-0"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="active" className="flex-1 rounded-full font-bold gap-1.5">
            <GraduationCap className="h-4 w-4" /> Em curso
          </TabsTrigger>
          {!extraOnly && (
            <TabsTrigger value="history" className="flex-1 rounded-full font-bold gap-1.5">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeDisciplines.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">{emptyMsg}</p>
              </CardContent>
            </Card>
          ) : (
            activeDisciplines.map((d) => (
              <Card
                key={d.id}
                onClick={() => navigate(`/disciplines/${d.id}`)}
                className="rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="h-12 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{d.name}</p>
                    {d.professor && (
                      <p className="text-xs text-muted-foreground truncate">
                        {d.professor}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {!extraOnly && (
          <TabsContent value="history" className="space-y-5 mt-4">
            {archivedBySemester.length === 0 ? (
              <Card className="rounded-3xl border-dashed">
                <CardContent className="p-10 text-center text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">Sem histórico arquivado.</p>
                </CardContent>
              </Card>
            ) : (
              archivedBySemester.map(([sem, list]) => (
                <div key={sem} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                      {sem} · {list.length}
                    </h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full text-xs font-bold gap-1"
                        onClick={() => {
                          setRestoreTargetLabel(sem);
                          setRestorePeriodLabel(currentLabel || "");
                          setRestoreDialogOpen(true);
                        }}
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Restaurar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full text-xs font-bold gap-1 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteTargetLabel(sem);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {list.map((d) => (
                    <Card key={d.id} className="rounded-2xl opacity-80">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div
                          className="h-10 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-sm">{d.name}</p>
                          {d.professor && (
                            <p className="text-xs text-muted-foreground truncate">
                              {d.professor}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Restaurar período</DialogTitle>
            <DialogDescription>
              Mover as disciplinas de <strong>{restoreTargetLabel}</strong> para um novo período ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Novo período</Label>
              <Input
                value={restorePeriodLabel}
                onChange={(e) => setRestorePeriodLabel(e.target.value)}
                placeholder="Ex: 2026.1"
              />
            </div>
            <Button
              onClick={handleRestorePeriod}
              disabled={isProcessing || !restorePeriodLabel.trim()}
              className="w-full rounded-full font-bold"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Restaurar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Period Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir histórico
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todas as disciplinas arquivadas de <strong>{deleteTargetLabel}</strong> serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePeriod}
              disabled={isProcessing}
              className="rounded-full bg-destructive hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
