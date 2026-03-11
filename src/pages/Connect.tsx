import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image as ImageIcon, FileText, Video,
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, Download,
  Bookmark, Share2, BadgeCheck, Briefcase, X, SmilePlus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Evento", "Desabafo"];
const MARKETPLACE_TAGS = ["Venda de Livro", "República", "Vaga de Estágio", "Doação"];
const QUICK_EMOJIS = ["👏", "🔥", "💡", "🧠", "🎯", "🙌"];

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
  const [tab, setTab] = useState("global");
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  
  // Post Creation
  const [newContent, setNewContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Comments System
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (user) {
      loadFollowing();
      loadPosts();
    }
  }, [user, tab]);

  async function loadFollowing() {
    try {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      setFollowingIds((data ?? []).map(f => f.following_id));
    } catch (e) { console.error(e); }
  }

  async function fetchMetricsForPosts(postsData: any[]) {
    if(!postsData || postsData.length === 0) return [];
    const postIds = postsData.map(p => p.id);

    try {
      const [likes, comments, saved] = await Promise.all([
        supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
        supabase.from("post_comments").select("post_id").in("post_id", postIds),
        supabase.from("saved_posts").select("post_id").eq("user_id", user!.id).in("post_id", postIds)
      ]);

      const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
      (likes.data ?? []).forEach(l => {
        if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
        likesMap[l.post_id].count++;
        if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
      });

      const commentsMap: Record<string, number> = {};
      (comments.data ?? []).forEach((c: any) => {
        commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;
      });

      const savedSet = new Set((saved.data ?? []).map((s: any) => s.post_id));

      return postsData.map(p => ({
        ...p,
        profiles: (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles) || { full_name: "Estudante", avatar_url: null },
        likes_count: likesMap[p.id]?.count || 0,
        comments_count: commentsMap[p.id] || 0,
        user_liked: likesMap[p.id]?.userLiked || false,
        user_saved: savedSet.has(p.id),
      }));
    } catch (err) {
      return postsData;
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("*, profiles(id, full_name, avatar_url, course, is_verified)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (tab === "oportunidades") {
        query = query.in("tag", MARKETPLACE_TAGS);
      } else if (tab === "global") {
        query = query.or(`tag.is.null,tag.not.in.(${MARKETPLACE_TAGS.map(t => `"${t}"`).join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const postsWithMetrics = await fetchMetricsForPosts(data);
        if (tab === "trending") {
          postsWithMetrics.sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count));
        }
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
      toast({ title: "Arquivo muito grande", description: "O limite é de 50MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl('pdf-preview');
    }
  }

  async function handlePost() {
    if ((!newContent.trim() && !selectedFile) || !user) return;
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('post_media').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('post_media').getPublicUrl(filePath);
        mediaUrl = data.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id, content: newContent.trim(), media_url: mediaUrl, tag: selectedTag
      });
      if (error) throw error;
      
      setNewContent(""); setSelectedFile(null); setPreviewUrl(null); setSelectedTag(null);
      toast({ title: "Publicado! 🚀" });
      loadPosts();
    } catch (e: any) {
      toast({ title: "Erro ao postar", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  async function openComments(post: Post) {
    setActivePost(post);
    setCommentModalOpen(true);
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles(full_name, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setPostComments(data || []);
  }

  async function submitComment() {
    if (!newComment.trim() || !activePost || !user) return;
    setSendingComment(true);
    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: activePost.id, user_id: user.id, content: newComment.trim()
      });
      if (error) throw error;
      setNewComment("");
      openComments(activePost); // Recarrega a lista
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    } finally { setSendingComment(false); }
  }

  const filteredPosts = useMemo(() => {
    if (tab === "following") return posts.filter(p => followingIds.includes(p.user_id));
    if (tab === "saved") return posts.filter(p => p.user_saved);
    return posts;
  }, [tab, posts, followingIds]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 px-4 pt-6">
      
      <header className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Connect</h1>
      </header>

      {/* Criação de Post */}
      <Card className="rounded-[32px] overflow-hidden border-border/40 bg-card shadow-lg">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="font-black">U</AvatarFallback>
            </Avatar>
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={tab === "oportunidades" ? "Anuncie aqui..." : "O que há de novo?"}
              className="min-h-[100px] border-none focus-visible:ring-0 text-lg resize-none p-0 bg-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 ml-16">
            {(tab === "oportunidades" ? MARKETPLACE_TAGS : ACADEMIC_TAGS).map(tag => (
              <Badge 
                key={tag} variant={selectedTag === tag ? "default" : "secondary"}
                className="cursor-pointer rounded-lg text-[9px] font-black uppercase tracking-widest px-3 py-1"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden ml-16 bg-muted/20 border w-fit max-w-full">
              <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7 rounded-lg" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}><X className="h-4 w-4" /></Button>
              {previewUrl === 'pdf-preview' ? (
                <div className="p-4 flex items-center gap-3"><FileText className="text-red-500 h-8 w-8" /><span className="text-xs font-bold truncate max-w-[150px]">{selectedFile?.name}</span></div>
              ) : selectedFile?.type.startsWith('video/') ? (
                <video src={previewUrl} className="max-h-60 rounded-xl" controls />
              ) : (
                <img src={previewUrl} className="max-h-60 rounded-xl object-cover" />
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4 ml-16">
            <div className="flex gap-1">
              <input type="file" id="media-up" className="hidden" onChange={handleFileSelect} />
              <Button variant="ghost" size="icon" onClick={() => document.getElementById('media-up')?.click()}><ImageIcon className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => document.getElementById('media-up')?.click()}><Video className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => document.getElementById('media-up')?.click()}><FileText className="h-5 w-5" /></Button>
            </div>
            <Button onClick={handlePost} disabled={posting || (!newContent.trim() && !selectedFile)} className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-5 h-12 bg-muted/50 rounded-2xl p-1 mb-6">
          <TabsTrigger value="global" className="rounded-xl text-[10px] font-black uppercase">Feed</TabsTrigger>
          <TabsTrigger value="trending" className="rounded-xl text-[10px] font-black uppercase">Alta</TabsTrigger>
          <TabsTrigger value="following" className="rounded-xl text-[10px] font-black uppercase">Seguindo</TabsTrigger>
          <TabsTrigger value="oportunidades" className="rounded-xl text-[10px] font-black uppercase">Market</TabsTrigger>
          <TabsTrigger value="saved" className="rounded-xl text-[10px] font-black uppercase">Salvos</TabsTrigger>
        </TabsList>

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : filteredPosts.map(post => (
            <PostCard 
              key={post.id} post={post} isOwner={post.user_id === user?.id}
              onLike={async () => {
                const liked = post.user_liked;
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
                if (liked) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user!.id);
                else await supabase.from("post_likes").insert({ post_id: post.id, user_id: user!.id });
              }}
              onSave={async () => {
                const saved = post.user_saved;
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_saved: !saved } : p));
                if (saved) await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user!.id);
                else await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user!.id });
              }}
              onComment={() => openComments(post)}
              onDelete={async () => {
                if (window.confirm("Apagar post?")) {
                  await supabase.from("posts").delete().eq("id", post.id);
                  setPosts(posts.filter(p => p.id !== post.id));
                }
              }}
            />
          ))}
        </div>
      </Tabs>

      {/* Modal de Comentários */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="rounded-[32px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b"><h2 className="text-xl font-black">Discussão</h2></div>
          <ScrollArea className="flex-1 p-6 bg-muted/10">
            {postComments.map((c, i) => (
              <div key={i} className="flex gap-4 mb-6">
                <Avatar className="h-8 w-8"><AvatarImage src={c.profiles?.avatar_url}/></Avatar>
                <div className="bg-background border p-3 rounded-2xl flex-1 shadow-sm">
                  <p className="text-xs font-black">{c.profiles?.full_name}</p>
                  <p className="text-sm mt-1">{c.content}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
          <div className="p-6 bg-card border-t flex gap-2">
            <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comente algo..." className="rounded-full" />
            <Button onClick={submitComment} disabled={sendingComment || !newComment.trim()} size="icon" className="rounded-full shrink-0">
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({ post, onLike, onSave, onComment, isOwner, onDelete }: any) {
  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.(pdf)$/i);

  return (
    <Card className="rounded-[32px] overflow-hidden border-border/40 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="p-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback>{post.profiles?.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <p className="font-black text-sm">{post.profiles?.full_name}</p>
              {post.profiles?.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
            </div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">{formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: true })}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl"><MoreHorizontal className="h-5 w-5"/></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold cursor-pointer"><Trash2 className="h-4 w-4 mr-2"/> Excluir</DropdownMenuItem>}
            <DropdownMenuItem className="font-bold cursor-pointer" onClick={() => navigator.clipboard.writeText(post.content)}><Share2 className="h-4 w-4 mr-2"/> Copiar Texto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-5 pt-0">
        {post.tag && <Badge className="mb-3 text-[8px] font-black uppercase tracking-widest" variant="secondary">{post.tag}</Badge>}
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.media_url && (
          <div className="mt-4 rounded-2xl overflow-hidden border">
            {isPdf ? (
              <div className="p-4 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3"><FileText className="text-red-500 h-6 w-6"/><span className="text-xs font-bold">Arquivo PDF</span></div>
                <Button size="sm" variant="ghost" onClick={() => window.open(post.media_url!, '_blank')}><Download className="h-4 w-4"/></Button>
              </div>
            ) : isVideo ? (
              <video src={post.media_url} controls className="w-full max-h-96 object-contain bg-black" />
            ) : (
              <img src={post.media_url} className="w-full h-auto max-h-96 object-cover" loading="lazy" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 bg-muted/10 flex justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onLike} className={cn("rounded-full gap-2 font-bold", post.user_liked && "text-rose-500 bg-rose-500/5")}>
            <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} /> {post.likes_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={onComment} className="rounded-full gap-2 font-bold">
            <MessageSquare className="h-4 w-4" /> {post.comments_count}
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onSave} className={cn("rounded-full", post.user_saved && "text-primary bg-primary/10")}>
          <Bookmark className={cn("h-5 w-5", post.user_saved && "fill-current")} />
        </Button>
      </CardFooter>
    </Card>
  );
}
