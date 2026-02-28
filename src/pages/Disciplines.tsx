import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  useEffect(() => {
    if (user) loadDisciplines();
  }, [user]);

  async function loadDisciplines() {
    const { data } = await supabase
      .from("disciplines")
      .select("*")
      .eq("is_extra_course", extraOnly)
      .order("name");
    setDisciplines(data ?? []);
    setLoading(false);
  }

  async function createDiscipline() {
    if (!newName.trim()) return;
    const { error } = await supabase.from("disciplines").insert({
      user_id: user!.id,
      name: newName.trim(),
      professor: newProfessor.trim() || null,
      color: newColor,
      is_extra_course: extraOnly,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    setNewProfessor("");
    setOpen(false);
    loadDisciplines();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {extraOnly ? "Cursos Extras" : "Disciplinas"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {extraOnly ? "Cursos fora da grade regular" : "Suas matérias do semestre"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova {extraOnly ? "Curso Extra" : "Disciplina"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Cálculo I" />
              </div>
              <div className="space-y-2">
                <Label>Professor</Label>
                <Input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} placeholder="Nome do professor" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${newColor === c ? "scale-110 border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={createDiscipline} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {disciplines.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma disciplina cadastrada.</p>
            <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar primeira
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {disciplines.map((d) => (
            <Card
              key={d.id}
              className="glass-card cursor-pointer hover:shadow-md transition-all group"
              onClick={() => navigate(`/disciplines/${d.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: d.color + "20" }}>
                      <BookOpen className="h-5 w-5" style={{ color: d.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{d.name}</h3>
                      {d.professor && (
                        <p className="text-xs text-muted-foreground">{d.professor}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                {d.current_grade !== null && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Média: <span className="font-semibold text-foreground">{d.current_grade}</span></p>
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
