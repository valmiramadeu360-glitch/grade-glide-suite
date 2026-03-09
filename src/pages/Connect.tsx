import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image, Link2, FileText,
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  tag: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    course: string | null;
  };
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export default function Connect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("global");
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment dialog state
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  // Report dialog
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (user) {
      loadFollowing();
      loadPosts();
      loadTrending();
    }
  }, [user]);

  async function loadFollowing() {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user!.id);
    setFollowingIds((data ?? []).map(f => f.following_id));
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(full_name, avatar_url, course)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!postsData) { setPosts([]); return; }

      // Get likes and comments counts
      const postIds = postsData.map(p => p.id);
      
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
      (likesData ?? []).forEach(l => {
        if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
        likesMap[l.post_id].count++;
        if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
      });

      const commentsMap: Record<string, number> = {};
      (commentsData ?? []).forEach(c => {
        commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;
      });

      setPosts(postsData.map(p => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
        likes_count: likesMap[p.id]?.count || 0,
        comments_count: commentsMap[p.id] || 0,
        user_liked: likesMap[p.id]?.userLiked || false,
      })));
    } finally {
      setLoading(false);
    }
  }

  async function loadTrending() {
    try {
      const { data: trendingData } = await supabase
        .from("trending_posts" as any)
        .select("*")
        .limit(30);

      if (!trendingData) { setTrendingPosts([]); return; }

      const postIds = (trendingData as any[]).map((p: any) => p.id);
      
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
      (likesData ?? []).forEach(l => {
        if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
        likesMap[l.post_id].count++;
        if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
      });

      // Get profiles for trending posts
      const userIds = [...new Set((trendingData as any[]).map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, course")
        .in("user_id", userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      setTrendingPosts((trendingData as any[]).map((p: any) => ({
        ...p,
        profiles: profileMap.get(p.user_id) || null,
        likes_count: (p as any).likes_count || likesMap[p.id]?.count || 0,
        comments_count: (p as any).comments_count || 0,
        user_liked: likesMap[p.id]?.userLiked || false,
      })));
    } catch (e) {
      console.error("Error loading trending:", e);
    }
  }

  async function handlePost() {
    if (!newContent.trim() || !user) return;
    setPosting(true);
    try {
      let mediaUrl: string | null = null;

      // Upload image if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(filePath);
        mediaUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: newContent.trim(),
        media_url: mediaUrl,
      });
      if (error) throw error;
      setNewContent("");
      setSelectedFile(null);
      setPreviewUrl(null);
      toast({ title: "Publicado! 🎉" });
      await loadPosts();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 5MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleLike(postId: string, liked: boolean) {
    if (!user) return;
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p, user_liked: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1
    } : p));

    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
  }

  async function handleDelete(postId: string) {
    await supabase.from("posts").delete().eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast({ title: "Post removido" });
  }

  async function openComments(postId: string) {
    setCommentPostId(postId);
    setLoadingComments(true);
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles!post_comments_user_id_fkey(full_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data ?? []).map(c => ({
      ...c,
      profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
    })));
    setLoadingComments(false);
  }

  async function handleComment() {
    if (!newComment.trim() || !commentPostId || !user) return;
    await supabase.from("post_comments").insert({
      post_id: commentPostId, user_id: user.id, content: newComment.trim()
    });
    setNewComment("");
    await openComments(commentPostId);
    setPosts(prev => prev.map(p => p.id === commentPostId
      ? { ...p, comments_count: p.comments_count + 1 } : p));
  }

  async function handleReport() {
    if (!reportReason.trim() || !reportPostId || !user) return;
    await supabase.from("post_reports").insert({
      post_id: reportPostId, reporter_id: user.id, reason: reportReason.trim()
    });
    setReportPostId(null);
    setReportReason("");
    toast({ title: "Denúncia enviada", description: "Nosso time irá analisar." });
  }

  async function handleFollow(targetUserId: string) {
    if (!user) return;
    const isFollowing = followingIds.includes(targetUserId);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      setFollowingIds(prev => prev.filter(id => id !== targetUserId));
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
      setFollowingIds(prev => [...prev, targetUserId]);
    }
  }

  const filteredPosts = useMemo(() => {
    if (tab === "trending") return trendingPosts;
    if (tab === "following") return posts.filter(p => followingIds.includes(p.user_id));
    return posts;
  }, [tab, posts, trendingPosts, followingIds]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700 pb-24 px-4 sm:px-0 pt-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">EduFlow Connect</h1>
            <p className="text-sm font-medium text-muted-foreground">Conecte-se com a sua comunidade acadêmica</p>
          </div>
        </div>
      </div>

      {/* Post Creation Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <Textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Compartilhe um resumo, dúvida ou notícia..."
            className="min-h-[100px] rounded-2xl border-border/50 bg-muted/30 resize-none text-sm font-medium focus:bg-background transition-colors"
           />
          {/* Image Preview */}
          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-border/50">
              <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" title="Imagem" onClick={() => fileInputRef.current?.click()}>
                <Image className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" title="Link">
                <Link2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" title="Arquivo">
                <FileText className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handlePost}
              disabled={!newContent.trim() || posting}
              className="rounded-2xl px-6 gap-2"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full h-12 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="global" className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Globe className="h-4 w-4 mr-1.5" /> Global
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Trending
          </TabsTrigger>
          <TabsTrigger value="following" className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-1.5" /> Seguindo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4 space-y-4">
          {filteredPosts.length === 0 ? (
            <EmptyFeed message="Nenhuma publicação ainda. Seja o primeiro!" />
          ) : filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user!.id}
              isFollowing={followingIds.includes(post.user_id)}
              onLike={() => handleLike(post.id, post.user_liked)}
              onComment={() => openComments(post.id)}
              onDelete={() => handleDelete(post.id)}
              onReport={() => setReportPostId(post.id)}
              onFollow={() => handleFollow(post.user_id)}
            />
          ))}
        </TabsContent>
        <TabsContent value="trending" className="mt-4 space-y-4">
          {filteredPosts.length === 0 ? (
            <EmptyFeed message="Nenhum post em alta ainda. Interaja mais!" />
          ) : filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user!.id}
              isFollowing={followingIds.includes(post.user_id)}
              onLike={() => handleLike(post.id, post.user_liked)}
              onComment={() => openComments(post.id)}
              onDelete={() => handleDelete(post.id)}
              onReport={() => setReportPostId(post.id)}
              onFollow={() => handleFollow(post.user_id)}
            />
          ))}
        </TabsContent>
        <TabsContent value="following" className="mt-4 space-y-4">
          {filteredPosts.length === 0 ? (
            <EmptyFeed message="Siga outros estudantes para ver posts aqui." />
          ) : filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user!.id}
              isFollowing={followingIds.includes(post.user_id)}
              onLike={() => handleLike(post.id, post.user_liked)}
              onComment={() => openComments(post.id)}
              onDelete={() => handleDelete(post.id)}
              onReport={() => setReportPostId(post.id)}
              onFollow={() => handleFollow(post.user_id)}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Comments Dialog */}
      <Dialog open={!!commentPostId} onOpenChange={open => { if (!open) setCommentPostId(null); }}>
        <DialogContent className="rounded-[32px] bg-card border-border shadow-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Comentários</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
            {loadingComments ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : comments.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum comentário ainda.</p>
            ) : comments.map(c => (
              <div key={c.id} className="flex gap-3 p-3 rounded-2xl bg-muted/30">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={c.profiles?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground">{c.profiles?.full_name || "Anônimo"}</p>
                  <p className="text-sm text-foreground/80 mt-0.5">{c.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-row gap-2 pt-2 border-t border-border/40">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Escreva um comentário..."
              className="min-h-[60px] flex-1 rounded-2xl text-sm resize-none"
            />
            <Button onClick={handleComment} disabled={!newComment.trim()} size="icon" className="h-12 w-12 rounded-2xl shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!reportPostId} onOpenChange={open => { if (!open) setReportPostId(null); }}>
        <DialogContent className="rounded-[32px] bg-card border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-destructive flex items-center gap-2">
              <Flag className="h-5 w-5" /> Denunciar Publicação
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Descreva o motivo da denúncia..."
            className="min-h-[100px] rounded-2xl text-sm resize-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportPostId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReport} disabled={!reportReason.trim()}>Enviar Denúncia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──── Post Card Component ──── */
function PostCard({ post, currentUserId, isFollowing, onLike, onComment, onDelete, onReport, onFollow }: {
  post: Post;
  currentUserId: string;
  isFollowing: boolean;
  onLike: () => void;
  onComment: () => void;
  onDelete: () => void;
  onReport: () => void;
  onFollow: () => void;
}) {
  const isOwner = post.user_id === currentUserId;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow">
      <CardContent className="p-5 space-y-4">
        {/* User Info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={post.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-foreground truncate">
                  {post.profiles?.full_name || "Estudante"}
                </p>
                {!isOwner && (
                  <button
                    onClick={onFollow}
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg transition-colors",
                      isFollowing
                        ? "text-muted-foreground bg-muted hover:bg-destructive/10 hover:text-destructive"
                        : "text-primary bg-primary/10 hover:bg-primary/20"
                    )}
                  >
                    {isFollowing ? "Seguindo" : "Seguir"}
                  </button>
                )}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground">
                {post.profiles?.course || "Comunidade"} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl bg-card border-border shadow-xl">
              {isOwner && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold gap-2">
                  <Trash2 className="h-4 w-4" /> Excluir Post
                </DropdownMenuItem>
              )}
              {!isOwner && (
                <DropdownMenuItem onClick={onReport} className="text-destructive font-bold gap-2">
                  <Flag className="h-4 w-4" /> Denunciar Publicação
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {/* Media */}
        {post.media_url && (
          <div className="rounded-2xl overflow-hidden border border-border/30">
            <img src={post.media_url} alt="Post media" className="w-full max-h-96 object-cover" loading="lazy" />
          </div>
        )}

        {post.tag && (
          <Badge variant="secondary" className="rounded-lg text-[10px] font-black uppercase tracking-widest">
            {post.tag}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            className={cn(
              "rounded-xl gap-2 font-bold text-xs",
              post.user_liked && "text-red-500 hover:text-red-600"
            )}
          >
            <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} />
            {post.likes_count > 0 && post.likes_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={onComment} className="rounded-xl gap-2 font-bold text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {post.comments_count > 0 && post.comments_count}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyFeed({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center">
        <Globe className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-bold text-muted-foreground text-center">{message}</p>
    </div>
  );
}
