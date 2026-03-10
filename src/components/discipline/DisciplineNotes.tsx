import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, Trash2, Save, FileText, Loader2, Check, 
  Printer, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignJustify, Highlighter, 
  List, ListOrdered, Heading2, Cloud, RefreshCw,
  Search, ExternalLink, ChevronDown
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

// Cores Oficiais do Sistema EduFlow (Conforme tela de Configurações)
const HIGHLIGHT_COLORS = [
  { label: "Rosa Pastel", color: "#FFB3BA" },
  { label: "Verde Pastel", color: "#BAFFC9" },
  { label: "Azul Bebê", color: "#BAE1FF" },
  { label: "Lilás Pastel", color: "#E8BAFF" },
  { label: "Rosa Choque", color: "#FF10F0" },
  { label: "Verde Neon", color: "#39FF14" },
  { label: "Ciano Neon", color: "#00FFFF" },
  { label: "Índigo", color: "#6366F1" },
  { label: "Esmeralda", color: "#10B981" },
  { label: "Âmbar", color: "#F59E0B" }
];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0].color);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);

  // Aplica a cor selecionada atualmente
  const applyHighlight = () => {
    editor.chain().focus().toggleHighlight({ color: activeColor }).run();
  };

  return (
    <div className="flex gap-1 p-3 border-b border-border/40 bg-card items-center overflow-x-auto no-scrollbar touch-pan-x w-full">
      <div className="flex items-center gap-1 shrink-0 bg-muted/30 p-1 rounded-xl">
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />
      
      {/* Novo Botão de Marca-Texto com Popover (Menu de Cores) */}
      <div className="flex items-center bg-muted/30 p-1 rounded-xl shrink-0">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10 rounded-l-lg rounded-r-none hover:bg-background"
          onClick={applyHighlight}
          title="Marcar Texto"
        >
          <Highlighter className="h-4 w-4" style={{ color: activeColor }} />
        </Button>
        <div className="w-px h-6 bg-border/50" />
        <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-6 rounded-r-lg rounded-l-none hover:bg-background px-0">
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-popover border-border shadow-2xl rounded-2xl" align="center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Cores de Destaque</p>
            <div className="grid grid-cols-5 gap-2">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.color}
                  onClick={() => {
                    setActiveColor(c.color);
                    editor.chain().focus().toggleHighlight({ color: c.color }).run();
                    setColorPopoverOpen(false);
                  }}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all active:scale-90 shadow-sm",
                    activeColor === c.color ? "ring-2 ring-foreground ring-offset-2 scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0 bg-muted/30 p-1 rounded-xl">
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="w-px h-6 bg-border/50 mx-2 shrink-0" />

      <div className="flex items-center gap-1 shrink-0 bg-muted/30 p-1 rounded-xl">
        <Toggle size="sm" className="h-10 w-10 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}>
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
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[60vh] p-6 sm:p-10 max-w-none text-foreground font-medium leading-relaxed",
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
      title: "Nova Anotação",
      content: "",
    }).select().single();

    if (data) {
      setNotes([data, ...notes]);
      handleSelect(data);
    }
  }

  async function deleteNote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Deseja apagar este caderno permanentemente?")) return;

    const { error } = await supabase.from("notes").delete().eq("id", id);
    
    if (!error) {
      const newNotes = notes.filter(n => n.id !== id);
      setNotes(newNotes);
      if (selected?.id === id) {
        setSelected(null);
        editor?.commands.clearContent();
      }
      toast({ title: "Caderno excluído" });
    }
  }

  function handleSelect(note: Note) {
    setSelected(note);
    setTitle(note.title);
    editor?.commands.setContent(note.content ?? "");
    setAutoSaveStatus("idle");
  }

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
            mark { padding: 2px 4px; border-radius: 4px; }
            h2 { font-size: 16pt; font-weight: 800; margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
            ul { margin-top: 10px; margin-bottom: 10px; }
            li { margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            ${printSubtitle ? `<p style="color:#3b82f6">${printSubtitle}</p>` : ''}
            <p>${disciplineName || 'Módulo Acadêmico'} • Impresso em ${format(new Date(), "dd/MM/yyyy")}</p>
          </div>
          <div class="content">${htmlContent}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
      setPrintDialogOpen(false);
    }, 500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 min-h-[75vh] pb-24">
      
      {/* Dialog Impressão */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="bg-card border-border shadow-2xl rounded-[32px] p-6 sm:p-8 w-[95vw] sm:max-w-[400px]">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-2xl font-black tracking-tight">Exportar Documento</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground text-sm">
              Configure o cabeçalho para o seu PDF ou folha A4.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subtítulo do Documento</Label>
              <Input 
                value={printSubtitle} 
                onChange={e => setPrintSubtitle(e.target.value)}
                placeholder="Ex: Resumo para a Prova Final" 
                className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold focus:ring-primary/30" 
              />
            </div>
            <Button onClick={handlePrint} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform">
              <Printer className="mr-2 h-4 w-4" /> Gerar Arquivo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coluna 1: Lista de Cadernos */}
      <Card className="lg:col-span-1 rounded-[32px] border-border/40 bg-card overflow-hidden flex flex-col shadow-lg">
        <header className="p-5 sm:p-6 border-b border-border/40 flex items-center justify-between bg-muted/10">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Meus Cadernos
          </h3>
          <Button size="icon" onClick={createNote} className="h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95 transition-transform">
            <Plus className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-card/30">
          {notes.length === 0 ? (
            <div className="text-center p-8 opacity-50">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nenhum caderno criado</p>
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                onClick={() => handleSelect(note)}
                className={cn(
                  "p-4 sm:p-5 rounded-[20px] border transition-all cursor-pointer group active:scale-[0.98]",
                  selected?.id === note.id ? "bg-primary/10 border-primary/30 shadow-sm" : "bg-background border-border/50 hover:border-primary/20"
                )}
              >
                <div className="flex justify-between items-start gap-3">
                  <p className={cn("font-bold text-sm sm:text-base leading-tight truncate transition-colors", selected?.id === note.id ? "text-primary" : "text-foreground group-hover:text-primary")}>
                    {note.title}
                  </p>
                  <Trash2 
                    className="h-4 w-4 text-muted-foreground/30 hover:text-destructive shrink-0 transition-colors" 
                    onClick={(e) => deleteNote(note.id, e)} 
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-2">
                  Editado: {format(new Date(note.updated_at), "dd MMM, HH:mm")}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Coluna 2: Editor Tiptap */}
      <Card className="lg:col-span-2 rounded-[32px] border-border/40 bg-card overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {selected ? (
          <>
            <header className="p-5 sm:p-6 border-b border-border/40 bg-muted/10 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input 
                  value={title} 
                  onChange={e => {
                    setTitle(e.target.value);
                    // Dispara o auto-save pro título também
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(async () => {
                      await supabase.from("notes").update({ title: e.target.value }).eq("id", selected.id);
                      loadNotes();
                    }, 1000);
                  }}
                  className="text-xl sm:text-2xl lg:text-3xl font-black border-none bg-transparent p-0 h-auto focus-visible:ring-0 truncate text-foreground placeholder:text-muted-foreground/30" 
                  placeholder="Título do Caderno"
                />
                <div className="flex items-center justify-center shrink-0 w-6">
                   {autoSaveStatus === 'saving' && <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />}
                   {autoSaveStatus === 'saved' && <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Cloud className="h-3 w-3" />
                  {autoSaveStatus === 'saving' ? 'Sincronizando nuvem...' : 'Anotação protegida'}
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => setPrintDialogOpen(true)} className="h-11 flex-1 sm:flex-none px-4 rounded-xl border-border/50 hover:bg-muted font-bold text-xs uppercase tracking-widest">
                    <Printer className="mr-2 h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </header>
            
            {/* Toolbar */}
            <EditorToolbar editor={editor} />
            
            {/* Área de Digitação Branca */}
            <div className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar relative">
              {/* O padding inferior extra garante que o texto não fique escondido atrás do teclado no mobile */}
              <div className="pb-32">
                <EditorContent editor={editor} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
            <FileText className="h-20 w-20 mb-6 text-muted-foreground" />
            <p className="text-lg font-black text-foreground">Sua Mesa de Estudos</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 max-w-[200px]">
              Selecione um caderno na lateral ou crie um novo para começar.
            </p>
          </div>
        )}
      </Card>

    </div>
  );
}
