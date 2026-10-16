import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck, Clock, Heart, Loader2, Newspaper, Plus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Article, ARTICLE_CATEGORIES, ARTICLE_SELECT, Journal,
  toggleArticleLike, toggleJournalFollow,
} from "@/lib/news";
import { ArticleBody } from "@/components/news/ArticleBody";
import { JournalApplyDialog } from "@/components/news/JournalApplyDialog";
import { cn } from "@/lib/utils";

const db = supabase as any;

export default function News() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [myJournalId, setMyJournalId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [reading, setReading] = useState<Article | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const [
      { data: posts },
      { data: chans },
      { data: memberships },
      { data: ownedJournals },
      { data: subs },
      { data: likes },
    ] = await Promise.all([
      db
        .from("news_posts")
        .select(ARTICLE_SELECT)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(60),

      db
        .from("news_channels")
        .select("*")
        .eq("status", "approved")
        .order("member_count", { ascending: false }),

      db
        .from("news_channel_members")
        .select("channel_id")
        .eq("user_id", user.id),

      db
        .from("news_channels")
        .select("id, status")
        .eq("created_by", user.id)
        .in("status", ["pending", "approved", "suspended"])
        .order("created_at", { ascending: false }),

      db
        .from("news_subscriptions")
        .select("channel_id")
        .eq("user_id", user.id),

      db
        .from("news_post_likes")
        .select("post_id")
        .eq("user_id", user.id),
    ]);

    setArticles(posts ?? []);
    setJournals(chans ?? []);

    /*
     * O fundador tem acesso à própria redação mesmo que ainda não exista
     * uma linha correspondente em news_channel_members.
     *
     * Isso é importante para compatibilidade com redações criadas/aprovadas
     * antes da correção definitiva feita na migration.
     */
    const memberIds = new Set(
      (memberships ?? []).map((m: any) => m.channel_id),
    );

    const approvedOwned = (ownedJournals ?? []).find(
      (j: any) => j.status === "approved",
    );

    setMyJournalId(
      approvedOwned?.id ??
      [...memberIds][0] ??
      null,
    );

    setFollowingIds(
      new Set((subs ?? []).map((s: any) => s.channel_id)),
    );

    setLikedIds(
      new Set((likes ?? []).map((l: any) => l.post_id)),
    );

    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const headline =
    articles.find((a) => a.pinned) ??
    articles[0] ??
    null;

  const rest = useMemo(
    () =>
      articles
        .filter((a) => a.id !== headline?.id)
        .filter((a) => !category || a.category === category),
    [articles, headline, category],
  );

  async function handleFollow(channelId: string) {
    if (!user) return;

    const isFollowing = followingIds.has(channelId);

    setFollowingIds((prev) => {
      const next = new Set(prev);

      if (isFollowing) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }

      return next;
    });

    await toggleJournalFollow(
      channelId,
      user.id,
      isFollowing,
    );
  }

  async function handleLike(article: Article) {
    if (!user) return;

    const liked = likedIds.has(article.id);

    setLikedIds((prev) => {
      const next = new Set(prev);

      if (liked) {
        next.delete(article.id);
      } else {
        next.add(article.id);
      }

      return next;
    });

    setArticles((prev) =>
      prev.map((a) =>
        a.id === article.id
          ? {
              ...a,
              like_count:
                a.like_count + (liked ? -1 : 1),
            }
          : a,
      ),
    );

    await toggleArticleLike(
      article.id,
      user.id,
      liked,
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">
          Notícias
        </h1>

        <Button
          onClick={() =>
            myJournalId
              ? navigate(`/newsroom/${myJournalId}`)
              : setApplyOpen(true)
          }
          className="h-11 gap-1.5 rounded-2xl px-4 font-bold"
        >
          {myJournalId ? (
            <>
              <Newspaper className="h-4 w-4" />
              Minha Redação
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Fundar um Jornal
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : articles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/50 py-16 text-center text-sm text-muted-foreground">
          Nenhuma matéria publicada na sua universidade ainda.
          Seja o primeiro jornal a publicar!
        </p>
      ) : (
        <>
          {/* Manchete do dia */}
          {headline && (
            <button
              onClick={() => setReading(headline)}
              className="block w-full overflow-hidden rounded-[28px] border border-border/40 bg-card text-left"
            >
              {headline.cover_url && (
                <img
                  src={headline.cover_url}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
              )}

              <div className="p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                  {headline.category}
                </p>

                <h2 className="mt-1 text-2xl font-black leading-tight tracking-tight">
                  {headline.title}
                </h2>

                {headline.subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {headline.subtitle}
                  </p>
                )}

                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  {headline.news_channels?.name} ·{" "}
                  {headline.read_minutes} min
                </p>
              </div>
            </button>
          )}

          {/* Categorias */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Pill
              label="Tudo"
              active={category === null}
              onClick={() => setCategory(null)}
            />

            {ARTICLE_CATEGORIES.map((c) => (
              <Pill
                key={c}
                label={c}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>

          {/* Jornais recomendados */}
          {journals.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {journals.slice(0, 10).map((j) => (
                <div
                  key={j.id}
                  className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card p-3 text-center"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={j.logo_url ?? undefined}
                      className="object-cover"
                    />

                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Newspaper className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>

                  <p className="line-clamp-2 text-xs font-bold leading-tight">
                    {j.name}
                  </p>

                  <Button
                    size="sm"
                    variant={
                      followingIds.has(j.id)
                        ? "outline"
                        : "default"
                    }
                    className="h-7 w-full rounded-full text-[11px] font-bold"
                    onClick={() => handleFollow(j.id)}
                  >
                    {followingIds.has(j.id)
                      ? "Seguindo"
                      : "Seguir"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Lista de matérias */}
          <div className="space-y-3">
            {rest.map((a) => (
              <button
                key={a.id}
                onClick={() => setReading(a)}
                className="flex w-full gap-3 rounded-2xl border border-border/40 bg-card p-3 text-left"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted/40">
                  {a.cover_url && (
                    <img
                      src={a.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    {a.news_channels?.name}

                    {a.news_channels?.scope && (
                      <BadgeCheck className="h-3 w-3 text-primary" />
                    )}
                  </p>

                  <p className="line-clamp-2 text-sm font-bold leading-snug">
                    {a.title}
                  </p>

                  <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.read_minutes} min
                    </span>

                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {a.like_count}
                    </span>
                  </p>
                </div>
              </button>
            ))}

            {rest.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma matéria nessa categoria ainda.
              </p>
            )}
          </div>
        </>
      )}

      <JournalApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        onCreated={load}
      />

      {/* Leitura da matéria */}
      {reading && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
          <div className="mx-auto max-w-2xl px-5 py-4">
            <button
              onClick={() => setReading(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/60"
            >
              <X className="h-5 w-5" />
            </button>

            <article className="space-y-4 pt-2 pb-16">
              {reading.cover_url && (
                <img
                  src={reading.cover_url}
                  alt=""
                  className="aspect-[16/9] w-full rounded-2xl object-cover"
                />
              )}

              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={
                      reading.news_channels?.logo_url ??
                      undefined
                    }
                  />

                  <AvatarFallback>
                    <Newspaper className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>

                <span className="text-sm font-bold">
                  {reading.news_channels?.name}
                </span>
              </div>

              <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                {reading.category}
              </p>

              <h1 className="text-3xl font-black leading-tight tracking-tight">
                {reading.title}
              </h1>

              {reading.subtitle && (
                <p className="text-lg leading-snug text-muted-foreground">
                  {reading.subtitle}
                </p>
              )}

              <p className="border-y border-border/30 py-2 text-xs text-muted-foreground">
                {reading.read_minutes} min de leitura
              </p>

              <ArticleBody content={reading.content} />

              <button
                onClick={() => handleLike(reading)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold",
                  likedIds.has(reading.id)
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border/50 text-muted-foreground",
                )}
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    likedIds.has(reading.id) &&
                      "fill-current",
                  )}
                />

                {reading.like_count}
              </button>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/50 text-muted-foreground hover:bg-muted/40",
      )}
    >
      {label}
    </button>
  );
}
