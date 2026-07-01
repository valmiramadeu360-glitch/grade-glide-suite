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
  DialogContent
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

  // News feed inline
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeNews, setActiveNews] = useState<any | null>(null);


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
      const { data: saved } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user!.id);
      const ids = (saved ?? []).map((s: any) => s.post_id);
      if (ids.length === 0) { setPosts([]); return; }
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(id,full_name,avatar_url)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (data) setPosts(await fetchMetricsForPosts(data));
    } finally { setLoading(false); }
  }


  async function loadFollowing() {

    if (!user) return;

    try {

      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      setFollowingIds((data ?? []).map((f: any) => f.following_id));

    } catch (e) {
      console.error(e);
    }
  }


  async function fetchMetricsForPosts(postsData: any[]) {

    if (!postsData || postsData.length === 0 || !user) return [];

    const postIds = postsData.map(p => p.id);

    const [likes, comments, saved] = await Promise.all([

      supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds),

      supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds)

    ]);

    const likesMap: any = {};

    (likes.data ?? []).forEach((l: any) => {

      if (!likesMap[l.post_id]) {

        likesMap[l.post_id] = {
          count: 0,
          userLiked: false
        };

      }

      likesMap[l.post_id].count++;

      if (l.user_id === user.id) {

        likesMap[l.post_id].userLiked = true;

      }

    });

    const commentsMap: any = {};

    (comments.data ?? []).forEach((c: any) => {

      commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;

    });

    const savedSet = new Set(
      (saved.data ?? []).map((s: any) => s.post_id)
    );


    return postsData.map(p => ({

      ...p,

      profiles: Array.isArray(p.profiles)
        ? p.profiles[0]
        : p.profiles,

      likes_count: likesMap[p.id]?.count || 0,

      comments_count: commentsMap[p.id] || 0,

      user_liked: likesMap[p.id]?.userLiked || false,

      user_saved: savedSet.has(p.id)

    }));
  }



  async function loadPosts() {

    setLoading(true);

    try {

      let query = supabase
        .from("posts")
        .select("*, profiles(id,full_name,avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50);


      if (tab === "oportunidades") {

        query = query.in("tag", MARKETPLACE_TAGS);

      }

      if (activeCommunity) {
        query = query.eq("community_id", activeCommunity);
      } else {
        query = query.is("community_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {

        const postsWithMetrics = await fetchMetricsForPosts(data);

        setPosts(postsWithMetrics);

      }

    } catch (e) {

      toast({
        title: "Erro ao carregar feed",
        variant: "destructive"
      });

    } finally {

      setLoading(false);

    }
  }



  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {

      toast({
        title: "Arquivo muito grande",
        variant: "destructive"
      });

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

      if (selectedFile) {

        const fileExt = selectedFile.name.split(".").pop();

        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
          .storage
          .from("post-media")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data } = supabase
          .storage
          .from("post-media")
          .getPublicUrl(filePath);

        mediaUrl = data.publicUrl;

      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: newContent.trim(),
          media_url: mediaUrl,
          tag: selectedTag,
          community_id: activeCommunity,
        });

      if (error) throw error;

      setNewContent("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedTag(null);

      toast({
        title: "Publicado!"
      });

      loadPosts();

    } catch (e: any) {

      toast({
        title: "Erro ao postar",
        description: e.message,
        variant: "destructive"
      });

    } finally {

      setPosting(false);

    }
  }

  async function handleLike(post: Post) {
    if (!user) return;
    try {
      if (post.user_liked) {
        await supabase.from("post_likes").delete()
          .eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      }
      setPosts(prev => prev.map(p => p.id === post.id ? {
        ...p,
        user_liked: !p.user_liked,
        likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1,
      } : p));
    } catch (e: any) {
      toast({ title: "Erro ao curtir", description: e.message, variant: "destructive" });
    }
  }

  async function handleSave(post: Post) {
    if (!user) return;
    try {
      if (post.user_saved) {
        await supabase.from("saved_posts").delete()
          .eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
      }
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_saved: !p.user_saved } : p));
    } catch {}
  }

  async function handleDelete(post: Post) {
    if (!window.confirm("Excluir esta publicação?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast({ title: "Publicação excluída" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  async function openComments(post: Post) {
    setActivePost(post);
    setCommentModalOpen(true);
    try {
      const { data } = await supabase
        .from("post_comments")
        .select("*, profiles(full_name,avatar_url)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      setPostComments(data ?? []);
    } catch {
      setPostComments([]);
    }
  }

  async function sendComment() {
    if (!user || !activePost || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: activePost.id,
        user_id: user.id,
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment("");
      const { data } = await supabase
        .from("post_comments")
        .select("*, profiles(full_name,avatar_url)")
        .eq("post_id", activePost.id)
        .order("created_at", { ascending: true });
      setPostComments(data ?? []);
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (e: any) {
      toast({ title: "Erro ao comentar", description: e.message, variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  }

  const visiblePosts = useMemo(() => {
    if (tab === "following") {
      return posts.filter(p => followingIds.includes(p.user_id));
    }
    return posts;
  }, [posts, tab, followingIds]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Connect</h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Rede acadêmica
          </p>
        </div>
      </div>

      {/* Composer */}
      <Card className="rounded-3xl">
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="O que está estudando hoje?"
            rows={3}
            className="rounded-2xl resize-none border-0 bg-muted/40 focus-visible:ring-1"
          />
          {previewUrl && previewUrl !== "pdf-preview" && (
            <div className="relative">
              <img src={previewUrl} className="rounded-2xl w-full max-h-64 object-cover" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-7 w-7 rounded-full"
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {[...ACADEMIC_TAGS, ...MARKETPLACE_TAGS].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full transition-all",
                  selectedTag === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70">
                <ImageIcon className="h-4 w-4" />
              </div>
            </label>
            <Button
              onClick={handlePost}
              disabled={posting || (!newContent.trim() && !selectedFile)}
              className="rounded-full font-bold gap-2"
              size="sm"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full rounded-full bg-muted/40 p-1 grid grid-cols-3">
          <TabsTrigger value="global" className="rounded-full font-bold text-xs">Global</TabsTrigger>
          <TabsTrigger value="following" className="rounded-full font-bold text-xs">Seguindo</TabsTrigger>
          <TabsTrigger value="oportunidades" className="rounded-full font-bold text-xs">Oportunidades</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Comunidades */}
      {communities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCommunity(null)}
            className={cn(
              "shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border",
              activeCommunity === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            Feed Geral
          </button>
          {communities.map((c) => {
            const Icon = c.type === "university" ? "🎓" : c.type === "campus" ? "🏛️" : c.type === "course" ? "📚" : "#";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCommunity(c.id)}
                className={cn(
                  "shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border whitespace-nowrap",
                  activeCommunity === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                <span className="mr-1">{Icon}</span>{c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visiblePosts.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">Nada por aqui ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              isOwner={p.user_id === user?.id}
              onLike={() => handleLike(p)}
              onSave={() => handleSave(p)}
              onComment={() => openComments(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Comments Modal */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-black">Comentários</h3>
          </div>
          <ScrollArea className="max-h-[50vh] p-4">
            {postComments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Seja o primeiro a comentar.
              </p>
            ) : (
              <div className="space-y-3">
                {postComments.map((c: any) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={c.profiles?.avatar_url} />
                      <AvatarFallback>{c.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/50 rounded-2xl px-3 py-2 flex-1">
                      <p className="text-xs font-bold">{c.profiles?.full_name || "Estudante"}</p>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escreva um comentário..."
              className="rounded-full"
              onKeyDown={(e) => { if (e.key === "Enter") sendComment(); }}
            />
            <Button
              size="icon"
              onClick={sendComment}
              disabled={sendingComment || !newComment.trim()}
              className="rounded-full shrink-0"
            >
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({
  post,
  onLike,
  onSave,
  onComment,
  isOwner,
  onDelete
}: any) {

  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i);

  return (

    <Card className="rounded-[32px] overflow-hidden">

      <CardHeader className="flex flex-row items-center justify-between">

        <div className="flex gap-3 items-center">

          <Avatar>

            <AvatarImage src={post.profiles?.avatar_url} />

            <AvatarFallback>
              {post.profiles?.full_name?.charAt(0) || "U"}
            </AvatarFallback>

          </Avatar>

          <div>

            <div className="flex gap-1 items-center">

              <p className="font-bold text-sm">
                {post.profiles?.full_name || "Estudante"}
              </p>

            </div>

            <p className="text-xs text-muted-foreground">

              {formatDistanceToNow(
                new Date(post.created_at),
                { locale: ptBR, addSuffix: true }
              )}

            </p>

          </div>

        </div>

        <DropdownMenu>

          <DropdownMenuTrigger asChild>

            <Button variant="ghost" size="icon">
              <MoreHorizontal/>
            </Button>

          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">

            {isOwner && (

              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2"/>
                Excluir
              </DropdownMenuItem>

            )}

            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(post.content)}
            >
              <Share2 className="h-4 w-4 mr-2"/>
              Copiar Texto
            </DropdownMenuItem>

          </DropdownMenuContent>

        </DropdownMenu>

      </CardHeader>


      <CardContent>

        {post.tag && (
          <Badge variant="secondary" className="mb-2">
            {post.tag}
          </Badge>
        )}

        <p className="whitespace-pre-wrap text-sm">
          {post.content}
        </p>


        {post.media_url && (

          <div className="mt-4">

            {isPdf ? (

              <Button
                variant="outline"
                onClick={() => window.open(post.media_url)}
              >
                <Download className="h-4 w-4 mr-2"/>
                Baixar PDF
              </Button>

            ) : isVideo ? (

              <video
                src={post.media_url}
                controls
                className="w-full rounded-xl"
              />

            ) : (

              <img
                src={post.media_url}
                className="rounded-xl w-full"
              />

            )}

          </div>

        )}

      </CardContent>


      <CardFooter className="flex justify-between">

        <div className="flex gap-2">

          <Button
            variant="ghost"
            onClick={onLike}
            className={cn(post.user_liked && "text-red-500")}
          >

            <Heart
              className={cn(
                "h-4 w-4",
                post.user_liked && "fill-current"
              )}
            />

            {post.likes_count}

          </Button>


          <Button variant="ghost" onClick={onComment}>

            <MessageSquare className="h-4 w-4"/>

            {post.comments_count}

          </Button>

        </div>


        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
        >

          <Bookmark
            className={cn(
              "h-4 w-4",
              post.user_saved && "fill-current"
            )}
          />

        </Button>

      </CardFooter>

    </Card>

  );
}
