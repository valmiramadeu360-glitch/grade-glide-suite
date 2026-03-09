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
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, X, Search, Info, Download,
  Bookmark, Share2, BadgeCheck, Briefcase
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Expandimos as tags para incluir o Marketplace
const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Evento", "Desabafo"];
const MARKETPLACE_TAGS = ["Venda de Livro", "República", "Vaga de Estágio", "Doação"];

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
    is_verified?: boolean;
    badge?: string;
  };
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
  
  const [newContent, setNewContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedPosts, setSearchedPosts] = useState<Post[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);

  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const [viewProfile, setViewProfile] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      loadFollowing();
      loadPosts();
    }
  }, [user, tab]); // Recarrega quando muda a aba

  async function loadFollowing() {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
    setFollowingIds((data ?? []).map(f => f.following_id));
  }

  async function fetchMetricsForPosts(postsData: any[]) {
    const postIds = postsData.map(p => p.id);
    if(postIds.length === 0) return [];

    const { data: likesData } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
    const { data: commentsData } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);
    const { data: savedData } = await supabase.from("saved_posts").select("post_id").eq("user_id", user!.id).in("post_id", postIds);

    const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
    (likesData ?? []).forEach(l => {
      if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
      likesMap[l.post_id].count++;
      if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
    });

    const commentsMap: Record<string, number> = {};
    (commentsData ?? []).forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });

    const savedSet = new Set((savedData ?? []).map(s => s.post_id));

    return postsData.map(p => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
      likes_count: likesMap[p.id]?.count || 0,
      comments_count: commentsMap[p.id] || 0,
      user_liked: likesMap[p.id]?.userLiked || false,
      user_saved: savedSet.has(p.id),
    }));
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(id, full_name, avatar_url, course, bio, is_verified, badge)")
        .order("created_at", { ascending: false })
        .limit(50);

      // Filtra posts do Marketplace apenas para a aba de Oportunidades
      if (tab === "oportunidades") {
        query = query.in("tag", MARKETPLACE_TAGS);
      } else {
        query = query.not("tag", "in", `(${MARKETPLACE_TAGS.map(t => `"${t}"`).join(",")})`);
      }

      const { data: postsData } = await query;

      if (postsData) {
        const postsWithMetrics = await fetchMetricsForPosts(postsData);
        // Se a aba for "trending", ordenamos pelo frontend baseado no engajamento
        if (tab === "trending") {
          postsWithMetrics.sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count));
        }
        setPosts(postsWithMetrics);
      }
    } finally {
      setLoading(false);
    }
  }

  // --- Funções de Ação ---
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é de 50MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl('pdf-preview');
  }

  async function handlePost() {
    if ((!newContent.trim() && !selectedFile) || !user) return;
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('post_media').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('post_media').getPublicUrl(filePath);
        mediaUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id, content: newContent.trim(), media_url: mediaUrl, tag: selectedTag
      });
      if (error) throw error;
      setNewContent(""); setSelectedFile(null); setPreviewUrl(null); setSelectedTag(null);
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
    if (liked) await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  }

  async function handleSave(postId: string, saved: boolean) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_saved: !saved } : p));
    if (saved) await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("saved_posts").insert({ post_id: postId, user_id: user.id });
    toast({ title: saved ? "Removido do Acervo" : "Salvo no Acervo de Materiais 📚" });
  }

  function handleShare(postId: string) {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "Pronto para compartilhar com a turma." });
  }

  // (Mantenha as funções openComments, handleComment, handleReport, handleDelete, handleFollow, openUserProfile iguais...)
  // Para economizar espaço visual aqui, assuma que as funções estão aqui como no código anterior.
  // ... [Cole as funções aqui] ...

  const filteredPosts = useMemo(() => {
    if (tab === "following") return posts.filter(p => followingIds.includes(p.user_id));
    if (tab === "saved") return posts.filter(p => p.user_saved);
    return posts;
  }, [tab, posts, followingIds]);

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
            <p className="text-sm font-medium text-muted-foreground">A rede exclusiva da sua universidade</p>
          </div>
        </div>
      </div>

      {/* Post Creation Card */}
      {tab !== "chat" && tab !== "search" && (
        <Card className="overflow-hidden shadow-sm border-border/50">
          <CardContent className="p-5 space-y-4">
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={tab === "oportunidades" ? "Anuncie uma vaga, livro ou moradia..." : "Compartilhe conhecimento com a comunidade..."}
              className="min-h-[100px] rounded-2xl border-border/50 bg-muted/30 resize-none text-sm font-medium focus:bg-background transition-colors"
             />
             
            <div className="flex flex-wrap gap-2 pt-2">
              {(tab === "oportunidades" ? MARKETPLACE_TAGS : ACADEMIC_TAGS).map(tag => (
                <Badge 
                  key={tag} variant={selectedTag === tag ? "default" : "secondary"}
                  className="cursor-pointer rounded-lg text-[10px] font-black uppercase tracking-widest"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Media Preview */}
            {previewUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-border/50 mt-2 bg-muted/20">
                {/* ... (Mesmo código de preview da versão anterior) ... */}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1 border border-border/40">
                <input type="file" id="media-upload" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><Image className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><Video className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><FileText className="h-4 w-4" /></Button>
              </div>
              <Button onClick={handlePost} disabled={(!newContent.trim() && !selectedFile) || posting} className="rounded-2xl px-6 gap-2">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TABS COMPLETAS */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap rounded-2xl bg-muted/50 p-1 mb-4">
          <TabsTrigger value="global" className="flex-1 min-w-[70px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Globe className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Feed</span></TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 min-w-[70px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><TrendingUp className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Em Alta</span></TabsTrigger>
          <TabsTrigger value="following" className="flex-1 min-w-[70px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Seguindo</span></TabsTrigger>
          <TabsTrigger value="oportunidades" className="flex-1 min-w-[70px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-primary data-[state=active]:bg-primary/10"><Briefcase className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Oportunidades</span></TabsTrigger>
          <TabsTrigger value="saved" className="flex-1 min-w-[70px] h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"><Bookmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Acervo</span></TabsTrigger>
        </TabsList>

        {/* Renderização do Feed */}
        {["global", "trending", "following", "oportunidades", "saved"].includes(tab) && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredPosts.length === 0 ? (
              <EmptyFeed message={tab === "saved" ? "Você ainda não salvou nenhum material." : "Nenhuma publicação encontrada."} />
            ) : filteredPosts.map(post => (
              <PostCard 
                key={post.id} post={post} currentUserId={user!.id} 
                isFollowing={followingIds.includes(post.user_id)} 
                onLike={() => handleLike(post.id, post.user_liked)} 
                onSave={() => handleSave(post.id, post.user_saved)}
                onShare={() => handleShare(post.id)}
                /* passe as outras props de comment, delete, report, etc */ 
              />
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}

/* ──── Post Card Component com TUDO ──── */
function PostCard({ post, currentUserId, isFollowing, onLike, onSave, onShare, onComment, onDelete, onReport, onFollow, onOpenProfile }: any) {
  const isOwner = post.user_id === currentUserId;
  const isVideo = post.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isPdf = post.media_url?.match(/\.(pdf)$/i);

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow border-border/50">
      <CardContent className="p-5 space-y-4">
        {/* User Info com Selo de Verificado e Emblema */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={onOpenProfile}>
            <Avatar className="h-11 w-11 transition-transform group-hover:scale-105">
              <AvatarImage src={post.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                  {post.profiles?.full_name || "Estudante"}
                </p>
                {post.profiles?.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500" title="Estudante Verificado" />}
                
                {/* Badges de Gamificação */}
                {post.profiles?.badge && (
                  <Badge variant="outline" className="ml-1 text-[8px] h-4 px-1 uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {post.profiles.badge}
                  </Badge>
                )}

                {!isOwner && (
                  <button onClick={(e) => { e.stopPropagation(); onFollow(); }} className={cn("ml-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg transition-colors", isFollowing ? "text-muted-foreground bg-muted" : "text-primary bg-primary/10")}>
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
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl bg-card border-border shadow-xl">
              <DropdownMenuItem onClick={onShare} className="font-bold gap-2"><Share2 className="h-4 w-4" /> Compartilhar Link</DropdownMenuItem>
              {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold gap-2"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>}
              {!isOwner && <DropdownMenuItem onClick={onReport} className="text-destructive font-bold gap-2"><Flag className="h-4 w-4" /> Denunciar</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.tag && <Badge variant="secondary" className={cn("rounded-lg text-[10px] font-black uppercase tracking-widest mb-2", MARKETPLACE_TAGS.includes(post.tag) && "bg-primary/10 text-primary")}>{post.tag}</Badge>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        
        {/* Mídia */}
        {post.media_url && (
           /* ... (Mesmo código de renderização de imagem/vídeo/pdf do anterior) ... */
           <div className="mt-3 rounded-xl overflow-hidden border border-border/50 bg-muted/10">
            {isPdf ? (
              <div className="flex items-center justify-between p-4 bg-muted/30">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">Material Anexado</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="rounded-xl ml-2" onClick={() => window.open(post.media_url, '_blank')}><Download className="h-4 w-4 mr-2" /> Baixar</Button>
              </div>
            ) : isVideo ? (
              <video src={post.media_url} controls className="w-full h-auto max-h-[400px] object-contain bg-black rounded-xl" />
            ) : (
              <img src={post.media_url} alt="Mídia" className="w-full h-auto object-cover max-h-[400px] rounded-xl" />
            )}
          </div>
        )}

        {/* Ações Sociais COMPLETAS */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onLike} className={cn("rounded-xl gap-2 font-bold text-xs", post.user_liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500")}>
              <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} /> {post.likes_count > 0 && post.likes_count}
            </Button>
            <Button variant="ghost" size="sm" onClick={onComment} className="rounded-xl gap-2 font-bold text-xs text-muted-foreground hover:text-primary">
              <MessageSquare className="h-4 w-4" /> {post.comments_count > 0 && post.comments_count}
            </Button>
            <Button variant="ghost" size="sm" onClick={onShare} className="rounded-xl gap-2 font-bold text-xs text-muted-foreground hover:text-primary">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* O Botão de Salvar no Acervo */}
          <Button variant="ghost" size="sm" onClick={onSave} className={cn("rounded-xl", post.user_saved ? "text-primary" : "text-muted-foreground")}>
            <Bookmark className={cn("h-5 w-5", post.user_saved && "fill-current")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
