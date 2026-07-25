import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image as ImageIcon, FileText, Video,
  Send, Loader2, Trash2, Download, Bookmark, Share2, X, Plus, Newspaper, PenLine,
  BarChart3, ExternalLink, Pin, Store, Check, UploadCloud
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommunities } from "@/hooks/useCommunities";

const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Evento", "Desabafo"];
const MARKETPLACE_TAGS = ["Livros", "Eletrônicos", "Repúblicas", "Estágios", "Serviços", "Outros"];

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

  // Navegação Principal Unificada
  const initialTab = searchParams.get("tab") || "global";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  
  // Filtros secundários
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer Post
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "document" | "poll">("text");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Comments
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // News
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeNews, setActiveNews] = useState<any | null>(null);

  // News Editor (Jornal)
  const [newsComposerOpen, setNewsComposerOpen] = useState(false);
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [newsChannelId, setNewsChannelId] = useState<string>("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsLink, setNewsLink] = useState("");
  const [newsCoverFile, setNewsCoverFile] = useState<File | null>(null);
  const [newsCoverPreview, setNewsCoverPreview] = useState<string | null>(null);
  const [publishingNews, setPublishingNews] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (activeTab === "news") {
      loadNews();
    } else {
      loadPosts();
    }
  }, [user, activeTab, activeCommunity, marketFilter, showSavedOnly]);

  function changeTab(v: string) {
    setActiveTab(v);
    setShowSavedOnly(false); // Reseta o filtro de salvos ao trocar de aba
    setSearchParams(v === "global" ? {} : { tab: v }, { replace: true });
  }

  // Lógica de Arquivos (Manteve-se idêntica, apenas refinada)
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (Máx 50MB)", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl("pdf-preview");
    }
  }

  function handleNewsCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewsCoverFile(file);
    setNewsCoverPreview(URL.createObjectURL(file));
  }

  async function loadPosts() {
    setLoading(true);
    try {
      if (showSavedOnly) {
        const { data: saved } = await supabase.from("saved_posts").select("post_id").eq("user_id", user!.id);
        const ids = (saved ?? []).map((s: any) => s.post_id);
        if (ids.length === 0) { setPosts([]); return; }
        const { data } = await supabase.from("posts").select("*").in("id", ids).order("created_at", { ascending: false });
        if (data) setPosts(await fetchMetricsForPosts(data));
        return;
      }

      let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
      
      if (activeTab === "market") {
        if (marketFilter) {
          query = query.eq("tag", marketFilter);
        } else {
          query = query.in("tag", MARKETPLACE_TAGS);
        }
      } else {
        query = query.not("tag", "in", `(${MARKETPLACE_TAGS.join(',')})`);
      }

      if (activeCommunity) {
        query = query.eq("community_id", activeCommunity);
      } else {
        query = query.is("community_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setPosts(await fetchMetricsForPosts(data));
    } catch (e) {
      toast({ title: "Erro ao carregar feed", variant: "destructive" });
    } finally {
      setLoading(false);
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
      if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
      likesMap[l.post_id].count++;
      if (l.user_id === user.id) likesMap[l.post_id].userLiked = true;
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

      const { data: created, error } = await supabase.from("posts").insert({
        user_id: user.id, content: newContent.trim(), media_url: mediaUrl, tag: selectedTag, community_id: activeCommunity, media_type: mediaType, title: newTitle || null, document_url: documentUrl, video_url: videoUrl,
      }).select().single();
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

  // Funções de News (Jornal)
  async function loadNews() {
    setNewsLoading(true);
    try {
      const { data } = await supabase.from("news_posts").select("*, news_channels(name, scope)").order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50);
      setNewsItems(data ?? []);
    } finally { setNewsLoading(false); }
  }

  async function loadMyChannels() {
    if (!user) return;
    const { data: subs } = await supabase.from("news_subscriptions").select("channel_id, news_channels(id, name, scope)").eq("user_id", user.id);
    const channels = (subs ?? []).map((s: any) => s.news_channels).filter(Boolean);
    setMyChannels(channels);
    if (channels[0]?.id) setNewsChannelId(channels[0].id);
  }

  async function publishNews() {
    if (!user || !newsChannelId || !newsTitle.trim()) return;
    setPublishingNews(true);
    try {
      let coverUrl = null;
      if (newsCoverFile) {
        const fileExt = newsCoverFile.name.split(".").pop();
        const filePath = `news/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("post-media").upload(filePath, newsCoverFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);
        coverUrl = data.publicUrl;
      }

      const { error } = await supabase.from("news_posts").insert({
        channel_id: newsChannelId, author_id: user.id, title: newsTitle.trim(), content: newsContent.trim() || newsTitle.trim(), link_url: newsLink.trim() || null, cover_url: coverUrl
      });
      
      if (error) throw error;
      toast({ title: "Notícia publicada com sucesso!" });
      setNewsComposerOpen(false); setNewsTitle(""); setNewsContent(""); setNewsLink(""); setNewsCoverFile(null); setNewsCoverPreview(null);
      loadNews();
    } catch (e: any) {
      toast({ title: "Permissão Negada", description: "Apenas administradores podem publicar notícias oficiais.", variant: "destructive" });
    } finally {
      setPublishingNews(false);
    }
  }

  // Interações
  async function handleLike(post: Post) {
    if (!user) return;
    try {
      if (post.user_liked) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      else await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !p.user_liked, likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    } catch (e: any) { toast({ title: "Erro ao curtir", variant: "destructive" }); }
  }

  async function handleSave(post: Post) {
    if (!user) return;
    try {
      if (post.user_saved) await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user.id);
      else await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
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
    } catch (e: any) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  }

  async function openComments(post: Post) {
    setActivePost(post);
    setCommentModalOpen(true);
    try {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      if (data?.length === 0) return setPostComments([]);
      const ids = Array.from(new Set(data!.map((c) => c.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name,avatar_url").in("user_id", ids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setPostComments(data!.map((c) => ({ ...c, profiles: map[c.user_id] ?? null })));
    } catch { setPostComments([]); }
  }

  async function sendComment() {
    if (!user || !activePost || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const { error } = await supabase.from("post_comments").insert({ post_id: activePost.id, user_id: user.id, content: newComment.trim() });
      if (error) throw error;
      setNewComment("");
      openComments(activePost); // Recarrega
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (e: any) { toast({ title: "Erro", variant: "destructive" }); } finally { setSendingComment(false); }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-28 animate-in fade-in">
      
      {/* HEADER COMPACTO E AÇÃO RÁPIDA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Connect</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Campus Digital</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab !== "news" && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={cn("h-10 w-10 rounded-full border-0 transition-all", showSavedOnly ? "bg-amber-500/10 text-amber-500" : "bg-muted/50 text-muted-foreground")}
            >
              <Bookmark className={cn("h-4 w-4", showSavedOnly && "fill-current")} />
            </Button>
          )}
          
          <Button 
            onClick={() => {
              if (activeTab === "news") {
                loadMyChannels(); setNewsComposerOpen(true);
              } else {
                setComposerOpen(true);
                setSelectedTag(activeTab === "market" ? MARKETPLACE_TAGS[0] : null);
              }
            }} 
            className="rounded-full shadow-lg hover:scale-105 transition-all text-xs font-bold px-4 h-10 bg-primary text-white"
          >
            <PenLine className="h-4 w-4 mr-1.5" /> 
            {activeTab === "news" ? "Escrever" : "Criar Post"}
          </Button>
        </div>
      </div>

      {/* TABS ÚNICAS E LIMPAS (Fim da Duplicação) */}
      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="w-full rounded-[20px] bg-muted/40 p-1 flex shadow-sm">
          <TabsTrigger value="global" className="flex-1 rounded-2xl font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4 hidden sm:block" /> Geral
          </TabsTrigger>
          <TabsTrigger value="market" className="flex-1 rounded-2xl font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Store className="h-4 w-4 hidden sm:block" /> Mercado
          </TabsTrigger>
          <TabsTrigger value="news" className="flex-1 rounded-2xl font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Newspaper className="h-4 w-4 hidden sm:block" /> Notícias
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* FILTROS ESPECÍFICOS POR ABA (Em formato de "Chips/Pílulas") */}
      {!showSavedOnly && activeTab === "market" && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none animate-in slide-in-from-right-4">
          <button onClick={() => setMarketFilter(null)} className={cn("shrink-0 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-full transition-all border", !marketFilter ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted")}>Todos</button>
          {MARKETPLACE_TAGS.map((t) => (
            <button key={t} onClick={() => setMarketFilter(t)} className={cn("shrink-0 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-full transition-all border", marketFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted")}>{t}</button>
          ))}
        </div>
      )}

      {/* MODAL DE COMPOSIÇÃO DE POST (Geral e Mercado) - Glassmorphism */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="rounded-[32px] p-6 sm:max-w-md border border-white/20 bg-background/80 backdrop-blur-3xl shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-black">{activeTab === "market" ? "Criar Anúncio" : "Nova Publicação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            
            <div className="flex gap-2 flex-wrap">
              {(activeTab === "market" ? MARKETPLACE_TAGS : ACADEMIC_TAGS).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border",
                    selectedTag === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70"
                  )}
                >
                  {selectedTag === t && <Check className="h-3 w-3 inline-block mr-1" />}
                  {t}
                </button>
              ))}
            </div>
            
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={activeTab === "market" ? "Descreva o item, preço, localização..." : "O que você quer compartilhar hoje?"}
              rows={4}
              className="rounded-2xl resize-none border-0 bg-muted/40 focus-visible:ring-1 text-sm p-4"
            />

            {previewUrl && previewUrl !== "pdf-preview" && (
              <div className="relative animate-in zoom-in-95">
                {mediaType === "video" ? (
                  <video src={previewUrl} controls className="rounded-2xl w-full max-h-56 object-cover shadow-sm" />
                ) : (
                  <img src={previewUrl} className="rounded-2xl w-full max-h-56 object-cover shadow-sm" />
                )}
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {previewUrl === "pdf-preview" && selectedFile && (
              <div className="flex items-center justify-between bg-muted/50 rounded-2xl p-3 border border-border/50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0"><FileText className="h-5 w-5" /></div>
                  <span className="text-xs font-bold truncate">{selectedFile.name}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}><X className="h-4 w-4" /></Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer group">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { setMediaType(e.target.files?.[0]?.type.startsWith('video') ? "video" : "image"); handleFileSelect(e); }} />
                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all"><ImageIcon className="h-4 w-4" /></div>
                </label>
                <label className="cursor-pointer group">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { setMediaType("document"); handleFileSelect(e); }} />
                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all"><FileText className="h-4 w-4" /></div>
                </label>
              </div>
              <Button onClick={handlePost} disabled={posting || (!newContent.trim() && !selectedFile)} className="rounded-full font-black h-10 px-6 text-sm">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDITOR DE NOTÍCIAS (JORNAL COMPLETO) */}
      <Dialog open={newsComposerOpen} onOpenChange={setNewsComposerOpen}>
        <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden border-0 shadow-2xl bg-background">
          <div className="p-6 border-b border-border/40 bg-muted/20">
            <h2 className="font-black text-xl flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary"/> Redação Oficial</h2>
            <p className="text-xs text-muted-foreground font-semibold mt-1">Publique notícias e comunicados para o campus.</p>
          </div>
          <ScrollArea className="max-h-[60vh] p-6 space-y-5">
            {myChannels.length === 0 ? (
              <div className="text-center p-6 bg-muted/30 rounded-3xl border border-dashed border-border/50">
                <p className="text-sm font-semibold text-muted-foreground">Você não tem permissão de editor em nenhum canal oficial.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Canal de Publicação</Label>
                  <select value={newsChannelId} onChange={(e) => setNewsChannelId(e.target.value)} className="w-full rounded-2xl bg-muted/40 border-0 h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none">
                    {myChannels.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                
                {/* Upload de Capa Premium */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Capa da Notícia</Label>
                  {newsCoverPreview ? (
                    <div className="relative rounded-2xl overflow-hidden group">
                      <img src={newsCoverPreview} className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="destructive" className="rounded-full font-bold" onClick={() => {setNewsCoverFile(null); setNewsCoverPreview(null);}}><Trash2 className="h-4 w-4 mr-2"/>Remover Capa</Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/60 rounded-2xl cursor-pointer bg-muted/20 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-bold text-muted-foreground">Adicionar foto de capa</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleNewsCoverSelect} />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Manchete (Título)</Label>
                  <Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="Ex: Nova biblioteca inaugurada..." className="h-12 rounded-2xl bg-muted/40 border-0 font-black text-base" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Corpo da Notícia</Label>
                  <Textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} placeholder="Escreva os detalhes aqui..." rows={6} className="rounded-2xl bg-muted/40 border-0 text-sm p-4 resize-none" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Link Externo (Opcional)</Label>
                  <Input value={newsLink} onChange={(e) => setNewsLink(e.target.value)} placeholder="https://..." className="h-12 rounded-2xl bg-muted/40 border-0 text-sm" />
                </div>
              </div>
            )}
          </ScrollArea>
          {myChannels.length > 0 && (
            <div className="p-4 border-t border-border/40 bg-background">
              <Button onClick={publishNews} disabled={publishingNews || !newsTitle.trim()} className="w-full h-12 rounded-2xl font-black text-base">
                {publishingNews ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : "Publicar Edição"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* LISTAGEM DE POSTS (FEED E SAVED) */}
      {(activeTab === "global" || activeTab === "market") && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center rounded-[32px] bg-muted/30 border-2 border-dashed border-border/50 animate-in fade-in">
            {activeTab === "market" ? <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" /> : <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />}
            <p className="text-lg font-bold text-muted-foreground">Nenhuma publicação encontrada.</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Seja o primeiro a postar algo aqui.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} isOwner={p.user_id === user?.id} onLike={() => handleLike(p)} onSave={() => handleSave(p)} onComment={() => openComments(p)} onDelete={() => handleDelete(p)} />
            ))}
          </div>
        )
      )}

      {/* TELA DE NOTÍCIAS */}
      {activeTab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5 animate-in fade-in">
            {newsItems.length === 0 ? (
              <div className="p-12 text-center rounded-[32px] bg-muted/30 border-2 border-dashed border-border/50">
                <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-lg font-bold text-muted-foreground">Sem comunicados recentes.</p>
              </div>
            ) : (
              newsItems.map((n) => (
                <Card key={n.id} className="rounded-[28px] overflow-hidden cursor-pointer hover:shadow-xl transition-all border-0 shadow-sm bg-card group" onClick={() => setActiveNews(n)}>
                  {n.cover_url && (
                    <div className="relative h-48 w-full overflow-hidden">
                      <img src={n.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                          {n.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          <Badge variant="secondary" className="rounded-lg text-[9px] font-black px-2 bg-white/20 text-white border-0 backdrop-blur-sm">{n.news_channels?.name ?? "Canal"}</Badge>
                        </div>
                        <h3 className="font-black text-lg leading-tight line-clamp-2">{n.title}</h3>
                      </div>
                    </div>
                  )}
                  <CardContent className={cn("p-5", n.cover_url ? "pt-4" : "pt-5")}>
                    {!n.cover_url && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          {n.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          <Badge variant="secondary" className="rounded-lg text-[9px] font-black px-2">{n.news_channels?.name ?? "Canal"}</Badge>
                        </div>
                        <h3 className="font-black text-lg leading-tight text-foreground mb-2">{n.title}</h3>
                      </>
                    )}
                    {n.content && <p className="text-sm text-muted-foreground line-clamp-2">{n.content}</p>}
                    <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span>{formatDistanceToNow(new Date(n.published_at), { locale: ptBR, addSuffix: true })}</span>
                      <span className="text-primary flex items-center gap-1 group-hover:underline">Ler completo <ExternalLink className="h-3 w-3"/></span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )
      )}

      {/* VISUALIZADOR DE NOTÍCIA COMPLETA */}
      <Dialog open={!!activeNews} onOpenChange={(o) => !o && setActiveNews(null)}>
        <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden border-0 shadow-2xl bg-background">
          {activeNews && (
            <ScrollArea className="max-h-[80vh]">
              {activeNews.cover_url && <img src={activeNews.cover_url} className="w-full h-64 object-cover" />}
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-lg font-black text-[10px] uppercase tracking-widest">{activeNews.news_channels?.name}</Badge>
                  <span className="text-xs text-muted-foreground font-semibold">{formatDistanceToNow(new Date(activeNews.published_at), { locale: ptBR, addSuffix: true })}</span>
                </div>
                <h2 className="font-black text-2xl tracking-tight text-foreground leading-tight">{activeNews.title}</h2>
                <div className="w-12 h-1 bg-primary rounded-full" />
                <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed pt-2">{activeNews.content}</p>
                {activeNews.link_url && (
                  <Button className="w-full rounded-2xl h-12 font-bold mt-4" onClick={() => window.open(activeNews.link_url, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Acessar Link Externo
                  </Button>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE COMENTÁRIOS (Refinado e Glass) */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden border-0 shadow-2xl bg-background">
          <div className="p-4 border-b border-border/20 bg-muted/30">
            <h3 className="font-black text-lg">Comentários</h3>
          </div>
          <ScrollArea className="h-[45vh] p-5">
            {postComments.length === 0 ? (
              <p className="text-center text-sm font-semibold text-muted-foreground py-10">Ninguém comentou ainda. Seja o primeiro!</p>
            ) : (
              <div className="space-y-4">
                {postComments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                      <AvatarImage src={c.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{c.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/40 rounded-[20px] rounded-tl-sm px-4 py-3 flex-1 border border-border/30">
                      <p className="text-[12px] font-black text-foreground">{c.profiles?.full_name || "Estudante"}</p>
                      <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t border-border/20 bg-background flex gap-3">
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicionar comentário..." className="h-12 rounded-2xl bg-muted/50 border-0 text-sm focus-visible:ring-primary shadow-inner" onKeyDown={(e) => { if (e.key === "Enter") sendComment(); }} />
            <Button size="icon" onClick={sendComment} disabled={sendingComment || !newComment.trim()} className="h-12 w-12 rounded-2xl shrink-0 shadow-md bg-primary text-white hover:scale-105 transition-transform">
              {sendingComment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// POST CARD (Mais limpo, sem bordas agressivas, espaçamentos reais de app)
function PostCard({ post, onLike, onSave, onComment, isOwner, onDelete }: any) {
  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i) || post.document_url;
  const mediaSource = post.document_url || post.video_url || post.media_url;

  return (
    <Card className="rounded-[28px] border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card overflow-hidden">
      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
        <div className="flex gap-3 items-center">
          <Avatar className="h-10 w-10 shadow-sm border border-border/30">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">{post.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="font-black text-sm text-foreground leading-tight">{post.profiles?.full_name || "Estudante"}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: true })}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/80"><MoreHorizontal className="h-5 w-5"/></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-0 shadow-xl bg-background/90 backdrop-blur-xl p-1">
            {isOwner && <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold rounded-xl focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2"/>Apagar Post</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(post.content)} className="font-bold rounded-xl"><Share2 className="h-4 w-4 mr-2"/>Copiar Texto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-5 pt-3">
        {post.tag && <Badge variant="secondary" className="mb-3 rounded-lg text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border-0 bg-primary/10 text-primary">{post.tag}</Badge>}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.content}</p>
        
        {mediaSource && (
          <div className="mt-4 rounded-[20px] overflow-hidden border border-border/10 shadow-sm">
            {isPdf ? (
              <div className="flex items-center justify-between bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><FileText className="h-5 w-5" /></div>
                  <span className="text-xs font-bold text-foreground">Documento Anexado</span>
                </div>
                <Button size="sm" variant="outline" className="h-9 rounded-xl font-bold bg-background shadow-sm" onClick={() => window.open(mediaSource)}><Download className="h-4 w-4 mr-1.5"/>Baixar</Button>
              </div>
            ) : isVideo ? (
              <video src={mediaSource} controls className="w-full max-h-80 object-cover bg-black" />
            ) : (
              <img src={mediaSource} className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between items-center mt-1">
        <div className="flex gap-1.5">
          <Button variant="ghost" onClick={onLike} className={cn("h-10 rounded-full px-4 text-xs font-bold transition-all", post.user_liked ? "text-red-500 hover:text-red-600 bg-red-500/10" : "text-muted-foreground hover:bg-muted/80")}>
            <Heart className={cn("h-4 w-4 mr-1.5", post.user_liked && "fill-current")} /> {post.likes_count > 0 ? post.likes_count : "Curtir"}
          </Button>
          <Button variant="ghost" onClick={onComment} className="h-10 rounded-full px-4 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all">
            <MessageSquare className="h-4 w-4 mr-1.5"/> {post.comments_count > 0 ? post.comments_count : "Comentar"}
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onSave} className={cn("h-10 w-10 rounded-full transition-all", post.user_saved ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-muted/80")}>
          <Bookmark className={cn("h-5 w-5", post.user_saved && "fill-current")} />
        </Button>
      </CardFooter>
    </Card>
  );
}
