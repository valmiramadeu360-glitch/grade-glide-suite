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
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

const HIGHLIGHT_COLORS = [
  { label: "Amarelo Pastel", color: "#fef08a" },
  { label: "Verde Pastel", color: "#bbf7d0" },
  { label: "Azul Pastel", color: "#bfdbfe" },
  { label: "Rosa Pastel", color: "#fbcfe8" },
  { label: "Lilás Pastel", color: "#e9d5ff" },
  { label: "Amarelo Neon", color: "#faff00" },
  { label: "Verde Neon", color: "#39ff14" },
  { label: "Ciano Neon", color: "#00ffff" },
  { label: "Rosa Neon", color: "#ff10f0" },
  { label: "Roxo Neon", color: "#b026ff" },
];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    // Transformado em uma barra rolável horizontalmente no mobile para economizar espaço de digitação
    <div className="flex gap-1 p-2 border-b border-border/50 bg-muted/20 items-center overflow-x-auto no-scrollbar touch-pan-x w-full">
      <div className="flex items-center gap-1 shrink-0">
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-1 shrink-0" />
      
      <div className="flex items-center gap-1.5 shrink-0 px-1 bg-background border border-border/40 rounded-xl p-1">
        {HIGHLIGHT_COLORS.map((h) => (
          <button
            key={h.color}
            title={h.label}
            className="h-7 w-7 rounded-[8px] flex items-center justify-center hover:scale-110 hover:shadow-md transition-all border border-border/50 shadow-sm"
            style={{ backgroundColor: h.color }}
            onClick={() => editor.chain().focus().toggleHighlight({ color: h.color }).run()}
          >
            <Highlighter className="h-3.5 w-3.5 opacity-60 mix-blend-multiply text-black" />
          </button>
        ))}
        <button
          title="Remover Cor"
          className="h-7 w-7 rounded-[8px] flex items-center justify-center bg-card border border-border hover:bg-muted transition-all ml-1"
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        >
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="w-px h-6 bg-border/50 mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0 pr-2">
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="h-4 w-4" />
        </Toggle>
      </div>
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
  
  // Impressão
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSubtitle, setPrintSubtitle] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Auto-save
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[500px] p-6 max-w-none text-foreground bg-background",
      },
    },
    onUpdate: ({ editor }) => {
      const currentNote = selectedRef.current;
      if (!currentNote || !user) return;

      const htmlContent = editor.getHTML();
      setAutoSaveStatus("saving");

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

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
          setNotes(prevNotes => prevNotes.map(n => 
            n.id === currentNote.id ? { ...n, content: htmlContent, updated_at: new Date().toISOString() } : n
          ));
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
    const newTitle = "Novo Resumo - " + format(new Date(), "dd/MM");
    const { data, error } = await supabase.from("notes").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title: newTitle,
      content: "",
    }).select().single();

    if (error) {
      toast({ title: "Erro ao criar", variant: "destructive" });
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
    if (!window.confirm("Deseja excluir este resumo permanentemente?")) return;
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

  // Solução Anti-Crash PWA (iFrame Printing)
  function printNote() {
    if (!editor || !selected) return;
    setIsPrinting(true);
    
    // Cria um iframe invisível anexado ao corpo da página
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const contentWindow = iframe.contentWindow;
    if (!contentWindow) {
        setIsPrinting(false);
        toast({ title: "Erro no sistema de impressão.", variant: "destructive" });
        return;
    }

    // Injeta o HTML Formatado no iFrame
    contentWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #000; line-height: 1.6; font-size: 11pt; padding: 0; margin: 0; }
            .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
            .header h1 { font-size: 20pt; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .header .subtitle { font-size: 12pt; font-weight: 600; color: #444; margin: 8px 0 0; }
            .header p { font-size: 9pt; color: #666; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px;}
            h2 { font-size: 14pt; font-weight: 700; margin: 24px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
            h3 { font-size: 12pt; font-weight: 600; margin: 16px 0 8px; }
            p { margin-bottom: 12px; }
            ul { list-style: disc; padding-left: 20px; margin-bottom: 12px; }
            ol { list-style: decimal; padding-left: 20px; margin-bottom: 12px; }
            blockquote { border-left: 4px solid #000; padding-left: 12px; color: #333; font-style: italic; margin: 16px 0; background: #f9f9f9; padding: 8px 12px;}
            mark { padding: 2px 4px; border-radius: 3px; font-weight: 500; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 10pt; border: 1px solid #e2e8f0;}
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-justify { text-align: justify; }
            img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            ${printSubtitle ? `<div class="subtitle">${printSubtitle}</div>` : ""}
            <p>${disciplineName ? `Disciplina: ${disciplineName} • ` : ""}Impresso em ${format(new Date(), "dd/MM/yyyy")}</p>
          </div>
          <div class="content">
            ${editor.getHTML()}
          </div>
        </body>
      </html>
    `);
    
    contentWindow.document.close();
    contentWindow.focus();

    // Pequeno delay para garantir que o renderizador HTML processe o iframe antes de imprimir
    setTimeout(() => {
        try {
            contentWindow.print();
        } catch (e) {
            console.error("Erro ao invocar impressão", e);
        } finally {
            // Remove o iframe invisível depois que a caixa de impressão for fechada
            setTimeout(() => {
                document.body.removeChild(iframe);
                setIsPrinting(false);
                setPrintDialogOpen(false);
            }, 1000);
        }
    }, 500);
  }

  return (
    <>
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[400px] rounded-[32px] bg-card border-border p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-black text-foreground">Gerar PDF (A4)</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground mt-1">Configure o cabeçalho do seu documento antes de imprimir ou salvar como PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Subtítulo (Opcional)</Label>
              <Input
                value={printSubtitle}
                onChange={e => setPrintSubtitle(e.target.value)}
                placeholder="Ex: Resumo Final para P1"
                className="h-14 rounded-2xl bg-background border-border text-base font-bold focus:ring-primary/20"
                onKeyDown={e => e.key === "Enter" && printNote()}
              />
            </div>
            <Button onClick={printNote} disabled={isPrinting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20">
              {isPrinting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
              {isPrinting ? "Gerando Arquivo..." : "Continuar para Impressão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[70vh] animate-in fade-in duration-500">
        
        {/* Painel Esquerdo: Lista de Resumos */}
        <Card className="glass-card border-none shadow-sm lg:col-span-1 overflow-hidden flex flex-col bg-card rounded-[32px]">
          <CardHeader className="pb-5 pt-6 px-6 sm:px-8 flex flex-row items-center justify-between shrink-0 border-b border-border/40">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Meu Caderno</CardTitle>
            <Button size="icon" onClick={createNote} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
            {notes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[24px] bg-background">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-xs font-medium text-muted-foreground max-w-[200px]">Seu caderno está vazio. Crie uma nota para começar.</p>
              </div>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "flex items-center gap-4 rounded-2xl p-4 sm:p-5 cursor-pointer group transition-all border",
                  selected?.id === note.id ? "bg-primary/10 border-primary/30 shadow-sm" : "bg-background border-border/50 hover:border-primary/40 hover:shadow-md"
                )}
                onClick={() => selectNote(note)}
              >
                <div className={cn(
                  "p-3 rounded-xl transition-colors shrink-0",
                  selected?.id === note.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-base font-black truncate transition-colors leading-tight", selected?.id === note.id ? "text-primary" : "text-foreground group-hover:text-primary")}>{note.title}</p>
                  <p className="text-[10px] text-muted-foreground font-bold mt-1">
                    Modificado: {format(new Date(note.updated_at), "dd MMM")}
                  </p>
                </div>
                {/* Lixeira oculta até o hover no desktop, visível no ativo no mobile */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0 transition-opacity",
                    selected?.id === note.id ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"
                  )}
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Painel Direito: Editor Inteligente */}
        <Card className="glass-card border-border/50 shadow-lg lg:col-span-2 flex flex-col overflow-hidden bg-card rounded-[32px]">
          <CardContent className="p-0 flex-1 flex flex-col">
            {selected ? (
              <div className="flex-1 flex flex-col h-full">
                
                {/* Header Dinâmico do Editor */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-border/60 bg-muted/10 shrink-0">
                  <div className="flex-1 min-w-0 w-full">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveTitleOnBlur}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTitleOnBlur(); }}
                      className="text-2xl sm:text-3xl font-black border-none bg-transparent px-0 focus-visible:ring-0 placeholder:opacity-30 h-auto truncate text-foreground"
                      placeholder="Sem título..."
                    />
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
                    <div className="flex items-center">
                      {autoSaveStatus === "saving" || saving ? (
                        <span className="text-[10px] flex items-center gap-1.5 text-primary font-black uppercase tracking-widest animate-pulse">
                          <Cloud className="h-3.5 w-3.5" /> Salvando
                        </span>
                      ) : autoSaveStatus === "saved" || lastSaved ? (
                        <span className="text-[10px] flex items-center gap-1.5 text-emerald-500 font-black uppercase tracking-widest">
                          <Check className="h-3.5 w-3.5" /> Salvo
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-12 w-12 rounded-xl bg-background border-border/50 shadow-sm" onClick={openPrintDialog} title="Imprimir PDF">
                        <Printer className="h-5 w-5" />
                      </Button>
                      <Button onClick={saveNote} disabled={saving || autoSaveStatus === "saving"} className="h-12 px-6 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Save className="mr-2 h-4 w-4" /> Salvar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Container do Editor */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <EditorToolbar editor={editor} />
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                    <EditorContent editor={editor} className="h-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 px-6">
                <div className="h-24 w-24 bg-muted/30 rounded-[32px] flex items-center justify-center mb-6 shadow-inner border border-border/50">
                  <FileText className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-black text-foreground">Editor Inteligente</h3>
                <p className="text-sm text-center mt-3 font-medium max-w-[300px] leading-relaxed">
                  Selecione um resumo na lista ao lado ou crie uma nova página para iniciar seu caderno virtual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
