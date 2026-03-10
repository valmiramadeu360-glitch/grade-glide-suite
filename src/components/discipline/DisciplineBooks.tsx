import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpenCheck, Loader2, Pencil, BookOpen, FileText, HandHelping, CloudOff, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  { value: "unread", label: "Não Lido", color: "bg-muted text-muted-foreground border-border" },
  { value: "reading", label: "Lendo Agora", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "read", label: "Concluído", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "incomplete", label: "Incompleto", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "returned", label: "Devolvido", color: "bg-primary/10 text-primary border-primary/20" },
];

const FORMAT_OPTIONS = [
  { value: "pdf", label: "Arquivo PDF", icon: FileText },
  { value: "physical", label: "Livro Físico", icon: BookOpen },
  { value: "borrowed", label: "Emprestado (Biblioteca)", icon: HandHelping },
];

export function DisciplineBooks({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [readingStatus, setReadingStatus] = useState("unread");
  const [materialFormat, setMaterialFormat] = useState("physical");
  const [totalPages, setTotalPages] = useState("");
  const [pagesRead, setPagesRead] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    // Ajuste de fuso horário para preencher inputs de data corretamente
    setStartDate(book.start_date ? book.start_date.split('T')[0] : "");
    setEndDate(book.end_date ? book.end_date.split('T')[0] : "");
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
      toast({ title: "Modo Offline", description: "Conecte-se para salvar novos livros.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    
    const tPages = totalPages ? parseInt(totalPages) : null;
    let pRead = pagesRead ? parseInt(pagesRead) : null;
    
    // Trava lógica para gamificação realista
    if (tPages && pRead && pRead > tPages) pRead = tPages;

    // Conversão segura de datas para evitar erros de Postgres no Supabase
    const payload = {
      title: title.trim(),
      author: author.trim() || null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      reading_status: readingStatus,
      material_format: materialFormat,
      total_pages: tPages,
      pages_read: pRead,
    };

    try {
      if (editingBook) {
        const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
        if (error) throw error;
        toast({ title: "Progresso atualizado! 📚" });
      } else {
        const { error } = await supabase.from("books").insert({
          ...payload,
          discipline_id: disciplineId,
          user_id: user.id,
        });
        if (error) throw error;
        toast({ title: "Material adicionado à biblioteca!" });
      }
      setOpen(false);
      loadBooks();
    } catch (error: any) {
       toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBook(id: string) {
    if (isOffline) {
      toast({ title: "Ação Bloqueada", description: "Não é possível excluir livros sem internet.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Esta ação removerá o livro e todo o histórico de leitura. Deseja continuar?")) return;
    
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
      toast({ title: "Material removido do acervo." });
    }
  }

  // Componente de Gráfico Gauge (Mantido e otimizado)
  const GaugeChart = ({ current, max }: { current: number; max: number }) => {
    const safeMax = max > 0 ? max : 1;
    let percentage = (current / safeMax) * 100;
    if (percentage > 100) percentage = 100;
    
    const radius = 35;
    const circumference = Math.PI * radius; 
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative flex flex-col items-center justify-end w-[85px] h-[45px] overflow-hidden">
        <svg className="w-[85px] h-[85px] absolute top-0 transform rotate-180" viewBox="0 0 100 50">
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-muted/40"
          />
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-primary transition-all duration-1000 ease-out"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="flex flex-col items-center mt-auto z-10 pb-0.5">
          <span className="text-xs font-black text-foreground leading-none">{Math.round(percentage)}%</span>
        </div>
      </div>
    );
  };

  // Helper para formatar a data sem sofrer com timezone do UTC
  const formatDateFriendly = (dateStr: string) => {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), "dd MMM", { locale: ptBR });
  };

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="pb-5 pt-6 px-6 sm:px-8 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Acervo de Leitura
          </CardTitle>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Bibliografias e PDFs</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} disabled={isOffline} className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar Mídia
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] max-h-[90vh] overflow-y-auto no-scrollbar bg-card border-border p-6 sm:p-8 shadow-2xl">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">{editingBook ? "Editar Detalhes" : "Novo Material"}</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm">Registre livros ou artigos para metrificar suas leituras.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              {isOffline && (
                <div className="bg-destructive/5 border border-destructive/20 text-destructive p-4 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest animate-pulse shadow-inner">
                  <CloudOff className="h-5 w-5 shrink-0" /> Sem conexão. O salvamento está temporariamente desativado.
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título da Obra</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Metodologia Científica..." className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/30" />
              </div>
              
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Autor(es)</Label>
                <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Ex: Eco, Umberto" className="h-14 rounded-2xl bg-muted/20 border-border/50 font-medium focus:ring-primary/30" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Formato</Label>
                  <Select value={materialFormat} onValueChange={setMaterialFormat}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border border-border/50 font-bold text-foreground focus:ring-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                      {FORMAT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value} className="py-3 font-medium cursor-pointer">
                          <div className="flex items-center gap-2">
                            <f.icon className="h-4 w-4 text-muted-foreground" /> {f.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Status Atual</Label>
                  <Select value={readingStatus} onValueChange={setReadingStatus}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border border-border/50 font-bold text-foreground focus:ring-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value} className="py-3 font-medium cursor-pointer">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Box de Gamificação de Leitura */}
              <div className="p-5 bg-card border border-border/50 rounded-[20px] space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px]">
                  <BookOpenCheck className="h-4 w-4" /> Velocímetro de Páginas
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Lidas</Label>
                    <Input type="number" min="0" value={pagesRead} onChange={e => setPagesRead(e.target.value)} placeholder="Ex: 45" className="h-12 rounded-xl bg-muted/20 border-border/50 font-black text-primary text-center focus:ring-primary/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Total</Label>
                    <Input type="number" min="1" value={totalPages} onChange={e => setTotalPages(e.target.value)} placeholder="Ex: 200" className="h-12 rounded-xl bg-muted/20 border-border/50 font-bold text-center focus:ring-primary/30" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Data de Início</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-sm [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark] cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex justify-between">
                    Término <span className="text-muted-foreground/40 font-medium tracking-normal capitalize">(Opcional)</span>
                  </Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-sm [color-scheme:dark] md:[color-scheme:light] dark:[color-scheme:dark] cursor-pointer" />
                </div>
              </div>
              
              <Button onClick={saveBook} disabled={submitting || isOffline} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 mt-2 active:scale-95 transition-transform">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editingBook ? "Atualizar Ficha" : "Cadastrar no Acervo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 bg-card/30">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-background">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-5 shadow-inner">
              <BookOpenCheck className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-black text-foreground">Biblioteca Vazia</h3>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[250px]">Adicione os livros e apostilas que fazem parte do plano de ensino.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {books.map(book => {
              const statusInfo = STATUS_OPTIONS.find(s => s.value === book.reading_status) || STATUS_OPTIONS[0];
              const formatInfo = FORMAT_OPTIONS.find(f => f.value === book.material_format) || FORMAT_OPTIONS[1];
              const FormatIcon = formatInfo.icon;

              const total = book.total_pages || 0;
              const read = book.pages_read || 0;

              return (
                <div key={book.id} className="group flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 rounded-[28px] p-5 sm:p-6 bg-card border border-border/50 hover:border-primary/40 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] transition-all">
                  
                  <div className="flex items-start sm:items-center gap-4 sm:gap-5 flex-1 min-w-0">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 bg-muted/30 border border-border shadow-inner rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <FormatIcon className="h-7 w-7 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-black text-base sm:text-lg text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                      <p className="text-[10px] sm:text-xs font-bold text-muted-foreground truncate uppercase tracking-widest">
                        {book.author || "Autor não especificado"}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2.5">
                        <Badge variant="outline" className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                        
                        {(book.start_date || book.end_date) && (
                          <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {book.start_date && <span>{formatDateFriendly(book.start_date)}</span>}
                            {book.start_date && book.end_date && <span className="opacity-50">→</span>}
                            {book.end_date ? <span>{formatDateFriendly(book.end_date)}</span> : <span className="text-primary">Lendo</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-border/50">
                    {total > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Progresso</span>
                          <span className="text-xs font-bold text-foreground mt-0.5">{read} <span className="opacity-40">/</span> {total}</span>
                        </div>
                        <GaugeChart current={read} max={total} />
                      </div>
                    )}

                    <div className="flex gap-2 shrink-0 ml-auto sm:ml-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isOffline}
                        className="h-12 w-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                        onClick={() => openEdit(book)}
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isOffline}
                        className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10 transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                        onClick={() => deleteBook(book.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
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

