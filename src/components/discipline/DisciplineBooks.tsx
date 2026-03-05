import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpenCheck, Loader2, Pencil, BookOpen, FileText, HandHelping, CloudOff, Bell } from "lucide-react";
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
  total_pages: number | null;
  pages_read: number | null;
}

const STATUS_OPTIONS = [
  { value: "unread", label: "Não Lido", color: "bg-muted text-muted-foreground" },
  { value: "reading", label: "Lendo", color: "bg-blue-500/15 text-blue-600" },
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
  const [totalPages, setTotalPages] = useState("");
  const [pagesRead, setPagesRead] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Controle do Modo Offline
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadBooks();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
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
    setTotalPages(book.total_pages?.toString() || "");
    setPagesRead(book.pages_read?.toString() || "");
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
    setTotalPages("");
    setPagesRead("");
    setOpen(true);
  }

  async function saveBook() {
    if (!title.trim() || !user) {
      toast({ title: "O título é obrigatório", variant: "destructive" });
      return;
    }
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para salvar o livro.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    
    // Converte os valores de páginas para número (se existirem)
    const tPages = totalPages ? parseInt(totalPages) : null;
    const pRead = pagesRead ? parseInt(pagesRead) : null;

    const payload = {
      title: title.trim(),
      author: author.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      reading_status: readingStatus,
      material_format: materialFormat,
      total_pages: tPages,
      pages_read: pRead,
    };

    if (editingBook) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Livro atualizado!", description: "A equipe foi notificada." });
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
        toast({ title: "Livro adicionado!", description: "A equipe foi notificada." });
        setOpen(false);
        loadBooks();
      }
    }
    setSubmitting(false);
  }

  async function deleteBook(id: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Não é possível excluir sem internet.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Deseja excluir este livro da sua biblioteca?")) return;
    
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
      toast({ title: "Livro removido com sucesso" });
    }
  }

  function getStatusInfo(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  }

  function getFormatInfo(fmt: string) {
    return FORMAT_OPTIONS.find(f => f.value === fmt) || FORMAT_OPTIONS[1];
  }

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          Biblioteca da Disciplina
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} disabled={isOffline} className="h-9 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest">
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[32px] max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">{editingBook ? "Editar Livro" : "Novo Livro"}</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground">Registre livros, PDFs e seu progresso de leitura.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {isOffline && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest animate-pulse">
                  <CloudOff className="h-4 w-4" />
                  Conecte-se para salvar
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título do Livro/PDF</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Macroeconomia" className="h-14 rounded-2xl bg-muted/30 border-border text-lg font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Autor</Label>
                <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Ex: Gregory Mankiw" className="h-14 rounded-2xl bg-muted/30 border-border font-medium" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                  <Select value={readingStatus} onValueChange={setReadingStatus}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Formato</Label>
                  <Select value={materialFormat} onValueChange={setMaterialFormat}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {FORMAT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Novos Campos de Progresso */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-2xl border border-border/50">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-primary ml-1">Páginas Lidas</Label>
                  <Input type="number" min="0" value={pagesRead} onChange={e => setPagesRead(e.target.value)} placeholder="Ex: 45" className="h-12 rounded-xl bg-background border-border font-bold text-primary" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Total de Páginas</Label>
                  <Input type="number" min="1" value={totalPages} onChange={e => setTotalPages(e.target.value)} placeholder="Ex: 200" className="h-12 rounded-xl bg-background border-border font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Início</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-14 rounded-2xl bg-muted/30 border-border font-medium" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Término</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-14 rounded-2xl bg-muted/30 border-border font-medium" />
                </div>
              </div>
              
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <Bell className="h-3 w-3 text-primary" />
                  Notificação automática ativada
                </div>
                <Button onClick={saveBook} disabled={submitting || isOffline} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editingBook ? "Salvar Alterações" : "Salvar Livro"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="p-4">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BookOpenCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-xs font-medium text-muted-foreground">Nenhum livro cadastrado para esta disciplina.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map(book => {
              const statusInfo = getStatusInfo(book.reading_status);
              const formatInfo = getFormatInfo(book.material_format);
              const FormatIcon = formatInfo.icon;

              // Lógica de cálculo do progresso
              const total = book.total_pages || 0;
              const read = book.pages_read || 0;
              const progressPercent = total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;

              return (
                <div key={book.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl p-5 bg-muted/20 border border-border/50 group hover:bg-muted/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-14 w-14 bg-card border border-border/40 shadow-sm rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <FormatIcon className="h-6 w-6 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg text-foreground truncate leading-tight">{book.title}</p>
                      <p className="text-[11px] font-medium text-muted-foreground truncate uppercase tracking-widest mt-1">{book.author || "Autor não informado"}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${statusInfo.color} border-0`}>
                          {statusInfo.label}
                        </Badge>
                        
                        {(book.start_date || book.end_date) && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                            {book.start_date && <span>Início: {format(new Date(book.start_date + "T00:00:00"), "dd/MM/yy")}</span>}
                            {book.start_date && book.end_date && <span>•</span>}
                            {book.end_date && <span>Fim: {format(new Date(book.end_date + "T00:00:00"), "dd/MM/yy")}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Progresso Visual */}
                  {total > 0 && (
                    <div className="w-full sm:w-[150px] shrink-0 space-y-2 bg-background p-3 rounded-xl border border-border/50">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <span>{read} / {total} Pág</span>
                        <span className="text-primary">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2 shadow-inner bg-muted [&>div]:bg-primary" />
                    </div>
                  )}

                  <div className="flex gap-2 shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isOffline}
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEdit(book)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isOffline}
                      className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
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
