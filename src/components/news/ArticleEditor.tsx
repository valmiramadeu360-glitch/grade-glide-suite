import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heading2, Quote, Bold, List, ImagePlus, Eye, PenLine, Loader2, X, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARTICLE_CATEGORIES, Article, Journal, readMinutes, uploadNewsImage } from "@/lib/news";
import { ArticleBody } from "./ArticleBody";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  journal: Journal;
  article?: Article | null;
  onSaved: () => void;
}

export function ArticleEditor({ open, onOpenChange, journal, article, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("Campus");
  const [cover, setCover] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<"" | "upload" | "draft" | "published">("");

  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? "");
    setSubtitle(article?.subtitle ?? "");
    setContent(article?.content ?? "");
    setCategory(article?.category ?? "Campus");
    setCover(article?.cover_url ?? null);
    setPreview(false);
  }, [open, article]);

  function insert(prefix: string, suffix = "", block = true) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = content.slice(s, e) || (block ? "Texto" : "destaque");
    const before = content.slice(0, s);
    const pad = block && before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const next = before + pad + prefix + sel + suffix + (block ? "\n\n" : "") + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const p = before.length + pad.length + prefix.length;
      ta.setSelectionRange(p, p + sel.length);
    });
  }

  async function upload(file: File, asCover: boolean) {
    if (!user) return;
    setBusy("upload");
    try {
      const url = await uploadNewsImage(user.id, file);
      if (asCover) setCover(url);
      else setContent((c) => `${c.trimEnd()}\n\n![](${url})\n\n`);
    } catch (e: any) {
      toast({ title: "Falha ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function save(status: "draft" | "published") {
    if (!user) return;
    if (title.trim().length < 5 || content.trim().length < 30) {
      toast({
        title: "Matéria incompleta",
        description: "Escreva um título e pelo menos um parágrafo.",
        variant: "destructive",
      });
      return;
    }

    setBusy(status);
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      content: content.trim(),
      category,
      cover_url: cover,
      status,
      read_minutes: readMinutes(content),
      ...(status === "published" && article?.status !== "published" ? { published_at: new Date().toISOString() } : {}),
    };

    const { error } = article
      ? await (supabase as any).from("news_posts").update(payload).eq("id", article.id)
      : await (supabase as any).from("news_posts").insert({ ...payload, channel_id: journal.id, author_id: user.id });

    setBusy("");

    if (error) {
      toast({ title: "Não foi possível salvar a matéria", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: status === "published" ? "Matéria publicada com sucesso!" : "Rascunho salvo." });
    onSaved();
    onOpenChange(false);
  }

  const tools = [
    { icon: Heading2, label: "Intertítulo", run: () => insert("## ") },
    { icon: Bold, label: "Negrito", run: () => insert("**", "**", false) },
    { icon: Quote, label: "Citação", run: () => insert("> ") },
    { icon: List, label: "Lista", run: () => insert("- ") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-3xl w-full h-[100dvh] sm:h-[92vh] sm:rounded-3xl overflow-hidden flex flex-col [&>button]:hidden">
        <header className="flex items-center gap-2 px-4 h-14 border-b shrink-0 bg-background/80 backdrop-blur">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">{journal.name}</p>
            <p className="text-xs text-muted-foreground">{readMinutes(content)} min de leitura</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={() => setPreview(!preview)}>
            {preview ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? "Editar" : "Prévia"}
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {preview ? (
            <article className="max-w-2xl mx-auto px-5 py-6 space-y-4">
              {cover && <img src={cover} alt="" className="w-full aspect-[16/9] object-cover rounded-2xl shadow-sm" />}
              <p className="text-[11px] font-black uppercase tracking-widest text-primary">{category}</p>
              <h1 className="text-3xl font-black tracking-tight leading-tight">{title || "Título da matéria"}</h1>
              {subtitle && <p className="text-lg text-muted-foreground leading-snug">{subtitle}</p>}
              <p className="text-xs text-muted-foreground border-y py-2">
                Por {journal.name} · {readMinutes(content)} min de leitura
              </p>
              <ArticleBody content={content} />
            </article>
          ) : (
            <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">
              <label
                className={cn(
                  "relative block w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer border border-dashed bg-muted/40 transition hover:bg-muted/60",
                  cover && "border-none"
                )}
              >
                {cover ? (
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5">
                    <Camera className="h-7 w-7" />
                    <span className="text-sm font-bold">Adicionar imagem de capa</span>
                  </div>
                )}
                {cover && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold shadow">
                    Trocar capa
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], true)}
                />
              </label>

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {ARTICLE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition",
                      category === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary/40"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                rows={2}
                placeholder="Manchete da matéria..."
                className="w-full resize-none bg-transparent outline-none text-2xl sm:text-3xl font-black tracking-tight leading-tight placeholder:text-muted-foreground/50"
              />

              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={240}
                rows={2}
                placeholder="Linha fina: resuma a notícia em uma frase..."
                className="w-full resize-none bg-transparent outline-none text-base sm:text-lg text-muted-foreground leading-snug placeholder:text-muted-foreground/50"
              />

              <div className="sticky top-0 z-10 flex items-center gap-1 rounded-full border bg-background/95 backdrop-blur p-1 w-fit shadow-sm">
                {tools.map((t) => (
                  <Button
                    key={t.label}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    title={t.label}
                    onClick={t.run}
                  >
                    <t.icon className="h-4 w-4" />
                  </Button>
                ))}
                <label className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted cursor-pointer" title="Inserir imagem no corpo">
                  {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], false)}
                  />
                </label>
              </div>

              <textarea
                ref={ref}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Comece a escrever sua matéria... Separe parágrafos com uma linha em branco."
                className="w-full min-h-[45vh] resize-none bg-transparent outline-none text-[15px] leading-[1.8] placeholder:text-muted-foreground/50"
              />
            </div>
          )}
        </div>

        <footer className="flex gap-2 p-3 border-t shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background">
          {article?.status !== "published" && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full flex-1"
              disabled={!!busy}
              onClick={() => save("draft")}
            >
              {busy === "draft" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar rascunho
            </Button>
          )}
          <Button
            type="button"
            className="rounded-full flex-1 font-bold"
            disabled={!!busy}
            onClick={() => save("published")}
          >
            {busy === "published" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {article?.status === "published" ? "Atualizar matéria" : "Publicar"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
