import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, FileText, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { debounce } from "lodash"; // Certifique-se que lodash está instalado ou use o setTimeout abaixo

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

  useEffect(() => {
    loadNotes();
  }, [disciplineId]);

  // Carrega as notas do banco
  async function loadNotes() {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("updated_at", { ascending: false });
    setNotes(data ?? []);
  }

  // Cria uma nota nova
  async function createNote() {
    if (!user) return;
    const { data, error } = await supabase.from("notes").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title: "Nova anotação " + format(new Date(), "dd/MM"),
      content: ""
    }).select().single();

    if (error) {
      toast({ title: "Erro ao criar nota", variant: "destructive" });
      return;
    }

    if (data) {
      const newNote = data as Note;
      setNotes([newNote, ...notes]);
      selectNote(newNote);
    }
  }

  function selectNote(note: Note) {
    setSelected(note);
    setTitle(note.title);
    setContent(note.content ?? "");
    setLastSaved(null);
  }

  // Função de salvar
  async function saveNote() {
    if (!selected || !user) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("notes")
      .update({ 
        title: title.trim() || "Sem título", 
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", selected.id);

    if (!error) {
      setLastSaved(new Date());
      // Atualiza a lista lateral sem recarregar tudo
      setNotes(notes.map(n => n.id === selected.id ? { ...n, title, content, updated_at: new Date().toISOString() } : n));
    }
    setSaving(false);
  }

  // Deleta a nota
  async function deleteNote(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) {
      setNotes(notes.filter(n => n.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setTitle("");
        setContent("");
      }
      toast({ title: "Nota excluída" });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-[500px]">
      {/* Lista de Notas Lateral */}
      <Card className="glass-card lg:col-span-1 overflow-hidden flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-base">Meus Resumos</CardTitle>
          <Button size="sm" variant="outline" onClick={createNote} className="h-8">
            <Plus className="mr-1 h-3 w-3" /> Nova
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma nota por aqui.</p>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer group transition-all border border-transparent ${
                selected?.id === note.id ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50"
              }`}
              onClick={() => selectNote(note)}
            >
              <div className={`p-2 rounded-md ${selected?.id === note.id ? "bg-primary/20" : "bg-muted"}`}>
                <FileText className={`h-4 w-4 ${selected?.id === note.id ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{note.title}</p>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {format(new Date(note.updated_at), "dd MMM · HH:mm")}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editor de Texto */}
      <Card className="glass-card lg:col-span-2 flex flex-col overflow-hidden">
        <CardContent className="pt-6 flex-1 flex flex-col space-y-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex-1">
                   <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 placeholder:opacity-30"
                    placeholder="Título do resumo..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  {saving ? (
                    <span className="text-[10px] flex items-center text-muted-foreground animate-pulse">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> SALVANDO...
                    </span>
                  ) : lastSaved && (
                    <span className="text-[10px] flex items-center text-emerald-500 font-medium">
                      <Check className="mr-1 h-3 w-3" /> SALVO
                    </span>
                  )}
                  <Button size="sm" onClick={saveNote} disabled={saving} className="shadow-md">
                    <Save className="mr-2 h-4 w-4" /> Salvar
                  </Button>
                </div>
              </div>
              
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 min-h-[400px] resize-none border-none bg-muted/20 p-4 focus-visible:ring-1 focus-visible:ring-primary/20 leading-relaxed text-base"
                placeholder="Comece a escrever seu resumo da aula aqui..."
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
              <div className="bg-muted/30 p-6 rounded-full mb-4">
                <FileText className="h-12 w-12 opacity-20" />
              </div>
              <h3 className="font-medium text-foreground">Editor de Resumos</h3>
              <p className="text-sm max-w-[250px] text-center mt-1">
                Selecione uma nota ao lado ou crie uma nova para começar a estudar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
