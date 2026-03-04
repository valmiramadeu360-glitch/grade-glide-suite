import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, BookOpenCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Book {
  id: string;
  title: string;
  author: string | null;
  start_date: string | null;
  end_date: string | null;
}

export function DisciplineBooks({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
    setBooks(data ?? []);
  }

  async function addBook() {
    if (!title.trim() || !user) {
      toast({ title: "O título é obrigatório", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("books").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title: title.trim(),
      author: author.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Livro adicionado!" });
      setTitle("");
      setAuthor("");
      setStartDate("");
      setEndDate("");
      setOpen(false);
      loadBooks();
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

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Biblioteca da Disciplina</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Novo Livro</DialogTitle>
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
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Início da Leitura</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-muted-foreground">Término da Leitura</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12" />
                </div>
              </div>
              <Button onClick={addBook} disabled={submitting} className="w-full h-12 font-bold uppercase tracking-widest">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Livro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpenCheck className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm">Nenhum livro cadastrado para esta disciplina.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {books.map(book => (
              <div key={book.id} className="flex items-center gap-4 rounded-xl p-4 bg-muted/30 border border-border/50 group hover:border-primary/30 transition-all">
                <div className="h-12 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpenCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate italic">{book.author || "Autor não informado"}</p>
                  <div className="flex gap-3 mt-1">
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteBook(book.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
