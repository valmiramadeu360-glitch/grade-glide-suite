import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image, Link2, FileText,
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, X, Search, Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Estágio/Emprego", "Evento", "Desabafo"];

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
    bio?: string | null;
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
  
  // Feed States
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  
  // Post Creation States
  const [newContent, setNewContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedPosts, setSearchedPosts] = useState<Post[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);

  // Interaction States
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  // Profile Modal State
  const [viewProfile, setViewProfile] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      loadFollowing();
      loadPosts();
      loadTrending();
    }
  }, [user]);

  async function loadFollowing() {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
    setFollowingIds((data ?? []).map(f => f.following_id));
  }

  // --- Funções Auxiliares de Métricas ---
  async function fetchMetricsForPosts(postsData: any[]) {
    const postIds = postsData.map(p => p.id);
    if(postIds.length === 0) return [];

    const { data: likesData } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
    const { data: commentsData } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

    const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
    (likesData ?? []).forEach(l => {
      if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
      likesMap[l.post_id].count++;
      if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
    });

    const commentsMap: Record<string, number> = {};
    (commentsData ?? []).forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });

    return postsData.map(p => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
      likes_count: likesMap[p.id]?.count || 0,
      comments_count: commentsMap[p.id] || 0,
      user_liked: likesMap[p.id]?.userLiked || false,
    }));
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(id, full_name, avatar_url, course, bio)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsData) {
        const postsWithMetrics = await fetchMetricsForPosts(postsData);
        setPosts(postsWithMetrics);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTrending() {
    try {
      const { data: trendingData } = await supabase.from("trending_posts" as any).select("*").limit(30);
      if (!trendingData) { setTrendingPosts([]); return; }

      // Como trending é uma view, buscamos os profiles separadamente
      const userIds = [...new Set((trendingData as any[]).map((p: any) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, course, bio").in("id", userIds);
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

      // Remapeando para colocar o profile dentro de cada post
      const mappedTrending = (trendingData as any[]).map(p => ({
         ...p,
         profiles: profileMap.get(p.user_id) || null
      }));

      const postsWithMetrics = await fetchMetricsForPosts(mappedTrending);
      setTrendingPosts(postsWithMetrics);
    } catch (e) {
      console.error("Error loading trending:", e);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, course, bio")
        .ilike("full_name", `%${searchQuery}%`)
        .limit(10);
      setSearchedUsers(usersData || []);

      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(id, full_name, avatar_url, course, bio)")
        .ilike("content", `%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (postsData) {
        const postsWithMetrics = await fetchMetricsForPosts(postsData);
        setSearchedPosts(postsWithMetrics);
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function handlePost() {
    if ((!newContent.trim() && !selectedFile) || !user) return;
    setPosting(true);

    try {
      let mediaUrl: string | null = null;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('post_media').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('post_media').getPublicUrl(filePath);
        mediaUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: newContent.trim(),
        media_url: mediaUrl,
        tag: selectedTag
      });

      if (error) throw error;
      setNewContent("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedTag(null);
      toast({ title: "Publicado com sucesso! 🎉" });
      await loadPosts();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(postId: string, liked: boolean) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_liked: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
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
      ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
    })));
    setLoadingComments(false);
  }

  async function handleComment() {
    if (!newComment.trim() || !commentPostId || !user) return;
    await supabase.from("post_comments").insert({ post_id: commentPostId, user_id: user.id, content: newComment.trim() });
    setNewComment("");
    await openComments(commentPostId);
    setPosts(prev => prev.map(p => p.id === commentPostId ? { ...p, comments_count: p.comments_count + 1 } : p));
  }

  async function handleReport() {
    if (!reportReason.trim() || !reportPostId || !user) return;
    await supabase.from("post_reports").insert({ post_id: reportPostId, reporter_id: user.id, reason: reportReason.trim() });
    setReportPostId(null);
    setReportReason("");
    toast({ title: "Denúncia enviada", description: "O caso foi para nossa Central de Moderação." });
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

  async function openUserProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, course, bio").eq("id", userId).single();
    if (data) setViewProfile(data);
  }

  const filteredPosts = useMemo(() => {
    if (tab === "trending") return trendingPosts;
    if (tab === "following") return posts.filter(p => followingIds.includes(p.user_id));
    return posts;
  }, [tab, posts, trendingPosts, followingIds]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

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

      {/* Post Creation Card (Escondido em certas abas) */}
      {tab !== "chat" && tab !== "search" && (
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Compartilhe um resumo, dúvida ou notícia da faculdade..."
              className="min-h-[100px] rounded-2xl border-border/50 bg-muted/30 resize-none text-sm font-medium focus:bg-background transition-colors"
             />
             
            {/* Sistema de Tags Inteligentes */}
            <div className="flex flex-wrap gap-2 pt-2">
              {ACADEMIC_TAGS.map(tag => (
                <Badge 
                  key={tag} 
                  variant={selectedTag === tag ? "default" : "secondary"}
                  className="cursor-pointer rounded-lg text-[10px] font-black uppercase tracking-widest"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Preview de Mídia */}
            {previewUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-border/50 mt-2">
                <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                <Button variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1">
                <input type="file" id="media-upload" accept="image/*,video/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    setPreviewUrl(file ? URL.createObjectURL(file) : null);
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => document.getElementById('media-upload')?.click()} className={cn("h-10 w-10 rounded-xl", selectedFile ? "text-primary bg-primary/10" : "text-muted-foreground")}>
                  <Image className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handlePost} disabled={(!newContent.trim() && !selectedFile) || posting} className="rounded-2xl px-6 gap-2">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="global" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Globe className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Global</span></TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><TrendingUp className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Em Alta</span></TabsTrigger>
          <TabsTrigger value="following" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Seguindo</span></TabsTrigger>
          <TabsTrigger value="search" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Search className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Busca</span></TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><MessageSquare className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Chat</span></TabsTrigger>
        </TabsList>

        {/* Global / Trending / Following Content */}
        {["global", "trending", "following"].includes(tab) && (
          <TabsContent value={tab} className="mt-4 space-y-4">
            {filteredPosts.length === 0 ? (
              <EmptyFeed message="O feed está vazio por enquanto." />
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
                onOpenProfile={() => openUserProfile(post.user_id)}
              />
            ))}
          </TabsContent>
        )}

        {/* Search Tab */}
        <TabsContent value="search" className="mt-4 space-y-6">
          <div className="flex gap-2">
            <Input 
              placeholder="Buscar usuários, cursos ou palavras-chave..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="rounded-2xl h-12 bg-muted/30"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="rounded-2xl h-12 px-6">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchedUsers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Alunos Encontrados</h3>
              <div className="grid gap-3">
                {searchedUsers.map(u => (
                  <Card key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/10 cursor-pointer" onClick={() => openUserProfile(u.id)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10"><AvatarImage src={u.avatar_url} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                      <div>
                        <p className="text-sm font-bold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.course || "Universitário"}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {searchedPosts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Publicações</h3>
              {searchedPosts.map(post => (
                <PostCard key={post.id} post={post} currentUserId={user!.id} isFollowing={followingIds.includes(post.user_id)} onLike={() => handleLike(post.id, post.user_liked)} onComment={() => openComments(post.id)} onDelete={() => handleDelete(post.id)} onReport={() => setReportPostId(post.id)} onFollow={() => handleFollow(post.user_id)} onOpenProfile={() => openUserProfile(post.user_id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chat Tab (Contatos) */}
        <TabsContent value="chat" className="mt-4 space-y-4">
          <div className="bg-primary/5 rounded-2xl p-4 mb-4 border border-primary/10">
            <p className="text-sm text-primary/80 font-medium text-center">
              Acesse a área completa de DM para enviar arquivos e áudios clicando no botão abaixo, ou veja o perfil dos seus contatos aqui.
            </p>
            <Button className="w-full mt-3 rounded-xl" onClick={() => window.location.href = '/messages'}>
              <MessageSquare className="h-4 w-4 mr-2" /> Abrir EduFlow Chat
            </Button>
          </div>
          
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-2">Suas Conexões (Seguindo)</h3>
          {followingIds.length === 0 ? (
            <EmptyFeed message="Você ainda não segue ninguém para iniciar um chat." />
          ) : (
            <div className="space-y-2">
              {/* Aqui você pode mapear os usuários que ele segue. Como temos os IDs, precisaríamos buscar os dados deles na montagem do componente. Para fins visuais, se ele clicou no usuário no feed, ele o vê aqui */}
              <p className="text-xs text-center text-muted-foreground mt-8">
                Use a aba de <b>Busca</b> ou o <b>Feed</b> para encontrar estudantes e adicioná-los às suas conexões!
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- MODAIS DE INTERAÇÃO --- */}

      {/* Modal de Perfil do Usuário */}
      <Dialog open={!!viewProfile} onOpenChange={open => { if (!open) setViewProfile(null); }}>
        <DialogContent className="rounded-[32px] sm:max-w-[400px]">
          <DialogHeader className="items-center text-center space-y-4 pt-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
              <AvatarImage src={viewProfile?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl"><User /></AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl font-black">{viewProfile?.full_name || "Estudante"}</DialogTitle>
              <p className="text-sm font-bold text-muted-foreground mt-1">{viewProfile?.course || "Sem curso especificado"}</p>
            </div>
          </DialogHeader>
          
          <div className="bg-muted/30 rounded-2xl p-4 text-center mt-2">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {viewProfile?.bio ? viewProfile.bio : "Este estudante ainda não adicionou uma biografia."}
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:justify-center mt-4">
            {viewProfile?.id !== user?.id && (
              <>
                <Button 
                  onClick={() => handleFollow(viewProfile.id)}
                  variant={followingIds.includes(viewProfile?.id) ? "outline" : "default"}
                  className="w-full rounded-2xl h-12"
                >
                  {followingIds.includes(viewProfile?.id) ? "Deixar de Seguir" : "Seguir Estudante"}
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full rounded-2xl h-12"
                  onClick={() => window.location.href = `/messages?user=${viewProfile.id}`}
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Enviar Mensagem Direta
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comentários, Denúncias (mantidos do código original) */}
      <Dialog open={!!commentPostId} onOpenChange={open => { if (!open) setCommentPostId(null); }}>
        <DialogContent className="rounded-[32px] bg-card border-border shadow-2xl max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle className="font-black text-xl">Comentários</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
            {/* Renderização de comentários... */}
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 p-3 rounded-2xl bg-muted/30">
                <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={c.profiles?.avatar_url || ""} /><AvatarFallback><User className="h-3 w-3" /></AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground">{c.profiles?.full_name || "Anônimo"}</p>
                  <p className="text-sm text-foreground/80 mt-0.5">{c.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-row gap-2 pt-2 border-t border-border/40">
            <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajude o colega..." className="min-h-[60px] flex-1 rounded-2xl text-sm resize-none" />
            <Button onClick={handleComment} disabled={!newComment.trim()} size="icon" className="h-12 w-12 rounded-2xl shrink-0"><Send className="h-4 w-4" /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportPostId} onOpenChange={open => { if (!open) setReportPostId(null); }}>
        <DialogContent className="rounded-[32px] bg-card border-border shadow-2xl">
          <DialogHeader><DialogTitle className="font-black text-xl text-destructive flex items-center gap-2"><Flag className="h-5 w-5" /> Denunciar</DialogTitle></DialogHeader>
          <Textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Motivo da denúncia (Filtro IA será ativado)..." className="min-h-[100px] rounded-2xl text-sm resize-none" />
          <DialogFooter><Button variant="ghost" onClick={() => setReportPostId(null)}>Cancelar</Button><Button variant="destructive" onClick={handleReport}>Enviar para Moderação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──── Post Card Component Atualizado ──── */
function PostCard({ post, currentUserId, isFollowing, onLike, onComment, onDelete, onReport, onFollow, onOpenProfile }: any) {
  const isOwner = post.user_id === currentUserId;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow">
      <CardContent className="p-5 space-y-4">
        {/* User Info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={onOpenProfile}>
            <Avatar className="h-11 w-11 transition-transform group-hover:scale-105">
              <AvatarImage src={post.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                  {post.profiles?.full_name || "Estudante"}
                </p>
                {!isOwner && (
                  <button onClick={(e) => { e.stopPropagation(); onFollow(); }} className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg transition-colors", isFollowing ? "text-muted-foreground bg-muted hover:bg-destructive/10 hover:text-destructive" : "text-primary bg-primary/10 hover:bg-primary/20")}>
                    {isFollowing ? "Seguindo" : "Seguir"}
                  </button>
                )}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground">
                {post.profiles?.course || "Universidade"} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl bg-card border-border shadow-xl">
              <DropdownMenuItem onClick={onOpenProfile} className="font-bold gap-2"><Info className="h-4 w-4" /> Ver Perfil</DropdownMenuItem>
              {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold gap-2"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>}
              {!isOwner && <DropdownMenuItem onClick={onReport} className="text-destructive font-bold gap-2"><Flag className="h-4 w-4" /> Denunciar</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.tag && <Badge variant="secondary" className="rounded-lg text-[10px] font-black uppercase tracking-widest mb-2">{post.tag}</Badge>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        
        {post.media_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border/50 bg-muted/20">
            <img src={post.media_url} alt="Mídia" className="w-full h-auto object-cover max-h-[400px]" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/30">
          <Button variant="ghost" size="sm" onClick={onLike} className={cn("rounded-xl gap-2 font-bold text-xs", post.user_liked && "text-red-500 hover:text-red-600")}>
            <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} /> {post.likes_count > 0 && post.likes_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={onComment} className="rounded-xl gap-2 font-bold text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> {post.comments_count > 0 && post.comments_count}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyFeed({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center"><Globe className="h-8 w-8 text-muted-foreground/50" /></div>
      <p className="text-sm font-bold text-muted-foreground text-center">{message}</p>
    </div>
  );
}
