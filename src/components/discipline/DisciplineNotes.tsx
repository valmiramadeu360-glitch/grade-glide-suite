import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Trash2, FileText, Loader2, Check, 
  Printer, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignJustify, AlignRight, Highlighter, 
  List, ListOrdered, Heading1, Heading2, Heading3, Cloud, 
  ChevronDown, Table as TableIcon, Strikethrough,
  RotateCcw, Type, Copy, Sparkles, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLORS = [
  { label: "Amarelo Suave", color: "#fef08a" },
  { label: "Verde Menta", color: "#bbf7d0" },
  { label: "Azul Céu", color: "#bfdbfe" },
  { label: "Rosa Pastel", color: "#fbcfe8" },
  { label: "Laranja Solar", color: "#fed7aa" },
];

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

/* ──── Barra de Ferramentas Estilo Suíte Corporativa ──── */
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1.5 p-3 border-b border-border/40 bg-muted/30 sticky top-0 z-20 backdrop-blur-xl items-center">
      {/* Formatação Básica */}
      <div className="flex items-center gap-0.5 bg-background border border-border/40 rounded-xl p-1 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} className="rounded-lg h-8 w-8"><Bold className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} className="rounded-lg h-8 w-8"><Italic className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} className="rounded-lg h-8 w-8"><UnderlineIcon className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} className="rounded-lg h-8 w-8"><Strikethrough className="h-4 w-4" /></Toggle>
      </div>

      {/* Títulos e Cabeçalhos */}
      <div className="flex items-center gap-0.5 bg-background border border-border/40 rounded-xl p-1 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="rounded-lg h-8 w-8"><Heading1 className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded-lg h-8 w-8"><Heading2 className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className="rounded-lg h-8 w-8"><Heading3 className="h-4 w-4" /></Toggle>
      </div>

      {/* Alinhamentos */}
      <div className="flex items-center gap-0.5 bg-background border border-border/40 rounded-xl p-1 shadow-sm">
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0 rounded-lg", editor.isActive({ textAlign: 'left' }) && "bg-muted")} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0 rounded-lg", editor.isActive({ textAlign: 'center' }) && "bg-muted")} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0 rounded-lg", editor.isActive({ textAlign: 'right' }) && "bg-muted")} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0 rounded-lg", editor.isActive({ textAlign: 'justify' }) && "bg-muted")} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4"/></Button>
      </div>

      {/* Listas */}
      <div className="flex items-center gap-0.5 bg-background border border-border/40 rounded-xl p-1 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} className="rounded-lg h-8 w-8"><List className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} className="rounded-lg h-8 w-8"><ListOrdered className="h-4 w-4" /></Toggle>
      </div>

      {/* Cores e Tabelas */}
      <div className="flex items-center gap-1.5 ml-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted font-bold text-xs">
              <Highlighter className="h-4 w-4 text-primary" /> <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 grid grid-cols-5 gap-1.5 bg-background/95 backdrop-blur-xl rounded-2xl shadow-xl border-border/40">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.color} onClick={() => editor.chain().focus().toggleHighlight({ color: c.color }).run()} className="h-8 w-8 rounded-xl border shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: c.color }} title={c.label} />
            ))}
            <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="h-8 w-8 rounded-xl border flex items-center justify-center bg-muted/50 hover:bg-muted" title="Remover Destaque"><RotateCcw className="h-3.5 w-3.5"/></button>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted font-bold text-xs" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="h-4 w-4 text-primary" /> Tabela
        </Button>
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRef = useRef<Note | null>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      UnderlineExt,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[65vh] p-6 sm:p-12 max-w-none text-foreground font-medium bg-card",
      },
    },
    onUpdate: ({ editor }) => {
      if (!selectedRef.current || !user) return;
      const html = editor.getHTML();
      const text = editor.getText();
      
      // Estatísticas
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      setCharCount(text.length);

      setAutoSaveStatus("saving");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase.from("notes").update({ content: html, updated_at: new Date().toISOString() }).eq("id", selectedRef.current?.id);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2500);
      }, 1200);
    }
  });

  useEffect(() => { loadNotes(); }, [disciplineId]);

  async function loadNotes() {
    const { data } = await supabase.from("notes").select("*").eq("discipline_id", disciplineId).order("updated_at", { ascending: false });
    setNotes(data ?? []);
    if (data && data.length > 0 && !selected) {
      handleSelect(data[0]);
    }
  }

  async function createNote() {
    if (!user) return;
    const { data, error } = await supabase.from("notes").insert({
      discipline_id: disciplineId, user_id: user.id, title: "Novo Resumo Acadêmico", content: "",
    }).select().single();
    if (error) {
      toast({ title: "Erro ao criar caderno", description: error.message, variant: "destructive" });
      return;
    }
    if (data) { 
      setNotes([data, ...notes]); 
      handleSelect(data); 
      toast({ title: "Caderno criado! ✨" });
    }
  }

  function handleSelect(note: Note) {
    setSelected(note);
    setTitle(note.title);
    editor?.commands.setContent(note.content ?? "");
    const text = editor?.getText() || "";
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    setCharCount(text.length);
  }

  async function deleteNote(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este resumo permanentemente?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
      return;
    }
    toast({ title: "Caderno excluído." });
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    if (selected?.id === id) {
      if (remaining.length > 0) handleSelect(remaining[0]);
      else { setSelected(null); editor?.commands.setContent(""); }
    }
  }

  // Copiar conteúdo formatado
  const handleCopyText = () => {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getText());
    toast({ title: "Conteúdo copiado para a área de transferência! 📋" });
  };

  // Impressão via Iframe otimizado
  const handlePrint = () => {
    if (!editor || !selected) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const htmlContent = editor.getHTML();
    const docTitle = title || "Resumo EduFlow Academy";
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 50px; line-height: 1.7; color: #111827; background: #ffffff; }
            h1 { font-size: 26pt; font-weight: 900; margin: 0 0 10px 0; color: #0f172a; }
            .meta { color: #64748b; font-size: 10pt; margin-bottom: 40px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
            table { border-collapse: collapse; width: 100%; margin: 25px 0; }
            table td, table th { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 10.5pt; }
            table th { background-color: #f1f5f9; font-weight: bold; }
            mark { background-color: #fef08a; padding: 2px 6px; border-radius: 4px; }
            blockquote { border-left: 4px solid #3b82f6; padding-left: 20px; margin: 20px 0; font-style: italic; color: #334155; background: #f8fafc; padding-top: 10px; padding-bottom: 10px; border-radius: 0 8px 8px 0; }
            ul, ol { padding-left: 25px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>${docTitle}</h1>
          <div class="meta">${disciplineName || 'EduFlow Academy'} • Documento Acadêmico • Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
          <div class="content">${htmlContent}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.frameElement.remove(); }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[80vh] pb-24 animate-in fade-in duration-500">
      
      {/* Sidebar de Cadernos */}
      <Card className="lg:col-span-4 rounded-[32px] border-border/40 bg-card overflow-hidden flex flex-col shadow-sm">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-primary/5">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary" /> Cadernos de Estudo
            </h3>
            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Resumos e anotações da disciplina</p>
          </div>
          <Button size="icon" onClick={createNote} className="h-10 w-10 rounded-2xl shadow-md active:scale-95 transition-transform shrink-0">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-3.5">
          {notes.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs font-bold text-foreground">Nenhum caderno criado</p>
              <p className="text-[10px] text-muted-foreground mt-1">Clique no botão "+" acima para iniciar seu primeiro resumo.</p>
            </div>
          ) : (
            notes.map(note => (
              <div 
                key={note.id} 
                onClick={() => handleSelect(note)} 
                className={cn(
                  "p-4 rounded-[24px] mb-2.5 cursor-pointer transition-all border group relative", 
                  selected?.id === note.id ? "bg-primary/10 border-primary/30 shadow-sm" : "hover:bg-muted/50 border-border/20 bg-background/40"
                )}
              >
                <div className="flex justify-between items-start gap-3">
                  <p className="font-black text-sm truncate flex-1 text-foreground group-hover:text-primary transition-colors">{note.title}</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => deleteNote(e, note.id)} 
                    className="h-7 w-7 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">
                    {format(new Date(note.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
                  </p>
                  {selected?.id === note.id && (
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </Card>

      {/* Editor Principal Estilo Suíte Corporativa */}
      <Card className="lg:col-span-8 rounded-[32px] border-border/40 bg-card shadow-lg flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Header do Editor */}
            <div className="p-6 border-b border-border/40 space-y-4 bg-background/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Input 
                  value={title} 
                  onChange={e => { 
                    setTitle(e.target.value); 
                    if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); 
                    typingTimeoutRef.current = setTimeout(() => {
                      supabase.from("notes").update({ title: e.target.value, updated_at: new Date().toISOString() }).eq("id", selected.id).then(() => loadNotes());
                    }, 1000); 
                  }} 
                  placeholder="Título do resumo..."
                  className="text-xl sm:text-2xl font-black border-none p-0 focus-visible:ring-0 bg-transparent h-auto text-foreground placeholder:text-muted-foreground/40" 
                />
                
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handleCopyText} className="rounded-xl h-10 px-3 font-bold text-xs gap-1.5 border-border/60 bg-card shadow-sm hover:bg-muted">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-10 px-3 font-bold text-xs gap-1.5 border-border/60 bg-card shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Printer className="h-3.5 w-3.5" /> Exportar PDF
                  </Button>
                </div>
              </div>

              {/* Status de Sincronização e Estatísticas */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded-full border border-border/30">
                  <Cloud className="h-3 w-3 text-primary" /> 
                  {autoSaveStatus === 'saving' ? 'Salvando alterações...' : 'Sincronizado na Nuvem'}
                  {autoSaveStatus === 'saved' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                </div>

                <div className="flex items-center gap-3">
                  <span>{wordCount} palavras</span>
                  <span>•</span>
                  <span>{charCount} caracteres</span>
                </div>
              </div>
            </div>

            {/* Toolbar de Formatação */}
            <EditorToolbar editor={editor} />

            {/* Área de Escrita */}
            <ScrollArea className="flex-1 bg-card">
              <EditorContent editor={editor} />
              <div className="h-40" /> {/* Espaço confortável no final da página */}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-16 sm:p-24 text-center bg-muted/10">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-inner">
              <Type className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-foreground">Nenhum caderno selecionado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Escolha um caderno existente na lista ao lado ou crie um novo para começar a escrever seus resumos.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
