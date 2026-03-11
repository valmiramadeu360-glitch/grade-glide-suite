import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, Trash2, FileText, Loader2, Check, 
  Printer, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Highlighter, 
  List, ListOrdered, Heading1, Heading2, Cloud, 
  ChevronDown, Table as TableIcon, Link as LinkIcon, Image as ImageIcon,
  Type, Code, Quote, Strikethrough
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

// Paleta de Cores Profissional
const TEXT_COLORS = [
  { label: "Preto", color: "#000000" },
  { label: "Azul", color: "#2563eb" },
  { label: "Vermelho", color: "#dc2626" },
  { label: "Verde", color: "#16a34a" },
  { label: "Roxo", color: "#9333ea" },
];

const HIGHLIGHT_COLORS = [
  { label: "Amarelo", color: "#fef08a" },
  { label: "Verde", color: "#bbf7d0" },
  { label: "Azul", color: "#bfdbfe" },
  { label: "Rosa", color: "#fbcfe8" },
  { label: "Laranja", color: "#fed7aa" },
];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border/40 bg-muted/5 sticky top-0 z-20 backdrop-blur-md">
      {/* Grupo: Texto Básico */}
      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </Toggle>
      </div>

      {/* Grupo: Títulos e Listas */}
      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Toggle>
      </div>

      {/* Grupo: Alinhamento */}
      <div className="flex items-center gap-0.5 bg-background border rounded-lg p-0.5 shadow-sm">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4"/></Button>
      </div>

      {/* Grupo: Cores e Tabelas */}
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-primary/20">
              <Highlighter className="h-4 w-4 text-primary" /> <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 grid grid-cols-5 gap-1">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.color} onClick={() => editor.chain().focus().toggleHighlight({ color: c.color }).run()} className="h-7 w-7 rounded border shadow-sm" style={{ backgroundColor: c.color }} />
            ))}
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
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
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
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[70vh] p-8 sm:p-12 max-w-none text-foreground font-medium leading-relaxed bg-white dark:bg-slate-950 shadow-inner rounded-b-[32px]",
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

  const handlePrint = () => {
    if (!editor || !selected) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = editor.getHTML();
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
            h1 { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            table td, table th { border: 1px solid #ddd; padding: 8px; }
            mark { background-color: #fef08a; padding: 0 2px; }
          </style>
        </head>
        <body>
          <h1 style="margin:0">${title}</h1>
          <p style="color:#666; font-size:12px; margin-bottom:30px;">${disciplineName || 'EduFlow'} • ${format(new Date(), "dd/MM/yyyy")}</p>
          <div>${htmlContent}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[80vh] pb-20">
      
      {/* Sidebar de Notas */}
      <Card className="lg:col-span-1 rounded-[32px] border-border/40 bg-card overflow-hidden flex flex-col shadow-xl">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-primary/5">
          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Cadernos
          </h3>
          <Button size="icon" onClick={createNote} className="h-8 w-8 rounded-lg"><Plus className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          {notes.map(note => (
            <div key={note.id} onClick={() => handleSelect(note)} className={cn("p-4 rounded-2xl mb-2 cursor-pointer transition-all border", selected?.id === note.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted border-transparent")}>
              <p className="font-bold text-sm truncate">{note.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(note.updated_at), "dd MMM, HH:mm")}</p>
            </div>
          ))}
        </ScrollArea>
      </Card>

      {/* Área do Editor */}
      <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card shadow-2xl flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="p-6 border-b border-border/40 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input value={title} onChange={e => setTitle(e.target.value)} className="text-2xl font-black border-none p-0 focus-visible:ring-0 bg-transparent" />
                <Button variant="outline" size="icon" onClick={handlePrint} className="rounded-xl"><Printer className="h-5 w-5" /></Button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <Cloud className="h-3 w-3" /> {autoSaveStatus === 'saving' ? 'Salvando...' : 'Sincronizado'}
              </div>
            </div>
            <EditorToolbar editor={editor} />
            <ScrollArea className="flex-1">
              <EditorContent editor={editor} />
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-20 text-center">
            <FileText className="h-20 w-20 mb-4" />
            <p className="font-black uppercase tracking-widest">Selecione um caderno para escrever</p>
          </div>
        )}
      </Card>
    </div>
  );
}
