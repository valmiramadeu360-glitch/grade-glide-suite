import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Trash2, FileText, Loader2, Check, 
  Printer, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignJustify, Highlighter, 
  List, ListOrdered, Heading1, Heading2, Cloud, 
  ChevronDown, Table as TableIcon, Strikethrough,
  RotateCcw, Type
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLORS = [
  { label: "Amarelo", color: "#fef08a" },
  { label: "Verde", color: "#bbf7d0" },
  { label: "Azul", color: "#bfdbfe" },
  { label: "Rosa", color: "#fbcfe8" },
  { label: "Laranja", color: "#fed7aa" },
];

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
}

/* ──── Toolbar Estilo Word ──── */
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border/40 bg-muted/5 sticky top-0 z-20 backdrop-blur-md items-center">
      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Toggle>
      </div>

      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Toggle>
      </div>

      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4"/></Button>
      </div>

      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-primary/20"><Highlighter className="h-4 w-4 text-primary" /> <ChevronDown className="h-3 w-3" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 grid grid-cols-5 gap-1">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.color} onClick={() => editor.chain().focus().toggleHighlight({ color: c.color }).run()} className="h-7 w-7 rounded border shadow-sm" style={{ backgroundColor: c.color }} />
            ))}
            <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="h-7 w-7 rounded border flex items-center justify-center bg-background"><RotateCcw className="h-3 w-3"/></button>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="h-4 w-4" /> Tabela
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRef = useRef<Note | null>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const editor = useEditor({
    extensions: [
      StarterKit,
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
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[70vh] p-8 sm:p-12 max-w-none text-foreground font-medium bg-white dark:bg-slate-950 shadow-inner rounded-b-[32px]",
      },
    },
    onUpdate: ({ editor }) => {
      if (!selectedRef.current || !user) return;
      const html = editor.getHTML();
      setAutoSaveStatus("saving");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase.from("notes").update({ content: html, updated_at: new Date().toISOString() }).eq("id", selectedRef.current?.id);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      }, 1500);
    }
  });

  useEffect(() => { loadNotes(); }, [disciplineId]);

  async function loadNotes() {
    const { data } = await supabase.from("notes").select("*").eq("discipline_id", disciplineId).order("updated_at", { ascending: false });
    setNotes(data ?? []);
  }

  async function createNote() {
    if (!user) return;
    const { data } = await supabase.from("notes").insert({
      discipline_id: disciplineId, user_id: user.id, title: "Novo Resumo", content: "",
    }).select().single();
    if (data) { setNotes([data, ...notes]); handleSelect(data); }
  }

  function handleSelect(note: Note) {
    setSelected(note);
    setTitle(note.title);
    editor?.commands.setContent(note.content ?? "");
  }

  /* ──── SOLUÇÃO DEFINITIVA DE IMPRESSÃO (IFRAME) ──── */
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
    const docTitle = title || "Anotação EduFlow";
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
            h1 { font-size: 24pt; font-weight: 900; margin: 0; border-bottom: 4px solid #3b82f6; padding-bottom: 10px; }
            .meta { color: #666; font-size: 10pt; margin-bottom: 30px; font-weight: bold; text-transform: uppercase; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            table td, table th { border: 1px solid #ddd; padding: 12px; text-align: left; }
            mark { background-color: #fef08a; padding: 0 4px; border-radius: 2px; }
            blockquote { border-left: 4px solid #e2e8f0; padding-left: 20px; font-style: italic; color: #4a5568; }
            img { max-width: 100%; height: auto; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>${docTitle}</h1>
          <div class="meta">${disciplineName || 'EduFlow Academy'} • Impresso em ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</div>
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[80vh] pb-20 animate-in fade-in duration-500">
      
      {/* Sidebar de Notas */}
      <Card className="lg:col-span-1 rounded-[32px] border-border/40 bg-card overflow-hidden flex flex-col shadow-xl">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-primary/5">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Cadernos
          </h3>
          <Button size="icon" onClick={createNote} className="h-8 w-8 rounded-lg shadow-md active:scale-90 transition-transform"><Plus className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          {notes.map(note => (
            <div key={note.id} onClick={() => handleSelect(note)} className={cn("p-4 rounded-2xl mb-2 cursor-pointer transition-all border group", selected?.id === note.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted border-transparent")}>
              <div className="flex justify-between items-start gap-2">
                <p className="font-bold text-sm truncate flex-1">{note.title}</p>
                <Trash2 onClick={(e) => { e.stopPropagation(); if(confirm("Apagar?")) supabase.from("notes").delete().eq("id", note.id).then(() => loadNotes()); }} className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[9px] font-black uppercase text-muted-foreground/50 mt-1">{format(new Date(note.updated_at), "dd MMM, HH:mm")}</p>
            </div>
          ))}
        </ScrollArea>
      </Card>

      {/* Editor Principal */}
      <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card shadow-2xl flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="p-6 border-b border-border/40 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input value={title} onChange={e => { setTitle(e.target.value); if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => supabase.from("notes").update({ title: e.target.value }).eq("id", selected.id).then(() => loadNotes()), 1000); }} className="text-2xl font-black border-none p-0 focus-visible:ring-0 bg-transparent h-auto" />
                <Button variant="outline" size="icon" onClick={handlePrint} className="rounded-xl hover:bg-primary hover:text-white transition-colors shadow-sm"><Printer className="h-5 w-5" /></Button>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                <Cloud className="h-3 w-3" /> {autoSaveStatus === 'saving' ? 'Sincronizando...' : 'Protegido na Nuvem'}
                {autoSaveStatus === 'saved' && <Check className="h-3 w-3 text-emerald-500" />}
              </div>
            </div>
            <EditorToolbar editor={editor} />
            <ScrollArea className="flex-1">
              <EditorContent editor={editor} />
              <div className="h-32" /> {/* Espaço para não cobrir o texto no mobile */}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-20 text-center">
            <Type className="h-20 w-20 mb-4 text-muted-foreground" />
            <p className="font-black uppercase tracking-widest text-sm">Selecione ou crie um caderno</p>
          </div>
        )}
      </Card>
    </div>
  );
}

