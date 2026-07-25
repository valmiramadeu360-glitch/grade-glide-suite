import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog as PollDialog,
  DialogContent as PollDialogContent,
  DialogHeader as PollDialogHeader,
  DialogTitle as PollDialogTitle,
  DialogDescription as PollDialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Globe,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Image as ImageIcon,
  FileText,
  Video,
  Send,
  Loader2,
  Trash2,
  Download,
  Bookmark,
  Share2,
  BadgeCheck,
  X,
  Plus,
  Newspaper,
  PenLine,
  BarChart3,
  ExternalLink,
  Pin,
  Store,
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommunities } from "@/hooks/useCommunities";

const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Evento", "Desabafo"];
const MARKETPLACE_TAGS = ["Venda de Livro", "República", "Vaga de Estágio", "Doação"];

interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  tag: string | null;
  created_at: string;
  profiles?: any;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  user_saved: boolean;
}

export default function Connect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { communities } = useCommunities();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTop = searchParams.get("tab") === "news" ? "news" : searchParams.get("tab") === "saved" ? "saved" : "feed";
  const [topTab, setTopTab] = useState<string>(initialTop);
  const [tab, setTab] = useState("global");
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "article" | "document" | "poll">("text");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // News feed
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeNews, setActiveNews] = useState<any | null>(null);

  // News composer
  const [newsComposerOpen, setNewsComposerOpen] = useState(false);
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [newsChannelId, setNewsChannelId] = useState<string>("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsLink, setNewsLink] = useState("");
  const [publishingNews, setPublishingNews] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (topTab !== "feed") return;
    loadFollowing();
    loadPosts();
  }, [user, tab, activeCommunity, topTab]);

  useEffect(() => {
    if (!user) return;
    if (topTab === "news") loadNews();
    if (topTab === "saved") loadSavedPosts();
  }, [user, topTab]);

  async function loadMyChannels() {
    if (!user) return;
    const { data: subs } = await supabase
      .from("news_subscriptions")
      .select("channel_id, news_channels(id, name, scope)")
      .eq("user_id", user.id);
    const channels = (subs ?? []).map((s: any) => s.news_channels).filter(Boolean);
    setMyChannels(channels);
    if (channels[0]?.id) setNewsChannelId(channels[0].id);
  }

  async function publishNews() {
    if (!user || !newsChannelId || !newsTitle.trim()) return;
    setPublishingNews(true);
    try {
      const { error } = await supabase.from("news_posts").insert({
        channel_id: newsChannelId,
        author_id: user.id,
        title: newsTitle.trim(),
        content: newsContent.trim() || newsTitle.trim(),
        link_url: newsLink.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Notícia publicada!" });
      setNewsComposerOpen(false);
      setNewsTitle(""); setNewsContent(""); setNewsLink("");
      loadNews();
    } catch (e: any) {
      toast({
        title: "Permissão Negada",
        description: "Apenas administradores podem publicar notícias oficiais.",
        variant: "destructive",
      });
    } finally {
      setPublishingNews(false);
    }
  }

  function changeTopTab(v: string) {
    setTopTab(v);
    setSearchParams(v === "feed" ? {} : { tab: v }, { replace: true });
  }

  async function loadNews() {
    setNewsLoading(true);
    try {
      const { data } = await supabase
        .from("news_posts")
        .select("*, news_channels(name, scope)")
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(50);
      setNewsItems(data ?? []);
    } finally {
      setNewsLoading(false);
    }
  }

  async function loadSavedPosts() {
    setLoading(true);
    try {
      const { data: saved } = await supabase.from("saved_posts").select("post_id").eq("user_id", user!.id);
      const ids = (saved ?? []).map((s: any) => s.post_id);
      if (ids.length === 0) { setPosts([]); return; }
      const { data } = await supabase.from("posts").select("*").in("id", ids).order("created_at", { ascending: false });
      if (data) setPosts(await fetchMetricsForPosts(data));
    } finally { setLoading(false); }
  }

  async function loadFollowing() {
    if (!user) return;
    try {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      setFollowingIds((data ?? []).map((f: any) => f.following_id));
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMetricsForPosts(postsData: any[]) {
    if (!postsData || postsData.length === 0 || !user) return [];
    const postIds = postsData.map(p => p.id);
    const userIds = Array.from(new Set(postsData.map(p => p.user_id)));

    const [likes, comments, saved, profs] = await Promise.all([
      supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      supabase.from("profiles").select("user_id,full_name,avatar_url").in("user_id", userIds)
    ]);

    const likesMap: any = {};
    (likes.data ?? []).forEach((l: any) => {
      if (!likesMap[l.post_id]) { likesMap[l.post_id] = { count: 0, userLiked: false }; }
      likesMap[l.post_id].count++;
      if (l.user_id === user.id) { likesMap[l.post_id].userLiked = true; }
    });

    const commentsMap: any = {};
    (comments.data ?? []).forEach((c: any) => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });

    const savedSet = new Set((saved.data ?? []).map((s: any) => s.post_id));
    const profileMap: Record<string, any> = {};
    (profs.data ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });

    return postsData.map(p => ({
      ...p,
      profiles: profileMap[p.user_id] ?? null,
      likes_count: likesMap[p.id]?.count || 0,
      comments_count: commentsMap[p.id] || 0,
      user_liked: likesMap[p.id]?.userLiked || false,
      user_saved: savedSet.has(p.id)
    }));
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (tab === "oportunidades") { query = query.in("tag", MARKETPLACE_TAGS); }
      else if (tab !== "oportunidades") { query = query.not("tag", "in", `(${MARKETPLACE_TAGS.join(',')})`); }
      if (activeCommunity) { query = query.eq("community_id", activeCommunity); } 
      else { query = query.is("community_id", null); }

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        const postsWithMetrics = await fetchMetricsForPosts(data);
        setPosts(postsWithMetrics);
      }
    } catch (e) {
      toast({ title: "Erro ao carregar feed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl("pdf-preview");
    }
  }

  async function handlePost() {
    if ((!newContent.trim() && !selectedFile) || !user) return;
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      let documentUrl: string | null = null;
      let videoUrl: string | null = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const bucket = mediaType === "document" ? "post-documents" : "post-media";
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, selectedFile);
        if (uploadError) throw uploadError;

        if (bucket === "post-documents") {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 365);
          documentUrl = signed?.signedUrl ?? null;
        } else {
          const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (mediaType === "video") videoUrl = data.publicUrl;
          else mediaUrl = data.publicUrl;
        }
      }

      const insertPayload: any = {
        user_id: user.id, content: newContent.trim(), media_url: mediaUrl, tag: selectedTag, community_id: activeCommunity, media_type: mediaType, title: newTitle || null, document_url: documentUrl, video_url: videoUrl,
      };
      
      const { data: created, error } = await supabase.from("posts").insert(insertPayload).select().single();
      if (error) throw error;

      if (mediaType === "poll" && created) {
        const opts = pollOptions.map(o => o.trim()).filter(Boolean);
        if (pollQuestion.trim() && opts.length >= 2) {
          await supabase.from("post_polls").insert({ post_id: created.id, question: pollQuestion.trim(), options: opts } as any);
        }
      }

      setNewContent(""); setNewTitle(""); setPollQuestion(""); setPollOptions(["", ""]); setSelectedFile(null); setPreviewUrl(null); setSelectedTag(null); setMediaType("text"); setComposerOpen(false);
      toast({ title: "Publicação no ar!" });
      loadPosts();
    } catch (e: any) {
      toast({ title: "Erro ao postar", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(post: Post) {
    if (!user) return;
    try {
      if (post.user_liked) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      }
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !p.user_liked, likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    } catch (e: any) {
      toast({ title: "Erro ao curtir", description: e.message, variant: "destructive" });
    }
  }

  async function handleSave(post: Post) {
    if (!user) return;
    try {
      if (post.user_saved) {
        await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
      }
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_saved: !p.user_saved } : p));
    } catch {}
  }

  async function handleDelete(post: Post) {
    if (!window.confirm("Deseja apagar esta publicação?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast({ title: "Publicação removida." });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  async function openComments(post: Post) {
    setActivePost(post);
    setCommentModalOpen(true);
    try {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      setPostComments(await attachCommentProfiles(data ?? []));
    } catch {
      setPostComments([]);
    }
  }

  async function sendComment() {
    if (!user || !activePost || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const { error } = await supabase.from("post_comments").insert({ post_id: activePost.id, user_id: user.id, content: newComment.trim() });
      if (error) throw error;
      setNewComment("");
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", activePost.id).order("created_at", { ascending: true });
      setPostComments(await attachCommentProfiles(data ?? []));
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  }

  async function attachCommentProfiles(comments: any[]) {
    if (comments.length === 0) return [];
    const ids = Array.from(new Set(comments.map((c) => c.user_id)));
    const { data } = await supabase.from("profiles").select("user_id,full_name,avatar_url").in("user_id", ids);
    const map: Record<string, any> = {};
    (data ?? []).forEach((p: any) => { map[p.user_id] = p; });
    return comments.map((c) => ({ ...c, profiles: map[c.user_id] ?? null }));
  }

  const visiblePosts = useMemo(() => {
    if (tab === "following") { return posts.filter(p => followingIds.includes(p.user_id)); }
    return posts;
  }, [posts, tab, followingIds]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in">
      
      {/* HEADER COMPACTO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Connect</h1>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
              Campus Digital
            </p>
          </div>
        </div>
        
        {/* BOTÃO FLUTUANTE DE POSTAGEM - PREMIUM */}
        {topTab === "feed" && (
          <Button onClick={() => setComposerOpen(true)} size="sm" className="rounded-full shadow-md hover:scale-105 transition-all text-xs font-bold px-4 h-9">
            <PenLine className="h-3.5 w-3.5 mr-1.5" /> Criar Post
          </Button>
        )}
      </div>

      {/* TOP TABS COMPACTAS */}
      <Tabs value={topTab} onValueChange={changeTopTab}>
        <TabsList className="w-full rounded-2xl bg-muted/50 p-1 flex">
          <TabsTrigger value="feed" className="flex-1 rounded-xl font-bold text-[11px] sm:text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Feed</TabsTrigger>
          <TabsTrigger value="news" className="flex-1 rounded-xl font-bold text-[11px] sm:text-xs"><Newspaper className="h-3.5 w-3.5 mr-1" />Painel</TabsTrigger>
          <TabsTrigger value="saved" className="flex-1 rounded-xl font-bold text-[11px] sm:text-xs"><Bookmark className="h-3.5 w-3.5 mr-1" />Salvos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* MODAL DO COMPOSER (Rede Social e Marketplace unificados no design) */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="rounded-[28px] p-5 sm:max-w-md border-0 shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black">Nova Publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[...ACADEMIC_TAGS, ...MARKETPLACE_TAGS].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all border",
                    selectedTag === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border/50 hover:bg-muted"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Sobre o que vamos conversar hoje?"
              rows={4}
              className="rounded-2xl resize-none border-0 bg-muted/40 focus-visible:ring-1 text-sm p-3"
            />

            {previewUrl && previewUrl !== "pdf-preview" && (
              <div className="relative">
                {mediaType === "video" ? (
                  <video src={previewUrl} controls className="rounded-xl w-full max-h-48 object-cover" />
                ) : (
                  <img src={previewUrl} className="rounded-xl w-full max-h-48 object-cover" />
                )}
                <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-sm" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            
            {previewUrl === "pdf-preview" && selectedFile && (
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs font-bold truncate flex-1">{selectedFile.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex items-center gap-1">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { setMediaType(e.target.files?.[0]?.type.startsWith('video') ? "video" : "image"); handleFileSelect(e); }} />
                  <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"><ImageIcon className="h-4 w-4" /></div>
                </label>
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { setMediaType("document"); handleFileSelect(e); }} />
                  <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"><FileText className="h-4 w-4" /></div>
                </label>
              </div>
              <Button onClick={handlePost} disabled={posting || (!newContent.trim() && !selectedFile)} className="rounded-full font-bold h-9 px-5 text-xs">
                {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />} Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FEED SECUNDÁRIO (Abas de Rede Social vs Marketplace) */}
      {topTab === "feed" && (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full rounded-2xl bg-muted/40 p-1 grid grid-cols-3">
            <TabsTrigger value="global" className="rounded-xl font-bold text-[11px] sm:text-xs">Geral</TabsTrigger>
            <TabsTrigger value="following" className="rounded-xl font-bold text-[11px] sm:text-xs">Seguindo</TabsTrigger>
            <TabsTrigger value="oportunidades" className="rounded-xl font-bold text-[11px] sm:text-xs flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Mercado</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Comunidades Filtro */}
      {topTab === "feed" && communities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setActiveCommunity(null)} className={cn("shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border", activeCommunity === null ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted")}>Feed Geral</button>
          {communities.map((c) => {
            const Icon = c.type === "university" ? "🎓" : c.type === "campus" ? "🏛️" : c.type === "course" ? "📚" : "#";
            return (
              <button key={c.id} onClick={() => setActiveCommunity(c.id)} className={cn("shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border whitespace-nowrap", activeCommunity === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted")}>
                <span className="mr-1">{Icon}</span>{c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* LISTAGEM DE POSTS (FEED E SAVED) */}
      {(topTab === "feed" || topTab === "saved") && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : visiblePosts.length === 0 ? (
          <div className="p-10 text-center rounded-[24px] bg-muted/30 border-2 border-dashed border-border/50">
            <Globe className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">O feed está calmo hoje.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePosts.map((p) => (
              <PostCard key={p.id} post={p} isOwner={p.user_id === user?.id} onLike={() => handleLike(p)} onSave={() => handleSave(p)} onComment={() => openComments(p)} onDelete={() => handleDelete(p)} />
            ))}
          </div>
        )
      )}

      {/* TELA DE NOTÍCIAS */}
      {topTab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-2xl border border-border/50">
              <div>
                <p className="text-xs font-bold">Painel Oficial</p>
                <p className="text-[10px] text-muted-foreground">Comunicados do campus</p>
              </div>
              <Button size="sm" className="rounded-full h-8 px-3 text-xs" onClick={() => { loadMyChannels(); setNewsComposerOpen(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Nova
              </Button>
            </div>
            
            {newsItems.length === 0 ? (
              <p className="text-center text-sm font-medium text-muted-foreground py-8">Sem avisos recentes.</p>
            ) : (
              newsItems.map((n) => (
                <Card key={n.id} className="rounded-[24px] overflow-hidden cursor-pointer hover:shadow-md transition-all border-0 shadow-sm" onClick={() => setActiveNews(n)}>
                  {n.cover_url && <img src={n.cover_url} className="w-full h-32 object-cover" />}
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      {n.pinned && <Pin className="h-3 w-3 text-primary" />}
                      <Badge variant="secondary" className="rounded-lg text-[9px] font-bold px-1.5">{n.news_channels?.name ?? "Canal"}</Badge>
                      <span className="text-[9px] font-semibold text-muted-foreground ml-auto">{formatDistanceToNow(new Date(n.published_at), { locale: ptBR, addSuffix: true })}</span>
                    </div>
                    <h3 className="font-bold text-sm leading-tight text-foreground">{n.title}</h3>
                    {n.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.content}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )
      )}

      {/* MODAL DE COMENTÁRIOS */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="rounded-[28px] max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          <div className="p-4 border-b border-border/40 bg-muted/20">
            <h3 className="font-black text-base">Comentários</h3>
          </div>
          <ScrollArea className="h-[40vh] p-4 bg-background">
            {postComments.length === 0 ? (
              <p className="text-center text-xs font-semibold text-muted-foreground py-8">Seja o primeiro a interagir.</p>
            ) : (
              <div className="space-y-4">
                {postComments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={c.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{c.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex-1">
                      <p className="text-[11px] font-bold text-foreground">{c.profiles?.full_name || "Estudante"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-3 border-t border-border/40 bg-background flex gap-2">
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva algo..." className="h-10 rounded-full bg-muted/50 border-0 text-sm focus-visible:ring-primary" onKeyDown={(e) => { if (e.key === "Enter") sendComment(); }} />
            <Button size="icon" onClick={sendComment} disabled={sendingComment || !newComment.trim()} className="h-10 w-10 rounded-full shrink-0 shadow-sm">
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// POST CARD ATUALIZADO E COMPACTO
function PostCard({ post, onLike, onSave, onComment, isOwner, onDelete }: any) {
  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i) || post.document_url;
  const mediaSource = post.document_url || post.video_url || post.media_url;

  return (
    <Card className="rounded-[24px] border-0 shadow-sm bg-card overflow-hidden">
      <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
        <div className="flex gap-2.5 items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{post.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-[13px] leading-tight text-foreground">{post.profiles?.full_name || "Estudante"}</p>
            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: true })}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground"><MoreHorizontal className="h-4 w-4"/></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-semibold"><Trash2 className="h-3.5 w-3.5 mr-2"/>Apagar post</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(post.content)} className="font-semibold"><Share2 className="h-3.5 w-3.5 mr-2"/>Copiar texto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-4">
        {post.tag && <Badge variant="secondary" className="mb-2.5 rounded-lg text-[9px] font-bold px-2">{post.tag}</Badge>}
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{post.content}</p>
        
        {mediaSource && (
          <div className="mt-3">
            {isPdf ? (
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-2xl border border-border/30">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-xs font-bold">Documento Anexado</span>
                </div>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-[10px] font-bold" onClick={() => window.open(mediaSource)}><Download className="h-3.5 w-3.5 mr-1"/>Abrir</Button>
              </div>
            ) : isVideo ? (
              <video src={mediaSource} controls className="w-full rounded-2xl max-h-72 object-cover bg-black" />
            ) : (
              <img src={mediaSource} className="w-full rounded-2xl max-h-72 object-cover border border-border/10" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0 flex justify-between items-center border-t border-border/20 mt-2">
        <div className="flex gap-1 mt-2">
          <Button variant="ghost" onClick={onLike} className={cn("h-8 rounded-full px-3 text-xs font-bold transition-all", post.user_liked ? "text-red-500 hover:text-red-600 bg-red-500/10" : "text-muted-foreground hover:bg-muted")}>
            <Heart className={cn("h-3.5 w-3.5 mr-1.5", post.user_liked && "fill-current")} /> {post.likes_count > 0 ? post.likes_count : "Curtir"}
          </Button>
          <Button variant="ghost" onClick={onComment} className="h-8 rounded-full px-3 text-xs font-bold text-muted-foreground hover:bg-muted transition-all">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5"/> {post.comments_count > 0 ? post.comments_count : "Comentar"}
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onSave} className={cn("h-8 w-8 rounded-full mt-2 transition-all", post.user_saved ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-muted")}>
          <Bookmark className={cn("h-4 w-4", post.user_saved && "fill-current")} />
        </Button>
      </CardFooter>
    </Card>
  );
}
