import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Newspaper, ArrowLeft, Pin, Compass, BellRing, BellOff,
  Loader2, ExternalLink, Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NewsChannel {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  member_count: number;
  banner_url: string | null;
}

interface NewsPost {
  id: string;
  channel_id: string;
  title: string;
  content: string;
  cover_url: string | null;
  link_url: string | null;
  pinned: boolean;
  published_at: string;
  news_channels?: { name: string; scope: string } | null;
}

const SCOPE_LABEL: Record<string, string> = {
  global: "Global",
  university: "Universidade",
  campus: "Campus",
  course: "Curso",
};

export default function News() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("foryou");
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<NewsChannel[]>([]);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [activePost, setActivePost] = useState<NewsPost | null>(null);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [subsRes, channelsRes, postsRes] = await Promise.all([
        supabase.from("news_subscriptions").select("channel_id").eq("user_id", user!.id),
        supabase.from("news_channels").select("*").eq("is_active", true).order("member_count", { ascending: false }),
        supabase.from("news_posts").select("*, news_channels(name, scope)").order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(80),
      ]);
      setSubs(new Set((subsRes.data ?? []).map((s: any) => s.channel_id)));
      setChannels(channelsRes.data ?? []);
      setPosts(postsRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscribe(channelId: string) {
    if (!user) return;
    const isSubbed = subs.has(channelId);
    if (isSubbed) {
      await supabase.from("news_subscriptions").delete().eq("channel_id", channelId).eq("user_id", user.id);
      setSubs((prev) => { const n = new Set(prev); n.delete(channelId); return n; });
      toast({ title: "Inscrição cancelada" });
    } else {
      await supabase.from("news_subscriptions").insert({ channel_id: channelId, user_id: user.id });
      setSubs((prev) => new Set(prev).add(channelId));
      toast({ title: "Inscrição confirmada" });
    }
  }

  const visiblePosts = useMemo(() => {
    if (tab === "pinned") return posts.filter((p) => p.pinned);
    if (tab === "foryou") return posts.filter((p) => subs.has(p.channel_id));
    return posts;
  }, [posts, tab, subs]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4 sm:px-6 pt-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-11 w-11 rounded-2xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Central de Notícias</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Canais institucionais e oficiais
            </p>
          </div>
        </div>
      </header>

      {/* Canais inscritos (chips) */}
      {channels.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
            Canais disponíveis
          </p>
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => {
              const active = subs.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleSubscribe(c.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all active:scale-95 text-xs font-bold",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border/50 text-foreground hover:border-primary/40"
                  )}
                >
                  {active ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  <span className="truncate max-w-[160px]">{c.name}</span>
                  <span className="text-[10px] opacity-70">{SCOPE_LABEL[c.scope]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="foryou" className="flex-1 rounded-full font-bold gap-1.5 text-xs">
            <Newspaper className="h-3.5 w-3.5" /> Para você
          </TabsTrigger>
          <TabsTrigger value="explore" className="flex-1 rounded-full font-bold gap-1.5 text-xs">
            <Compass className="h-3.5 w-3.5" /> Explorar
          </TabsTrigger>
          <TabsTrigger value="pinned" className="flex-1 rounded-full font-bold gap-1.5 text-xs">
            <Pin className="h-3.5 w-3.5" /> Fixados
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {visiblePosts.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="p-12 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {tab === "foryou"
                    ? "Inscreva-se em um canal para receber notícias."
                    : tab === "pinned"
                    ? "Nenhuma notícia fixada no momento."
                    : "Sem novidades por enquanto."}
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePosts.map((p) => (
              <Card
                key={p.id}
                onClick={() => setActivePost(p)}
                className="rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group"
              >
                {p.cover_url && (
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.pinned && (
                      <Badge variant="default" className="text-[9px] gap-1 rounded-full">
                        <Pin className="h-2.5 w-2.5" /> Fixado
                      </Badge>
                    )}
                    {p.news_channels && (
                      <Badge variant="secondary" className="text-[9px] rounded-full">
                        {p.news_channels.name}
                      </Badge>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(p.published_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight leading-snug group-hover:text-primary transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {p.content}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Detalhe */}
      <Dialog open={!!activePost} onOpenChange={(o) => !o && setActivePost(null)}>
        <DialogContent className="rounded-3xl max-w-2xl max-h-[85vh] overflow-y-auto">
          {activePost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight leading-tight pr-6">
                  {activePost.title}
                </DialogTitle>
              </DialogHeader>
              {activePost.cover_url && (
                <img src={activePost.cover_url} alt="" className="rounded-2xl w-full aspect-video object-cover" />
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {activePost.content}
              </div>
              {activePost.link_url && (
                <a
                  href={activePost.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar conteúdo completo
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}