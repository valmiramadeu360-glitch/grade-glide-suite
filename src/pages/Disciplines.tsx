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

toast({ title: "Período restaurado", description: ${data?.length || 0} disciplinas movidas });

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

const renderCard = (d: Discipline) => (

<Card key={d.id} onClick={() => navigate(/disciplines/${d.id})} className="cursor-pointer"

{extraOnly ? <GraduationCap style={{ color: d.color }} /> : <BookOpen style={{ color: d.color }} /> }

{d.name} 

{d.professor || "Professor não informado"} 

);

if (loading || isSwapping) {

return (

);

}

return (

<Button variant="ghost" size="icon" onClick={() => navigate(-1)}

{extraOnly ? "Cursos Extras" : "Disciplinas"} 

Período atual: {currentLabel} 

Novo Registro Nova Disciplina Adicionar ao período {currentLabel} 

<Input placeholder="Nome da disciplina" value={newName} onChange={e => setNewName(e.target.value)} />

<Input placeholder="Professor" value={newProfessor} onChange={e => setNewProfessor(e.target.value)} />

<Button onClick={handleCreate} disabled={isSubmitting} className="w-full"

{isSubmitting ? : "Salvar"}

<Input placeholder="Buscar disciplina" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />

Em Curso Histórico 

{activeDisciplines.length === 0 ?

Nenhuma disciplina ativa 

:

{activeDisciplines.map(renderCard)} 

}

{archivedBySemester.map(([label, items]) => (

{label} 

<Button variant="outline" onClick={() => { setRestoreTargetLabel(label); setRestorePeriodLabel(label === "Sem Período" ? "" : label); setRestoreDialogOpen(true); }}

Restaurar 

<Button variant="destructive" onClick={() => { setDeleteTargetLabel(label); setDeleteDialogOpen(true); }}

{items.map(renderCard)} 

))}

);

}


