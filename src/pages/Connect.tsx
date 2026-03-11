import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image, FileText, Video,
  Send, Loader2, User, Flag, Trash2, Users, TrendingUp, Download,
  Bookmark, Share2, BadgeCheck, Briefcase
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (user) {
      loadFollowing();
      loadPosts();
    }
  }, [user, tab]);

  async function loadFollowing() {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
    setFollowingIds((data ?? []).map(f => f.following_id));
  }

  async function fetchMetricsForPosts(postsData: any[]) {
    const postIds = postsData.map(p => p.id);
    if(postIds.length === 0) return [];

    const { data: likesData } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
    // Assumindo que você tem ou terá a tabela post_comments
    const { data: commentsData } = await supabase.from("post_comments").select("post_id").in("post_id", postIds).catch(() => ({ data: [] }));
    const { data: savedData } = await supabase.from("saved_posts").select("post_id").eq("user_id", user!.id).in("post_id", postIds).catch(() => ({ data: [] }));

    const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
    (likesData ?? []).forEach(l => {
      if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
      likesMap[l.post_id].count++;
      if (l.user_id === user!.id) likesMap[l.post_id].userLiked = true;
    });

    const commentsMap: Record<string, number> = {};
    (commentsData ?? []).forEach((c: any) => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });

    const savedSet = new Set((savedData ?? []).map((s: any) => s.post_id));

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

      if (tab === "oportunidades") {
        query = query.in("tag", MARKETPLACE_TAGS);
      } else {
        // Exclui tags de marketplace do feed principal
        query = query.not("tag", "in", `(${MARKETPLACE_TAGS.map(t => `"${t}"`).join(",")})`);
      }

      const { data: postsData } = await query;

      if (postsData) {
        const postsWithMetrics = await fetchMetricsForPosts(postsData);
        if (tab === "trending") {
          postsWithMetrics.sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count));
        }
        setPosts(postsWithMetrics);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo grande", description: "Limite de 50MB.", variant: "destructive" });
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
      toast({ title: "Publicado! 🎉" });
      await loadPosts();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
    toast({ title: saved ? "Removido" : "Salvo no Acervo 📚" });
  }

  function handleShare(postId: string) {
    const url = `${window.location.origin}/connect?post=${postId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  }

  async function handleDelete(postId: string) {
    if (!window.confirm("Deseja excluir esta publicação?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      setPosts(posts.filter(p => p.id !== postId));
      toast({ title: "Publicação excluída." });
    }
  }

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
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">A rede exclusiva da sua universidade</p>
          </div>
        </div>
      </div>

      {/* Post Creation */}
      <Card className="overflow-hidden shadow-lg border-border/40 rounded-[32px] bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-black">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={tab === "oportunidades" ? "Anuncie uma vaga, livro ou moradia..." : "Compartilhe um resumo, dúvida ou notícia..."}
              className="min-h-[80px] rounded-2xl border-none bg-transparent resize-none text-base sm:text-lg font-medium placeholder:text-muted-foreground/50 p-2 focus-visible:ring-0"
             />
          </div>
             
          <div className="flex flex-wrap gap-2 pt-2 ml-16">
            {(tab === "oportunidades" ? MARKETPLACE_TAGS : ACADEMIC_TAGS).map(tag => (
              <Badge 
                key={tag} variant={selectedTag === tag ? "default" : "secondary"}
                className={cn("cursor-pointer rounded-lg text-[9px] font-black uppercase tracking-widest px-3 py-1 transition-all", selectedTag === tag && "shadow-md")}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-border/50 mt-4 ml-16 bg-muted/20 w-fit max-w-full">
              <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8 rounded-lg z-10" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                <X className="h-4 w-4" />
              </Button>
              {previewUrl === 'pdf-preview' ? (
                <div className="flex items-center gap-3 p-4">
                  <FileText className="h-8 w-8 text-red-500" />
                  <p className="text-sm font-bold truncate max-w-[200px]">{selectedFile?.name}</p>
                </div>
              ) : selectedFile?.type.startsWith('video/') ? (
                <video src={previewUrl} className="max-h-[300px] object-contain" />
              ) : (
                <img src={previewUrl} className="max-h-[300px] object-contain" alt="Preview" />
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
            <div className="flex items-center gap-1 bg-muted/30 rounded-2xl p-1 border border-border/40 ml-16">
              <input type="file" id="media-upload" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleFileSelect} />
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><Image className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><Video className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary" onClick={() => document.getElementById('media-upload')?.click()}><FileText className="h-5 w-5" /></Button>
            </div>
            <Button onClick={handlePost} disabled={(!newContent.trim() && !selectedFile) || posting} className="h-12 rounded-[20px] px-8 gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap rounded-[24px] bg-card/50 border border-border/40 p-1.5 mb-6 shadow-sm gap-1 sm:gap-0">
          <TabsTrigger value="global" className="flex-1 min-w-[70px] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"><Globe className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Feed</span></TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 min-w-[70px] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"><TrendingUp className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Em Alta</span></TabsTrigger>
          <TabsTrigger value="following" className="flex-1 min-w-[70px] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"><Users className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Seguindo</span></TabsTrigger>
          <TabsTrigger value="oportunidades" className="flex-1 min-w-[70px] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest text-primary data-[state=active]:bg-primary/10 transition-all"><Briefcase className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Mercado</span></TabsTrigger>
          <TabsTrigger value="saved" className="flex-1 min-w-[70px] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"><Bookmark className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Acervo</span></TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Buscando Atualizações...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 text-center border-2 border-dashed border-border/40 rounded-[32px] bg-card/20">
            <Globe className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-xl font-black text-foreground">Nada por aqui ainda</p>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-xs">Seja o primeiro a compartilhar algo com a sua universidade.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                currentUserId={user!.id} 
                isFollowing={followingIds.includes(post.user_id)} 
                onLike={() => handleLike(post.id, post.user_liked)} 
                onSave={() => handleSave(post.id, post.user_saved)}
                onShare={() => handleShare(post.id)}
                onDelete={() => handleDelete(post.id)}
                onReport={() => toast({ title: "Denúncia Recebida", description: "Encaminhado para a moderação.", variant: "destructive" })}
              />
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}

/* ──── Componente do Card do Post (Refinado) ──── */
function PostCard({ post, currentUserId, isFollowing, onLike, onSave, onShare, onDelete, onReport }: any) {
  const isOwner = post.user_id === currentUserId;
  const isVideo = post.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isPdf = post.media_url?.match(/\.(pdf)$/i);

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-border/40 rounded-[32px] bg-card">
      <CardHeader className="p-5 sm:p-6 pb-2 flex flex-row items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-primary/10 shadow-sm cursor-pointer transition-transform hover:scale-105">
            <AvatarImage src={post.profiles?.avatar_url || ""} />
            <AvatarFallback className="font-black bg-primary/5 text-primary">
              {(post.profiles?.full_name || "U").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-black text-base flex items-center gap-2 text-foreground cursor-pointer hover:text-primary transition-colors">
              {post.profiles?.full_name || "Estudante"}
              {post.profiles?.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500" title="Verificado" />}
              {post.profiles?.badge && (
                <Badge variant="outline" className="ml-1 text-[8px] h-4 px-1.5 uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/20">
                  {post.profiles.badge}
                </Badge>
              )}
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              {post.profiles?.course || "Universidade"} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-border bg-popover shadow-2xl p-2">
            <DropdownMenuItem onClick={onShare} className="font-bold text-xs p-3 cursor-pointer rounded-xl hover:bg-muted"><Share2 className="h-4 w-4 mr-3" /> Copiar Link</DropdownMenuItem>
            {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold text-xs p-3 cursor-pointer rounded-xl hover:bg-destructive/10 focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-3" /> Excluir Publicação</DropdownMenuItem>}
            {!isOwner && <DropdownMenuItem onClick={onReport} className="text-destructive font-bold text-xs p-3 cursor-pointer rounded-xl hover:bg-destructive/10 focus:bg-destructive/10"><Flag className="h-4 w-4 mr-3" /> Denunciar</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-5 sm:p-6 pt-2">
        {post.tag && <Badge variant="secondary" className={cn("rounded-lg text-[9px] font-black uppercase tracking-widest mb-3 px-3 py-1", MARKETPLACE_TAGS.includes(post.tag) ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground")}>{post.tag}</Badge>}
        <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">{post.content}</p>
        
        {post.media_url && (
           <div className="mt-4 rounded-2xl overflow-hidden border border-border/50 bg-muted/10">
            {isPdf ? (
              <div className="flex items-center justify-between p-4 bg-background hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate text-foreground">Material Anexado (PDF)</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Toque para visualizar</p>
                  </div>
                </div>
                <Button variant="secondary" size="icon" className="rounded-xl ml-2 h-12 w-12 shrink-0" onClick={() => window.open(post.media_url, '_blank')}><Download className="h-5 w-5" /></Button>
              </div>
            ) : isVideo ? (
              <video src={post.media_url} controls className="w-full h-auto max-h-[400px] object-contain bg-black" />
            ) : (
              <img src={post.media_url} alt="Mídia" className="w-full h-auto max-h-[500px] object-cover" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 sm:p-6 pt-0 flex items-center justify-between border-t border-border/30 mt-2 bg-muted/5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onLike} className={cn("rounded-xl gap-2 font-black text-xs px-4 h-10 transition-all", post.user_liked ? "text-rose-500 hover:text-rose-600 bg-rose-500/10" : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10")}>
            <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} /> {post.likes_count > 0 ? post.likes_count : "Curtir"}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl gap-2 font-black text-xs px-4 h-10 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
            <MessageSquare className="h-4 w-4" /> {post.comments_count > 0 ? post.comments_count : "Comentar"}
          </Button>
        </div>
        
        <Button variant="ghost" size="icon" onClick={onSave} className={cn("rounded-xl h-10 w-10 transition-all", post.user_saved ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted")}>
          <Bookmark className={cn("h-5 w-5", post.user_saved && "fill-current")} />
        </Button>
      </CardFooter>
    </Card>
  );
}
