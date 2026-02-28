import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, FileText } from "lucide-react";
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

  useEffect(() => {
    loadNotes();
  }, [disciplineId]);

  async function loadNotes() {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("updated_at", { ascending: false });
    setNotes(data ?? []);
  }

  async function createNote() {
    const { data } = await supabase.from("notes").insert({
      discipline_id: disciplineId,
      user_id: user!.id,
      title: "Nova anotação",
    }).select().single();
    if (data) {
      await loadNotes();
      selectNote(data as Note);
    }
  }

  function selectNote(note: Note) {
    setSelected(note);
    setTitle(note.title);
    setContent(note.content ?? "");
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("notes").update({ title, content }).eq("id", selected.id);
    toast({ title: "Nota salva!" });
    setSaving(false);
    loadNotes();
  }

  async function deleteNote(id: string) {
    await supabase.from("notes").delete().eq("id", id);
    if (selected?.id === id) {
      setSelected(null);
      setTitle("");
      setContent("");
    }
    loadNotes();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Notes list */}
      <Card className="glass-card lg:col-span-1">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Anotações</CardTitle>
          <Button size="sm" variant="outline" onClick={createNote}>
            <Plus className="mr-1 h-3 w-3" /> Nova
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anotação.</p>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer group transition-colors ${
                selected?.id === note.id ? "bg-primary/10" : "hover:bg-muted/50"
              }`}
              onClick={() => selectNote(note)}
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(note.updated_at), "dd/MM HH:mm")}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="glass-card lg:col-span-2">
        <CardContent className="pt-6">
          {selected ? (
            <div className="space-y-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-none bg-transparent px-0 focus-visible:ring-0"
                placeholder="Título da nota"
              />
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] resize-none"
                placeholder="Escreva suas anotações aqui..."
              />
              <Button onClick={saveNote} disabled={saving}>
                <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Selecione ou crie uma nota</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
