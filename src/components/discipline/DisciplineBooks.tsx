import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpenCheck, Loader2, Pencil, BookOpen, FileText, HandHelping } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Book {
  id: string;
  title: string;
  author: string | null;
  start_date: string | null;
  end_date: string | null;
  reading_status: string;
  material_format: string;
}

const STATUS_OPTIONS = [
  { value: "unread", label: "Não Lido", color: "bg-muted text-muted-foreground" },
  { value: "read", label: "Lido", color: "bg-emerald-500/15 text-emerald-600" },
  { value: "incomplete", label: "Incompleto", color: "bg-amber-500/15 text-amber-600" },
  { value: "returned", label: "Devolvido", color: "bg-primary/15 text-primary" },
];

const FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "physical", label: "Livro Físico", icon: BookOpen },
  { value: "borrowed", label: "Livro Emprestado", icon: HandHelping },
];

export function DisciplineBooks({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [readingStatus, setReadingStatus] = useState("unread");
  const [materialFormat, setMaterialFormat] = useState("physical");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBooks();
  }, [disciplineId]);

  async function loadBooks() {
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("created_at", { ascending: false });
    setBooks((data ?? []).map((b: any) => ({
      ...b,
      reading_status: b.reading_status || "unread",
      material_format: b.material_format || "physical",
    })));
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author || "");
    setStartDate(book.start_date || "");
    setEndDate(book.end_date || "");
    setReadingStatus(book.reading_status);
    setMaterialFormat(book.material_format);
    setOpen(true);
  }

  function openNew() {
    setEditingBook(null);
    setTitle("");
    setAuthor("");
    setStartDate("");
    setEndDate("");
    setReadingStatus("unread");
    setMaterialFormat("physical");
    setOpen(true);
  }

  async function saveBook() {
    if (!title.trim() || !user) {
      toast({ title: "O título é obrigatório", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const payload = {
      title: title.trim(),
      author: author.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      reading_status: readingStatus,
      material_format: materialFormat,
    };

    if (editingBook) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Livro atualizado!" });
        setOpen(false);
        loadBooks();
      }
    } else {
      const { error } = await supabase.from("books").insert({
        ...payload,
        discipline_id: disciplineId,
        user_id: user.id,
      });
      if (error) {
        toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Livro adicionado!" });
        setOpen(false);
        loadBooks();
      }
    }
    setSubmitting(false);
  }

  async function deleteBook(id: string) {
    if (!window.confirm("Deseja excluir este livro?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
      toast({ title: "Livro removido" });
    }
  }

  function getStatusInfo(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  }

  function getFormatInfo(fmt: string) {
    return FORMAT_OPTIONS.find(f => f.value === fmt) || FORMAT_OPTIONS[1];
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Biblioteca da Disciplina</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="mr-1 h-3 w-3" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editingBook ? "Editar Livro" : "Novo Livro"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Título do Livro</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Macroeconomia" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Autor</Label>
                <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Ex: Gregory Mankiw" className="h-12" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Status de Leitura</Label>
                  <Select value={readingStatus} onValueChange={setReadingStatus}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Formato</Label>
                  <Select value={materialFormat} onValueChange={setMaterialFormat}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Início da Leitura</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Término / Devolução</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12" />
                </div>
              </div>
              <Button onClick={saveBook} disabled={submitting} className="w-full h-12 font-bold uppercase tracking-widest">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editingBook ? "Salvar Alterações" : "Salvar Livro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpenCheck className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm">Nenhum livro cadastrado para esta disciplina.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {books.map(book => {
              const statusInfo = getStatusInfo(book.reading_status);
              const formatInfo = getFormatInfo(book.material_format);
              const FormatIcon = formatInfo.icon;

              return (
                <div key={book.id} className="flex items-center gap-4 rounded-xl p-4 bg-muted/30 border border-border/50 group hover:border-primary/30 transition-all">
                  <div className="h-12 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <FormatIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate italic">{book.author || "Autor não informado"}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge className={`text-[10px] font-bold ${statusInfo.color} border-0`}>
                        {statusInfo.label}
                      </Badge>
                      {book.start_date && (
                        <span className="text-[10px] text-muted-foreground">
                          Início: {format(new Date(book.start_date + "T00:00:00"), "dd/MM/yy")}
                        </span>
                      )}
                      {book.end_date && (
                        <span className="text-[10px] text-muted-foreground">
                          Fim: {format(new Date(book.end_date + "T00:00:00"), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEdit(book)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteBook(book.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
