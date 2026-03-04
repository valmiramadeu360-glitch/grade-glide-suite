import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, FileText, Loader2, Check, Printer, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Highlighter, List, ListOrdered, Heading2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Toggle } from "@/components/ui/toggle";

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border/50 bg-muted/20 rounded-t-lg">
      <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("highlight")} onPressedChange={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="h-3.5 w-3.5" />
      </Toggle>
      <div className="w-px bg-border mx-1" />
      <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Toggle>
      <div className="w-px bg-border mx-1" />
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-3.5 w-3.5" />
      </Toggle>
    </div>
  );
}

export function DisciplineNotes({ disciplineId, disciplineName }: { disciplineId: string; disciplineName?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px]",
      },
    },
  });

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
    if (!user) return;
    const { data, error } = await supabase.from("notes").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title: "Nova anotação " + format(new Date(), "dd/MM"),
      content: "",
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
    editor?.commands.setContent(note.content ?? "");
    setLastSaved(null);
  }

  async function saveNote() {
    if (!selected || !user || !editor) return;
    setSaving(true);

    const htmlContent = editor.getHTML();
    const { error } = await supabase
      .from("notes")
      .update({
        title: title.trim() || "Sem título",
        content: htmlContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (!error) {
      setLastSaved(new Date());
      setNotes(notes.map(n => n.id === selected.id ? { ...n, title, content: htmlContent, updated_at: new Date().toISOString() } : n));
    }
    setSaving(false);
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Deseja excluir esta nota?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) {
      setNotes(notes.filter(n => n.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setTitle("");
        editor?.commands.setContent("");
      }
      toast({ title: "Nota excluída" });
    }
  }

  function printNote() {
    if (!editor || !selected) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 2cm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.8; font-size: 12pt; }
            .header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 24px; }
            .header h1 { font-size: 18pt; font-weight: 800; margin: 0; }
            .header p { font-size: 10pt; color: #666; margin: 4px 0 0; }
            h2 { font-size: 14pt; font-weight: 700; margin: 16px 0 8px; }
            h3 { font-size: 12pt; font-weight: 600; margin: 12px 0 6px; }
            ul { list-style: disc; padding-left: 24px; }
            ol { list-style: decimal; padding-left: 24px; }
            blockquote { border-left: 3px solid #333; padding-left: 12px; color: #555; font-style: italic; }
            mark { background-color: #fef08a; padding: 1px 4px; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 10pt; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>${disciplineName ? `Disciplina: ${disciplineName} · ` : ""}Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
          ${editor.getHTML()}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-[500px]">
      {/* Notes list */}
      <Card className="glass-card lg:col-span-1 overflow-hidden flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-base">Meus Resumos</CardTitle>
          <Button size="sm" variant="outline" onClick={createNote} className="h-8">
            <Plus className="mr-1 h-3 w-3" /> Nova
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 overflow-y-auto flex-1 pr-2">
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

      {/* Editor */}
      <Card className="glass-card lg:col-span-2 flex flex-col overflow-hidden">
        <CardContent className="pt-6 flex-1 flex flex-col space-y-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 placeholder:opacity-30"
                    placeholder="Título do resumo..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  {saving ? (
                    <span className="text-[10px] flex items-center text-muted-foreground animate-pulse">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> SALVANDO...
                    </span>
                  ) : lastSaved && (
                    <span className="text-[10px] flex items-center text-emerald-500 font-medium">
                      <Check className="mr-1 h-3 w-3" /> SALVO
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={printNote} title="Imprimir A4">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={saveNote} disabled={saving} className="shadow-md">
                    <Save className="mr-2 h-4 w-4" /> Salvar
                  </Button>
                </div>
              </div>

              <div className="flex-1 border border-border/50 rounded-lg overflow-hidden tiptap-editor bg-muted/10">
                <EditorToolbar editor={editor} />
                <EditorContent editor={editor} />
              </div>
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
