import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, BadgeCheck, Clock, FileText, Heart, Loader2, Newspaper, PenLine,
  Plus, Settings, UserPlus, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Article, ARTICLE_SELECT, categoryLabel, fetchJournalTeam, Journal, JOURNAL_STATUS_LABEL,
  inviteWriter, plainExcerpt, uploadNewsImage, type ChannelMember,
} from "@/lib/news";
import { ArticleEditor } from "@/components/news/ArticleEditor";
import { cn } from "@/lib/utils";

const db = supabase as any;

export default function NewsroomView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [team, setTeam] = useState<ChannelMember[]>([]);
  const [published, setPublished] = useState<Article[]>([]);
  const [drafts, setDrafts] = useState<Article[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    const [
      { data: j },
      teamRows,
      { data: pub },
      { data: dft },
    ] = await Promise.all([
      db
        .from("news_channels")
        .select("*")
        .eq("id", id)
        .maybeSingle(),

      fetchJournalTeam(id),

      db
        .from("news_posts")
        .select(ARTICLE_SELECT)
        .eq("channel_id", id)
        .eq("status", "published")
        .order("published_at", { ascending: false }),

      db
        .from("news_posts")
        .select(ARTICLE_SELECT)
        .eq("channel_id", id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false }),
    ]);

    setJournal(j ?? null);
    setTeam(teamRows);
    setPublished(pub ?? []);
    setDrafts(dft ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!journal) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Esta redação não existe ou você não faz parte da equipe.
      </p>
    );
  }

  /*
   * O fundador é editor-chefe por definição.
   *
   * Isso mantém compatibilidade com redações antigas nas quais o fundador
   * foi aprovado antes de existir o registro correspondente em
   * news_channel_members.
   *
   * Para os demais integrantes, a função continua dependendo da membership
   * com role = editor_in_chief.
   */
  const isEditor =
    journal.created_by === user?.id ||
    team.some(
      (m) =>
        m.user_id === user?.id &&
        m.role === "editor_in_chief",
    );

  const totalLikes = published.reduce(
    (s, a) => s + (a.like_count || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 sm:py-6">
      <button
        onClick={() => navigate("/news")}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Notícias
      </button>

      {/* Cabeçalho */}
      <div className="overflow-hidden rounded-[28px] border border-border/40 bg-card">
        <div
          className="h-24 bg-gradient-to-r from-primary/30 to-accent/30"
          style={
            journal.banner_url
              ? {
                  backgroundImage: `url(${journal.banner_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />

        <div className="flex items-start gap-4 p-4 pt-0">
          <Avatar className="-mt-8 h-20 w-20 border-4 border-card shadow-sm">
            <AvatarImage
              src={journal.logo_url ?? undefined}
              className="object-cover"
            />

            <AvatarFallback className="bg-primary/10 text-primary">
              <Newspaper className="h-7 w-7" />
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pt-2">
            <p className="flex items-center gap-1.5 truncate text-lg font-extrabold leading-tight">
              {journal.name}

              {journal.status === "approved" && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
              )}
            </p>

            {journal.handle && (
              <p className="text-xs font-semibold text-muted-foreground">
                @{journal.handle} · {categoryLabel(journal.category)}
              </p>
            )}

            <span
              className={cn(
                "mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                journal.status === "approved"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : journal.status === "pending"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {JOURNAL_STATUS_LABEL[journal.status]}
            </span>
          </div>

          {isEditor && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>

        {journal.status === "pending" && (
          <p className="border-t border-border/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Sua solicitação está em análise pelo administrador do EduConect.
            Você recebe um aviso no sino quando for respondida.
          </p>
        )}

        {journal.status === "rejected" &&
          journal.review_note && (
            <p className="border-t border-border/30 px-4 py-3 text-xs leading-relaxed text-destructive">
              Motivo da recusa: {journal.review_note}
            </p>
          )}
      </div>

      {/* Números */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Users}
          label="Assinantes"
          value={journal.member_count}
        />

        <StatCard
          icon={FileText}
          label="Publicadas"
          value={published.length}
        />

        <StatCard
          icon={Heart}
          label="Curtidas"
          value={totalLikes}
        />
      </div>

      {journal.status === "approved" && (
        <Button
          onClick={() => {
            setEditingArticle(null);
            setEditorOpen(true);
          }}
          className="h-12 w-full gap-2 rounded-2xl font-bold"
        >
          <Plus className="h-4 w-4" />
          Nova matéria
        </Button>
      )}

      <Tabs defaultValue="published">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/40 p-1">
          <TabsTrigger
            value="published"
            className="rounded-xl text-xs font-bold"
          >
            Publicadas
          </TabsTrigger>

          <TabsTrigger
            value="drafts"
            className="rounded-xl text-xs font-bold"
          >
            Rascunhos
          </TabsTrigger>

          <TabsTrigger
            value="team"
            className="rounded-xl text-xs font-bold"
          >
            Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="published"
          className="mt-3 space-y-2"
        >
          {published.length === 0 ? (
            <EmptyRow text="Nenhuma matéria publicada ainda." />
          ) : (
            published.map((a) => (
              <ArticleRow
                key={a.id}
                article={a}
                onClick={() => {
                  setEditingArticle(a);
                  setEditorOpen(true);
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent
          value="drafts"
          className="mt-3 space-y-2"
        >
          {drafts.length === 0 ? (
            <EmptyRow text="Nenhum rascunho." />
          ) : (
            drafts.map((a) => (
              <ArticleRow
                key={a.id}
                article={a}
                onClick={() => {
                  setEditingArticle(a);
                  setEditorOpen(true);
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent
          value="team"
          className="mt-3 space-y-2"
        >
          {isEditor && (
            <Button
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="mb-1 h-11 w-full gap-2 rounded-2xl font-bold"
            >
              <UserPlus className="h-4 w-4" />
              Convidar colega
            </Button>
          )}

          {journal.created_by &&
            !team.some(
              (m) => m.user_id === journal.created_by,
            ) && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    E
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    Você
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Editor-chefe · fundador
                  </p>
                </div>
              </div>
            )}

          {team.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={
                    m.profile?.avatar_url ??
                    undefined
                  }
                />

                <AvatarFallback className="bg-primary/10 text-primary">
                  {(m.profile?.full_name || "E").charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {m.profile?.full_name ||
                    "Estudante"}
                </p>

                <p className="text-xs text-muted-foreground">
                  {m.role === "editor_in_chief"
                    ? "Editor-chefe"
                    : "Redator(a)"}
                </p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {journal.status === "approved" && (
        <ArticleEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          journal={journal}
          article={editingArticle}
          onSaved={load}
        />
      )}

      <JournalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        journal={journal}
        onSaved={(j) => setJournal(j)}
      />

      <InviteWriterDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        channelId={journal.id}
        onInvited={load}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border/40 bg-card py-3">
      <Icon className="h-4 w-4 text-primary" />

      <span className="text-lg font-extrabold leading-none">
        {value}
      </span>

      <span className="text-[11px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function ArticleRow({
  article,
  onClick,
}: {
  article: Article;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card p-3 text-left"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted/40">
        {article.cover_url && (
          <img
            src={article.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {article.title}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {plainExcerpt(article.content, 70)}
        </p>

        <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {article.read_minutes} min
          </span>

          {article.status === "published" && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {article.like_count}
            </span>
          )}
        </p>
      </div>

      <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ---------------- Configurações do jornal ---------------- */

function JournalSettingsDialog({
  open,
  onOpenChange,
  journal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  journal: Journal;
  onSaved: (j: Journal) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [description, setDescription] = useState(
    journal.description ?? "",
  );

  const [editorialLine, setEditorialLine] =
    useState(journal.editorial_line ?? "");

  const [banner, setBanner] =
    useState<File | null>(null);

  const [logo, setLogo] =
    useState<File | null>(null);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    setDescription(
      journal.description ?? "",
    );

    setEditorialLine(
      journal.editorial_line ?? "",
    );

    setBanner(null);
    setLogo(null);
  }, [open, journal]);

  async function save() {
    if (!user) return;

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        description: description.trim(),
        editorial_line:
          editorialLine.trim(),
      };

      if (logo) {
        payload.logo_url =
          await uploadNewsImage(
            user.id,
            logo,
          );
      }

      if (banner) {
        payload.banner_url =
          await uploadNewsImage(
            user.id,
            banner,
          );
      }

      const { data, error } =
        await db
          .from("news_channels")
          .update(payload)
          .eq("id", journal.id)
          .select("*")
          .single();

      if (error) throw error;

      toast({
        title:
          "Perfil do jornal atualizado",
      });

      onSaved(data);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title:
          "Não foi possível salvar",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="rounded-[28px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Personalizar jornal
          </DialogTitle>

          <DialogDescription>
            Nome e @ não mudam depois de aprovado
            — fale com a moderação se precisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="cursor-pointer text-sm font-bold text-primary">
              Trocar logo

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  setLogo(
                    e.target.files?.[0] ??
                      null,
                  )
                }
              />
            </label>

            <label className="cursor-pointer text-sm font-bold text-primary">
              Trocar capa

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  setBanner(
                    e.target.files?.[0] ??
                      null,
                  )
                }
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>
              Descrição curta
            </Label>

            <Textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value,
                )
              }
              maxLength={200}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Linha editorial
            </Label>

            <Textarea
              value={editorialLine}
              onChange={(e) =>
                setEditorialLine(
                  e.target.value,
                )
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancelar
          </Button>

          <Button
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Convidar redator ---------------- */

function InviteWriterDialog({
  open,
  onOpenChange,
  channelId,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  channelId: string;
  onInvited: () => void;
}) {
  const { toast } = useToast();

  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<
      {
        user_id: string;
        display_name: string | null;
        avatar_url: string | null;
      }[]
    >([]);

  const [inviting, setInviting] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      const { data } =
        await db
          .from("public_profiles")
          .select(
            "user_id, display_name, avatar_url",
          )
          .ilike(
            "display_name",
            `%${query.trim()}%`,
          )
          .limit(8);

      setResults(data ?? []);
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  async function handleInvite(
    userId: string,
  ) {
    setInviting(userId);

    try {
      await inviteWriter(
        channelId,
        userId,
      );

      toast({
        title:
          "Redator adicionado à equipe",
      });

      onInvited();
    } catch (e: any) {
      toast({
        title:
          "Não foi possível convidar",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setInviting(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="rounded-[28px] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Convidar colega
          </DialogTitle>

          <DialogDescription>
            Busque pelo nome — só gente da sua
            universidade aparece.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
          placeholder="Nome do colega"
          className="h-12 rounded-2xl"
        />

        <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.user_id}
              className="flex items-center gap-3 rounded-2xl border border-border/40 p-2.5"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={
                    r.avatar_url ??
                    undefined
                  }
                />

                <AvatarFallback>
                  {(r.display_name ||
                    "E").charAt(0)}
                </AvatarFallback>
              </Avatar>

              <span className="flex-1 truncate text-sm font-semibold">
                {r.display_name ||
                  "Estudante"}
              </span>

              <Button
                size="sm"
                className="h-8 rounded-xl text-xs font-bold"
                disabled={
                  inviting === r.user_id
                }
                onClick={() =>
                  handleInvite(
                    r.user_id,
                  )
                }
              >
                {inviting === r.user_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Convidar"
                )}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
        }
