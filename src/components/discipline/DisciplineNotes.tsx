import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Plus, Trash2, Save, FileText, Loader2, Check, 
  Printer, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignJustify, Highlighter, 
  List, ListOrdered, Heading2, Cloud, RefreshCw,
  Search, ExternalLink
} from "lucide-react";
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
  { label: "Amarelo", color: "#fef08a" },
  { label: "Verde", color: "#bbf7d0" },
  { label: "Azul", color: "#bfdbfe" },
  { label: "Rosa", color: "#fbcfe8" },
  { label: "Neon", color: "#39ff14" },
];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex gap-1 p-3 border-b border-border/40 bg-muted/10 items-center overflow-x-auto no-scrollbar touch-pan-x w-full">
      <div className="flex items-center gap-1 shrink-0">
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />
      
      <div className="flex items-center gap-1.5 shrink-0 px-2 bg-background border border-border/40 rounded-xl py-1">
        {HIGHLIGHT_COLORS.map((h) => (
          <button
            key={h.color}
            className="h-7 w-7 rounded-lg border border-black/5 shadow-sm transition-transform active:scale-90"
            style={{ backgroundColor: h.color }}
            onClick={() => editor.chain().focus().toggleHighlight({ color: h.color }).run()}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <Toggle size="sm" className="h-10 w-10 rounded-xl" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}>
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSubtitle, setPrintSubtitle] = useState("");
  
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRef = useRef<Note | null>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[60vh] p-8 max-w-none text-foreground font-medium",
      },
    },
    onUpdate: ({ editor }) => {
      if (!selectedRef.current || !user) return;
      const html = editor.getHTML();
      setAutoSaveStatus("saving");

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        const { error } = await supabase
          .from("notes")
          .update({ content: html, updated_at: new Date().toISOString() })
          .eq("id", selectedRef.current?.id);

        if (!error) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        }
      }, 1500);
    }
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
      title: "Novo Resumo - " + format(new Date(), "dd/MM"),
      content: "",
    }).select().single();

    if (data) {
      setNotes([data, ...notes]);
      handleSelect(data);
    }
  }

  function handleSelect(note: Note) {
    setSelected(note);
    setTitle(note.title);
    editor?.commands.setContent(note.content ?? "");
    setAutoSaveStatus("idle");
  }

  // CORE: Solução Anti-Crash Android 15 (Impressão em Nova Aba)
  const handlePrint = () => {
    if (!editor || !selected) return;
    setIsPrinting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up bloqueado", description: "Habilite pop-ups para imprimir.", variant: "destructive" });
      setIsPrinting(false);
      return;
    }

    const htmlContent = editor.getHTML();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EduFlow - ${title}</title>
          <style>
            @page { size: A4; margin: 25mm; }
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; padding: 0; margin: 0; }
            .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-size: 24pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -1px; }
            .header p { font-size: 10pt; font-weight: 700; color: #666; margin: 5px 0 0; text-transform: uppercase; letter-spacing: 2px; }
            .content { font-size: 11pt; text-align: justify; }
            mark { background-color: #fef08a; padding: 2px 4px; border-radius: 4px; }
            h2 { font-size: 16pt; font-weight: 800; margin-top: 30px; border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            ${printSubtitle ? `<p style="color:#3b82f6">${printSubtitle}</p>` : ''}
            <p>${disciplineName || 'Módulo Acadêmico'} • ${format(new Date(), "dd/MM/yyyy")}</p>
          </div>
          <div class="content">${htmlContent}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Pequeno delay para renderização do WebView antes do print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
      setPrintDialogOpen(false);
    }, 500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[70vh] pb-24">
      
      {/* Diálogo de Impressão com Fundo Sólido */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="bg-card border-border shadow-2xl rounded-[32px] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Exportar Documento</DialogTitle>
            <DialogDescription>Configure o cabeçalho para o arquivo A4.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subtítulo do PDF</Label>
              <Input 
                value={printSubtitle} 
                onChange={e => setPrintSubtitle(e.target.value)}
                placeholder="Ex: Resumo para Prova Final" 
                className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold" 
              />
            </div>
            <Button onClick={handlePrint} className="w-full h-14 rounded-2xl bg-primary font-black uppercase text-xs tracking-widest">
              <Printer className="mr-2 h-4 w-4" /> Gerar Impressão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de Resumos */}
      <Card className="lg:col-span-1 rounded-[32px] border-border/40 bg-card overflow-hidden flex flex-col shadow-xl">
        <header className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Meu Caderno</h3>
          <Button size="icon" onClick={createNote} className="h-10 w-10 rounded-xl bg-primary">
            <Plus className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => handleSelect(note)}
              className={cn(
                "p-5 rounded-2xl border transition-all cursor-pointer group active:scale-95",
                selected?.id === note.id ? "bg-primary/10 border-primary/30" : "bg-background border-border/50 hover:border-primary/20"
              )}
            >
              <div className="flex justify-between items-start gap-3">
                <p className={cn("font-bold text-sm leading-tight truncate", selected?.id === note.id ? "text-primary" : "text-foreground")}>
                  {note.title}
                </p>
                <Trash2 className="h-4 w-4 text-muted-foreground/30 hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); /* Delete logic */ }} />
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-2">
                {format(new Date(note.updated_at), "dd MMM, HH:mm")}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Área do Editor */}
      <Card className="lg:col-span-2 rounded-[32px] border-border/40 bg-card overflow-hidden shadow-2xl flex flex-col">
        {selected ? (
          <>
            <header className="p-6 border-b border-border/40 bg-muted/5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  className="text-2xl font-black border-none bg-transparent p-0 focus-visible:ring-0 truncate" 
                />
                <div className="flex items-center gap-2">
                   {autoSaveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                   {autoSaveStatus === 'saved' && <Check className="h-4 w-4 text-emerald-500" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {autoSaveStatus === 'saving' ? 'Sincronizando...' : 'Alterações Salvas'}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setPrintDialogOpen(true)} className="h-11 w-11 rounded-xl border-border/40">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button className="h-11 px-6 rounded-xl bg-primary font-black uppercase text-[10px] tracking-widest">
                    <Save className="mr-2 h-4 w-4" /> Salvar Agora
                  </Button>
                </div>
              </div>
            </header>
            <EditorToolbar editor={editor} />
            <div className="flex-1 overflow-y-auto bg-background custom-scrollbar">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
            <FileText className="h-16 w-16 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Selecione um resumo</p>
          </div>
        )}
      </Card>

      <div className="pb-24" />
    </div>
  );
}
