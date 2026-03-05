import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, FileText, Loader2, Check, Printer, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Highlighter, List, ListOrdered, Heading2, Cloud } from "lucide-react";
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

// Paleta expandida de cores para marca-texto (Pastéis e Neons)
const HIGHLIGHT_COLORS = [
  // Pastéis
  { label: "Amarelo Pastel", color: "#fef08a" },
  { label: "Verde Pastel", color: "#bbf7d0" },
  { label: "Azul Pastel", color: "#bfdbfe" },
  { label: "Rosa Pastel", color: "#fbcfe8" },
  { label: "Lilás Pastel", color: "#e9d5ff" },
  { label: "Pêssego", color: "#ffedd5" },
  // Neons
  { label: "Amarelo Neon", color: "#faff00" },
  { label: "Verde Neon", color: "#39ff14" },
  { label: "Ciano Neon", color: "#00ffff" },
  { label: "Rosa Neon", color: "#ff10f0" },
  { label: "Roxo Neon", color: "#b026ff" },
  { label: "Laranja Neon", color: "#ff6600" },
];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border/50 bg-muted/20 rounded-t-lg items-center">
      <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Cores do Marca-Texto */}
      <div className="flex flex-wrap gap-1 px-1">
        {HIGHLIGHT_COLORS.map((h) => (
          <button
            key={h.color}
            title={h.label}
            className="h-6 w-6 rounded-md flex items-center justify-center hover:scale-110 hover:shadow-md transition-all border border-transparent hover:border-foreground/20"
            style={{ backgroundColor: h.color }}
            onClick={() => editor.chain().focus().toggleHighlight({ color: h.color }).run()}
          >
            <Highlighter className="h-3 w-3 opacity-60 mix-blend-multiply" />
          </button>
        ))}
        {/* Botão para remover o marca texto */}
        <button
          title="Remover Marca-texto"
          className="h-6 w-6 rounded-md flex items-center justify-center bg-background border border-border hover:bg-muted transition-all"
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        >
          <Highlighter className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />
      <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <div className="w-px h-6 bg-border mx-1" />
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify className="h-4 w-4" />
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
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSubtitle, setPrintSubtitle] = useState("");
  
  // Controle de estado para o Auto-save
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para garantir que o auto-save sempre pegue a nota correta
  const selectedRef = useRef<Note | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      const currentNote = selectedRef.current;
      if (!currentNote || !user) return;

      const htmlContent = editor.getHTML();
      setAutoSaveStatus("saving");

      // Limpa o timer anterior se o usuário continuar digitando
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Configura um novo timer de 1.5 segundos
      typingTimeoutRef.current = setTimeout(async () => {
        const { error } = await supabase
          .from("notes")
          .update({
            content: htmlContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentNote.id);

        if (!error) {
          setAutoSaveStatus("saved");
          setLastSaved(new Date());
          
          // Atualiza a lista local silenciosamente
          setNotes(prevNotes => prevNotes.map(n => 
            n.id === currentNote.id ? { ...n, content: htmlContent, updated_at: new Date().toISOString() } : n
          ));
          
          // Volta o status para idle depois de 2 segundos
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        } else {
          setAutoSaveStatus("idle");
        }
      }, 1500);
    }
  });

  useEffect(() => {
    loadNotes();
    
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
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
      title: "Novo Resumo - " + format(new Date(), "dd/MM"),
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
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setAutoSaveStatus("idle");
    setSelected(note);
    setTitle(note.title);
    editor?.commands.setContent(note.content ?? "");
    setLastSaved(null);
  }

  // Salvamento manual pelo botão "Salvar"
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
      toast({ title: "Salvo com sucesso!" });
    }
    setSaving(false);
  }

  async function saveTitleOnBlur() {
    if (!selected || !user) return;
    const newTitle = title.trim() || "Sem título";
    await supabase.from("notes").update({ title: newTitle }).eq("id", selected.id);
    setNotes(notes.map(n => n.id === selected.id ? { ...n, title: newTitle } : n));
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Deseja excluir esta nota permanentemente?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) {
      setNotes(notes.filter(n => n.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setTitle("");
        editor?.commands.setContent("");
      }
      toast({ title: "Resumo excluído" });
    }
  }

  function openPrintDialog() {
    setPrintSubtitle("");
    setPrintDialogOpen(true);
  }

  function printNote() {
    if (!editor || !selected) return;
    setPrintDialogOpen(false);

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
            .header .subtitle { font-size: 12pt; font-weight: 600; color: #444; margin: 6px 0 0; }
            .header p { font-size: 10pt; color: #666; margin: 4px 0 0; }
            h2 { font-size: 14pt; font-weight: 700; margin: 16px 0 8px; }
            h3 { font-size: 12pt; font-weight: 600; margin: 12px 0 6px; }
            ul { list-style: disc; padding-left: 24px; }
            ol { list-style: decimal; padding-left: 24px; }
            blockquote { border-left: 3px solid #333; padding-left: 12px; color: #555; font-style: italic; }
            mark { padding: 1px 4px; border-radius: 2px; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 10pt; }
            p[style*="text-align: justify"] { text-align: justify !important; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            ${printSubtitle ? `<div class="subtitle">${printSubtitle}</div>` : ""}
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
    <>
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="font-black">Configuração de Impressão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Subtítulo do Documento</Label>
              <Input
                value={printSubtitle}
                onChange={e => setPrintSubtitle(e.target.value)}
                placeholder="Ex: Resumo para P1"
                className="h-12 rounded-xl"
                onKeyDown={e => e.key === "Enter" && printNote()}
              />
            </div>
            <Button onClick={printNote} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs">
              <Printer className="mr-2 h-4 w-4" /> Imprimir Documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px]">
        {/* Lista de Resumos */}
        <Card className="glass-card border-none shadow-sm lg:col-span-1 overflow-hidden flex flex-col bg-card rounded-[32px]">
          <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between shrink-0 border-b border-border/40">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Meus Resumos</CardTitle>
            <Button size="sm" onClick={createNote} className="h-8 rounded-lg shadow-sm font-bold text-[10px] uppercase tracking-widest">
              <Plus className="mr-1 h-3 w-3" /> Novo
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
            {notes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-xs font-medium text-muted-foreground">Nenhuma anotação criada.</p>
              </div>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                className={`flex items-center gap-4 rounded-2xl p-3 cursor-pointer group transition-all border ${
                  selected?.id === note.id ? "bg-primary/5 border-primary/30 shadow-sm" : "border-transparent hover:bg-muted/50 hover:border-border/50"
                }`}
                onClick={() => selectNote(note)}
              >
                <div className={`p-2.5 rounded-xl transition-colors ${selected?.id === note.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground group-hover:bg-background"}`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate transition-colors ${selected?.id === note.id ? "text-primary" : "text-foreground"}`}>{note.title}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-0.5">
                    {format(new Date(note.updated_at), "dd MMM · HH:mm")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Editor de Texto */}
        <Card className="glass-card border-none shadow-md lg:col-span-2 flex flex-col overflow-hidden bg-card rounded-[32px]">
          <CardContent className="p-0 flex-1 flex flex-col">
            {selected ? (
              <div className="flex-1 flex flex-col h-full">
                {/* Header do Editor */}
                <div className="flex items-center justify-between flex-wrap gap-4 p-6 border-b border-border/40 bg-muted/10">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveTitleOnBlur}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTitleOnBlur(); }}
                      className="text-2xl font-black border-none bg-transparent px-0 focus-visible:ring-0 placeholder:opacity-30 h-auto"
                      placeholder="Título do resumo..."
                    />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Indicadores de Salvamento Automático */}
                    <div className="hidden sm:flex items-center mr-2">
                      {autoSaveStatus === "saving" || saving ? (
                        <span className="text-[10px] flex items-center gap-1.5 text-primary font-black uppercase tracking-widest animate-pulse">
                          <Cloud className="h-3 w-3" /> Salvando...
                        </span>
                      ) : autoSaveStatus === "saved" || lastSaved ? (
                        <span className="text-[10px] flex items-center gap-1.5 text-emerald-500 font-black uppercase tracking-widest">
                          <Check className="h-3 w-3" /> Salvo na nuvem
                        </span>
                      ) : null}
                    </div>

                    <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={openPrintDialog} title="Imprimir Resumo">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={saveNote} disabled={saving || autoSaveStatus === "saving"} className="h-10 px-5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                  </div>
                </div>

                {/* Área do Editor */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <EditorToolbar editor={editor} />
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/50">
                    <EditorContent editor={editor} className="min-h-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 bg-muted/5">
                <div className="bg-card p-6 rounded-3xl mb-6 shadow-sm border border-border/50">
                  <FileText className="h-12 w-12 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-black text-foreground">Editor de Resumos</h3>
                <p className="text-sm text-center mt-2 font-medium max-w-xs">
                  Selecione uma anotação na lateral ou crie um novo resumo para começar a digitar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
