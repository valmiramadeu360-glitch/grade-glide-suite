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
  Globe, Heart, MessageSquare, MoreHorizontal, Image, FileText, Video,
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, X, Search, Info, Download
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

      const userIds = [...new Set((trendingData as any[]).map((p: any) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, course, bio").in("id", userIds);
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

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
      const { data: usersData } = await supabase.from("profiles").select("id, full_name, avatar_url, course, bio").ilike("full_name", `%${searchQuery}%`).limit(10);
      setSearchedUsers(usersData || []);

      const { data: postsData } = await supabase.from("posts").select("*, profiles!posts_user_id_fkey(id, full_name, avatar_url, course, bio)").ilike("content", `%${searchQuery}%`).order("created_at", { ascending: false }).limit(20);
      
      if (postsData) {
        const postsWithMetrics = await fetchMetricsForPosts(postsData);
        setSearchedPosts(postsWithMetrics);
      }
    } finally {
      setIsSearching(false);
    }
  }

  // --- Lógica de Upload ---
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Limite de tamanho: 50MB (Ajuste conforme sua necessidade e plano do Supabase)
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é de 50MB.", variant: "destructive" });
      return;
    }
    
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl('pdf-preview'); // Flag para mostrar um card genérico no preview
    }
  }

  async function handlePost() {
    if ((!newContent.trim() && !selectedFile) || !user) return;
    setPosting(true);

    try {
      let mediaUrl: string | null = null;
      if (selectedFile) {
        // Gerar um nome seguro preservando a extensão original (.pdf, .mp4, .png)
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
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

  // Ações sociais (Curtir, Comentar, etc)...
  async function handleLike(postId: string, liked: boolean) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_liked: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (liked) await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  }

  async function handleDelete(postId: string) {
    await supabase.from("posts").delete().eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast({ title: "Post removido" });
  }

  async function openComments(postId: string) {
    setCommentPostId(postId);
    setLoadingComments(true);
    const { data } = await supabase.from("post_comments").select("*, profiles!post_comments_user_id_fkey(full_name, avatar_url)").eq("post_id", postId).order("created_at", { ascending: true });
    setComments((data ?? []).map(c => ({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles })));
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

      {/* Post Creation Card */}
      {tab !== "chat" && tab !== "search" && (
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Compartilhe um resumo, dúvida, edital ou notícia..."
              className="min-h-[100px] rounded-2xl border-border/50 bg-muted/30 resize-none text-sm font-medium focus:bg-background transition-colors"
             />
             
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

            {/* Renderizador do Preview do Anexo */}
            {previewUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-border/50 mt-2 bg-muted/20">
                {previewUrl === 'pdf-preview' ? (
                  <div className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{selectedFile?.name}</p>
                      <p className="text-xs text-muted-foreground">Documento PDF pronto para envio</p>
                    </div>
                  </div>
                ) : selectedFile?.type.startsWith('video/') ? (
                  <video src={previewUrl} className="w-full max-h-64 object-cover" controls />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                )}
                
                <Button variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 shadow-sm" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {/* Ícones de Anexo sutis e organizados */}
              <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1 border border-border/40">
                <input type="file" id="media-upload" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()} title="Adicionar Imagem">
                  <Image className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()} title="Adicionar Vídeo">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()} title="Adicionar Documento/PDF">
                  <FileText className="h-4 w-4" />
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

      {/* Tabs list e renderização das rotas do Feed... (Mantido exatamente igual) */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
         <TabsList className="w-full h-auto flex-wrap rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="global" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Globe className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Global</span></TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><TrendingUp className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Em Alta</span></TabsTrigger>
          <TabsTrigger value="following" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Seguindo</span></TabsTrigger>
          <TabsTrigger value="search" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Search className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Busca</span></TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 min-w-[80px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><MessageSquare className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Chat</span></TabsTrigger>
        </TabsList>

        {["global", "trending", "following"].includes(tab) && (
          <TabsContent value={tab} className="mt-4 space-y-4">
            {filteredPosts.length === 0 ? <EmptyFeed message="O feed está vazio." /> : filteredPosts.map(post => (
              <PostCard key={post.id} post={post} currentUserId={user!.id} isFollowing={followingIds.includes(post.user_id)} onLike={() => handleLike(post.id, post.user_liked)} onComment={() => openComments(post.id)} onDelete={() => handleDelete(post.id)} onReport={() => setReportPostId(post.id)} onFollow={() => handleFollow(post.user_id)} onOpenProfile={() => openUserProfile(post.user_id)} />
            ))}
          </TabsContent>
        )}
        
        <TabsContent value="search" className="mt-4 space-y-6">
          <div className="flex gap-2">
            <Input placeholder="Buscar usuários ou palavras..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="rounded-2xl h-12 bg-muted/30" />
            <Button onClick={handleSearch} disabled={isSearching} className="rounded-2xl h-12 px-6"><Search className="h-4 w-4" /></Button>
          </div>
          {searchedUsers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Alunos Encontrados</h3>
              <div className="grid gap-3">
                {searchedUsers.map(u => (
                  <Card key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/10 cursor-pointer" onClick={() => openUserProfile(u.id)}>
                    <div className="flex items-center gap-3"><Avatar className="h-10 w-10"><AvatarImage src={u.avatar_url} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar><div><p className="text-sm font-bold">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.course || "Universitário"}</p></div></div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {searchedPosts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Publicações</h3>
              {searchedPosts.map(post => <PostCard key={post.id} post={post} currentUserId={user!.id} isFollowing={followingIds.includes(post.user_id)} onLike={() => handleLike(post.id, post.user_liked)} onComment={() => openComments(post.id)} onDelete={() => handleDelete(post.id)} onReport={() => setReportPostId(post.id)} onFollow={() => handleFollow(post.user_id)} onOpenProfile={() => openUserProfile(post.user_id)} /> )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4 space-y-4">
          <div className="bg-primary/5 rounded-2xl p-4 mb-4 border border-primary/10">
            <p className="text-sm text-primary/80 font-medium text-center">Acesse a área completa de DM clicando abaixo.</p>
            <Button className="w-full mt-3 rounded-xl" onClick={() => window.location.href = '/messages'}><MessageSquare className="h-4 w-4 mr-2" /> Abrir EduFlow Chat</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAIS DE INTERAÇÃO (Mantidos exatamente iguais) --- */}
      <Dialog open={!!viewProfile} onOpenChange={open => { if (!open) setViewProfile(null); }}>
         {/* ... Código do modal de perfil ... */}
      </Dialog>
      <Dialog open={!!commentPostId} onOpenChange={open => { if (!open) setCommentPostId(null); }}>
         {/* ... Código do modal de comentários ... */}
      </Dialog>
      <Dialog open={!!reportPostId} onOpenChange={open => { if (!open) setReportPostId(null); }}>
         {/* ... Código do modal de denúncias ... */}
      </Dialog>
    </div>
  );
}

/* ──── Post Card Component Atualizado ──── */
function PostCard({ post, currentUserId, isFollowing, onLike, onComment, onDelete, onReport, onFollow, onOpenProfile }: any) {
  const isOwner = post.user_id === currentUserId;

  // Lógica para determinar o que renderizar baseado na extensão da URL
  const isVideo = post.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isPdf = post.media_url?.match(/\.(pdf)$/i);

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
        
        {/* Renderização Inteligente de Mídia */}
        {post.media_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border/50 bg-muted/10">
            {isPdf ? (
              <div className="flex items-center justify-between p-4 bg-muted/30">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">Documento Anexado</p>
                    <p className="text-xs text-muted-foreground">Formato PDF</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="rounded-xl ml-2 shrink-0" onClick={() => window.open(post.media_url, '_blank')}>
                  <Download className="h-4 w-4 mr-2" /> Abrir
                </Button>
              </div>
            ) : isVideo ? (
              <video src={post.media_url} controls className="w-full h-auto max-h-[400px] object-contain bg-black rounded-xl" />
            ) : (
              <img src={post.media_url} alt="Mídia" className="w-full h-auto object-cover max-h-[400px] rounded-xl" />
            )}
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
