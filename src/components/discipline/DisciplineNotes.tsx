import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, FileText, Loader2, Check, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

export function DisciplineNotes({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (disciplineId) {
      loadNotes();
    }
  }, [disciplineId]);

  async function loadNotes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("discipline_id", disciplineId)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      setNotes(data ?? []);
    } catch (err) {
      console.error("Erro ao carregar notas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createNote() {
    if (!user || !disciplineId) return;
    try {
      const { data, error } = await supabase.from("notes").insert({
        discipline_id: disciplineId,
        user_id: user.id,
        title: "Resumo - " + format(new Date(), "dd/MM"),
        content: ""
      }).select().single();

      if (error) throw error;

      if (data) {
        const newNote = data as Note;
        setNotes([newNote, ...notes]);
        selectNote(newNote);
      }
    } catch (err) {
      toast({ title: "Erro ao criar nota", variant: "destructive" });
    }
  }

  function selectNote(note: Note) {
    setSelected(note);
    setTitle(note.title);
    setContent(note.content ?? "");
    setLastSaved(null);
  }

  async function saveNote() {
    if (!selected || !user) return;
    try {
      setSaving(true);
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from("notes")
        .update({ 
          title: title.trim() || "Sem título", 
          content,
          updated_at: now
        })
        .eq("id", selected.id);

      if (error) throw error;

      setLastSaved(new Date());
      setNotes(notes.map(n => n.id === selected.id ? { ...n, title, content, updated_at: now } : n));
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Deseja apagar este resumo permanentemente?")) return;
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
      
      setNotes(notes.filter(n => n.id !== id));
      if (selected?.id === id) {
        setSelected(null);
      }
      toast({ title: "Nota excluída" });
    } catch (err) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 min-h-[500px] h-[calc(100vh-350px)]">
      {/* Lista de Notas Lateral - Esconde no mobile se uma nota estiver selecionada */}
      <Card className={`glass-card lg:col-span-1 overflow-hidden flex flex-col rounded-[32px] border-none shadow-xl bg-card/60 ${selected ? 'hidden lg:flex' : 'flex'}`}>
        <CardHeader className="pb-4 pt-6 flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Meus Resumos</CardTitle>
          <Button size="icon" variant="ghost" onClick={createNote} className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20">
            <Plus className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto flex-1 px-4 pb-6 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" /></div>
          ) : notes.length === 0 ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center py-12 opacity-30">Vazio</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`flex items-center gap-3 rounded-2xl p-4 cursor-pointer transition-all border ${
                  selected?.id === note.id ? "bg-card border-primary/30 shadow-md" : "hover:bg-muted/10 border-transparent"
                } group`}
                onClick={() => selectNote(note)}
              >
                <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${selected?.id === note.id ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{note.title}</p>
                  <p className="text-[10px] font-black uppercase opacity-40">
                    {format(new Date(note.updated_at), "dd MMM")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Editor de Texto */}
      <Card className={`glass-card lg:col-span-2 flex flex-col overflow-hidden rounded-[32px] border-none shadow-xl bg-card/60 ${!selected ? 'hidden lg:flex' : 'flex'}`}>
        <CardContent className="pt-6 flex-1 flex flex-col px-6">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-6 gap-4">
                <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10 rounded-xl" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="flex-1">
                   <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-black border-none bg-transparent px-0 focus-visible:ring-0 placeholder:opacity-20 tracking-tighter"
                    placeholder="Título do resumo..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : lastSaved && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                  <Button size="sm" onClick={saveNote} disabled={saving} className="rounded-xl px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                    Salvar
                  </Button>
                </div>
              </div>
              
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 min-h-[300px] resize-none border-none bg-muted/20 rounded-3xl p-6 focus-visible:ring-0 leading-relaxed text-sm font-medium text-foreground/80 scrollbar-hide"
                placeholder="Desenvolva seu raciocínio aqui..."
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 animate-pulse">
              <FileText className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">Selecione um resumo</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
