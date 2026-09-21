import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

import {
  Globe, Heart, MessageSquare, MoreHorizontal, Image as ImageIcon, FileText, Video,
  Send, Loader2, Trash2, Download, Bookmark, Share2, X, Plus, Newspaper, PenLine,
  ExternalLink, Pin, Store, Check, UploadCloud, Search, ShoppingBag, Tag, ChevronRight, CheckCircle2,
  Sparkles, TrendingUp, Building2, GraduationCap, Users, BadgeCheck, HelpCircle, Brain,
  FlaskConical, Award, Briefcase, Home as HomeIcon
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommunities } from "@/hooks/useCommunities";

// Capítulo 6, seção 4 — categorias do feed acadêmico (Foto/Vídeo/Enquete usam
// mediaType, não tag; Livro/Venda/República ficam nas MARKETPLACE_TAGS).
const ACADEMIC_TAGS = ["Resumo", "Dúvida", "Flashcards", "Artigo", "Pesquisa", "Projeto", "Evento", "Estágio", "Desabafo", "Networking", "Aviso"];
// "Aviso" é restrito a autores com selo institucional (professor/universidade/admin) — ver isRestrictedTagAllowed.
const RESTRICTED_TAGS = ["Aviso"];
const MARKETPLACE_TAGS = ["Livro/Apostila", "Eletrônicos", "República", "Vaga de Estágio", "Serviço Acadêmico", "Vestuário", "Outros"];

// Filtros do FEED (só aparecem na aba Feed). Marketplace, Notícias e
// Comunidades saíram daqui: cada um tem seu próprio botão na barra inferior,
// e repetir os mesmos nomes em dois lugares confundia o estudante.
const FEED_TABS = [
  { value: "foryou", label: "Para Você", icon: Sparkles },
  { value: "trending", label: "Em Alta", icon: TrendingUp },
  { value: "university", label: "Universidade", icon: Building2 },
  { value: "course", label: "Curso", icon: GraduationCap },
] as const;

// Identidade de cada seção do Connect (título, ícone e legenda do cabeçalho).
const SECTION_INFO: Record<string, { title: string; subtitle: string; icon: any }> = {
  market: { title: "Mercado", subtitle: "Compre e venda no campus", icon: Store },
  news: { title: "Notícias", subtitle: "Jornal universitário", icon: Newspaper },
  feed: { title: "Feed", subtitle: "Campus Digital", icon: Globe },
};

// Selos de verificação (Capítulo 6, seção 5) — mapeados a partir de user_roles.role
const ROLE_BADGES: Record<string, { label: string; icon: any }> = {
  student_verified: { label: "Estudante Verificado", icon: BadgeCheck },
  professor: { label: "Professor", icon: GraduationCap },
  university_official: { label: "Universidade Oficial", icon: Building2 },
  company: { label: "Empresa", icon: Briefcase },
  library: { label: "Biblioteca", icon: FileText },
  ru: { label: "Restaurante Universitário", icon: HomeIcon },
  project: { label: "Projeto/Centro Acadêmico", icon: FlaskConical },
  admin: { label: "Administrador EduFlow", icon: Award },
};

// Categorias de publicação expandidas (Capítulo 6, seção 4)
const POST_CATEGORY_ICONS: Record<string, any> = {
  "Resumo": FileText,
  "Dúvida": HelpCircle,
  "Flashcards": Brain,
  "Artigo": FileText,
  "Pesquisa": FlaskConical,
  "Projeto": GraduationCap,
  "Evento": Pin,
  "Aviso": BadgeCheck,
  "Estágio": Briefcase,
  "República": HomeIcon,
  "Desabafo": MessageSquare,
  "Networking": Users,
};

interface Post {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  media_url: string | null; // Legado
  media_urls: string[] | null; // Múltiplas fotos
  price: number | null;
  original_price: number | null;
  is_sold: boolean;
  document_url: string | null;
  video_url: string | null;
  tag: string | null;
  category?: string | null;
  event_at?: string | null;
  event_location?: string | null;
  created_at: string;
  profiles?: any;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  user_saved: boolean;
  author_badge?: string | null;
}

// Perfil resumido do usuário logado, usado para filtrar as abas
// Universidade / Curso (Capítulo 6, seção 3).
interface MyProfile {
  university_id: string | null;
  campus_id: string | null;
  course_id: string | null;
}

export default function Connect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { communities } = useCommunities();
  const [searchParams, setSearchParams] = useSearchParams();

  // "global" continua aceito na URL por compatibilidade com links antigos,
  // mas o novo padrão de abas é "foryou" (Capítulo 6, seção 3).
  const rawInitialTab = searchParams.get("tab") || "foryou";
  const initialTab = rawInitialTab === "global" ? "foryou" : rawInitialTab;
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Perfil do usuário logado (universidade/campus/curso), necessário para
  // filtrar as abas Universidade e Curso.
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  // Papéis do usuário logado — usado para liberar a categoria "Aviso"
  // (Capítulo 6, seção 4: restrita a selos institucionais).
  const [myRoles, setMyRoles] = useState<string[]>([]);
  // Campos extras quando a categoria selecionada é "Evento".
  const [eventAt, setEventAt] = useState<string>("");
  const [eventLocation, setEventLocation] = useState<string>("");

  // Market States
  const [marketView, setMarketView] = useState<"explore" | "my_ads">("explore");
  const [marketSearch, setMarketSearch] = useState<string>("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer Post
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newOriginalPrice, setNewOriginalPrice] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "document" | "poll">("text");
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

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
  const [newsComposerOpen, setNewsComposerOpen] = useState(false);
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [newsChannelId, setNewsChannelId] = useState<string>("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsLink, setNewsLink] = useState("");
  const [newsCoverFile, setNewsCoverFile] = useState<File | null>(null);
  const [newsCoverPreview, setNewsCoverPreview] = useState<string | null>(null);
  const [publishingNews, setPublishingNews] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("university_id,campus_id,course_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyProfile(data as MyProfile ?? { university_id: null, campus_id: null, course_id: null }));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setMyRoles((data ?? []).map((r: any) => r.role)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // As abas Universidade e Curso dependem do perfil carregado; aguarda.
    if ((activeTab === "university" || activeTab === "course") && myProfile === null) return;
    if (activeTab === "news") loadNews();
    else loadPosts();
  }, [user, activeTab, marketView, showSavedOnly, myProfile]);

  // A barra inferior navega para /connect, /connect?tab=market e /connect?tab=news
  // sem desmontar esta tela. Sem esta sincronização, a aba ficava "presa" na
  // anterior — era por isso que o Feed aparecia idêntico ao Mercado.
  useEffect(() => {
    const raw = searchParams.get("tab") || "foryou";
    const next = raw === "global" ? "foryou" : raw;
    if (next !== activeTab) {
      setActiveTab(next);
      setShowSavedOnly(false);
      setMarketSearch("");
      setMarketView("explore");
    }
  }, [searchParams]);

  function changeTab(v: string) {
    setActiveTab(v);
    setShowSavedOnly(false);
    setMarketSearch("");
    setMarketView("explore");
    setSearchParams(v === "foryou" ? {} : { tab: v }, { replace: true });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limite de tamanho e quantidade
    if (files.length > 5) {
      toast({ title: "Máximo de 5 fotos permitidas", variant: "destructive" });
      return;
    }
    const oversized = files.find(f => f.size > 20 * 1024 * 1024);
    if (oversized) {
      toast({ title: "Cada arquivo deve ter no máximo 20MB", variant: "destructive" });
      return;
    }

    if (activeTab === "market" && mediaType === "image") {
      setSelectedFiles(prev => [...prev, ...files].slice(0, 5));
      const newPreviews = files.map(f => URL.createObjectURL(f));
      setPreviewUrls(prev => [...prev, ...newPreviews].slice(0, 5));
    } else {
      setSelectedFiles([files[0]]);
      setPreviewUrls([files[0].type.startsWith("image/") || files[0].type.startsWith("video/") ? URL.createObjectURL(files[0]) : "pdf-preview"]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
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

      // Capítulo 6, seção 3 — cada aba tem sua própria fonte/ordenação.
      if (activeTab === "trending") {
        // Aba "Em Alta": usa a view trending_posts (engagement_score desc).
        const { data, error } = await supabase
          .from("trending_posts")
          .select("*")
          .order("engagement_score", { ascending: false })
          .limit(60);
        if (error) throw error;
        const ids = (data ?? []).map((p: any) => p.id).filter(Boolean);
        if (ids.length === 0) { setPosts([]); return; }
        const { data: fullPosts } = await supabase.from("posts").select("*").in("id", ids);
        // Preserva a ordem de engajamento retornada por trending_posts.
        const order = new Map(ids.map((id: string, i: number) => [id, i]));
        const ordered = (fullPosts ?? []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setPosts(await fetchMetricsForPosts(ordered));
        return;
      }

      if (activeTab === "university" || activeTab === "course") {
        // Abas "Universidade" e "Curso": filtra pelos autores que compartilham
        // university_id / course_id com o usuário logado.
        const field = activeTab === "university" ? "university_id" : "course_id";
        const myValue = myProfile?.[field as keyof MyProfile];
        if (!myValue) { setPosts([]); return; }
        const { data: peers } = await supabase.from("profiles").select("user_id").eq(field, myValue);
        const peerIds = (peers ?? []).map((p: any) => p.user_id);
        if (peerIds.length === 0) { setPosts([]); return; }
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .in("user_id", peerIds)
          .not("tag", "in", `(${MARKETPLACE_TAGS.join(',')})`)
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) throw error;
        if (data) setPosts(await fetchMetricsForPosts(data));
        return;
      }

      if (activeTab === "communities") {
        // Aba "Comunidades": só posts de comunidades das quais o usuário participa.
        const { data: memberships } = await supabase.from("community_members").select("community_id").eq("user_id", user!.id);
        const communityIds = (memberships ?? []).map((m: any) => m.community_id);
        if (communityIds.length === 0) { setPosts([]); return; }
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) throw error;
        if (data) setPosts(await fetchMetricsForPosts(data));
        return;
      }

      // Abas "Para Você" (foryou) e "Marketplace" (market) seguem daqui.
      let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(60);

      if (activeTab === "market") {
        query = query.in("tag", MARKETPLACE_TAGS);
        if (marketView === "my_ads") {
          query = query.eq("user_id", user!.id);
        }
      } else {
        // "foryou": exclui marketplace do feed acadêmico (Capítulo 6, regra de isolamento).
        // TODO (roadmap item 1, próxima iteração): aplicar o score de prioridade
        // completo da seção 6 (universidade > curso > comunidades > eventos > ...)
        // via view materializada dedicada, em vez de só cronológico.
        query = query.not("tag", "in", `(${MARKETPLACE_TAGS.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setPosts(await fetchMetricsForPosts(data));
    } catch (e) {
      toast({ title: "Erro ao atualizar o feed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetricsForPosts(postsData: any[]) {
    if (!postsData || postsData.length === 0 || !user) return [];
    const postIds = postsData.map(p => p.id);
    const userIds = Array.from(new Set(postsData.map(p => p.user_id)));

    const [likes, comments, saved, profs, roles] = await Promise.all([
      supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      supabase.from("profiles").select("user_id,full_name,avatar_url").in("user_id", userIds),
      // Capítulo 6, seção 5 — selos de verificação por autor.
      supabase.from("user_roles").select("user_id,role").in("user_id", userIds)
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

    // Um usuário pode ter mais de um papel; prioriza o mais "institucional"
    // para exibir um único selo no card do post.
    const badgePriority = ["university_official", "admin", "company", "library", "ru", "professor", "project", "student_verified"];
    const badgeMap: Record<string, string> = {};
    (roles.data ?? []).forEach((r: any) => {
      const current = badgeMap[r.user_id];
      if (!current || badgePriority.indexOf(r.role) < badgePriority.indexOf(current)) {
        if (ROLE_BADGES[r.role]) badgeMap[r.user_id] = r.role;
      }
    });

    return postsData.map(p => ({
      ...p,
      profiles: profileMap[p.user_id] ?? null,
      likes_count: likesMap[p.id]?.count || 0,
      comments_count: commentsMap[p.id] || 0,
      user_liked: likesMap[p.id]?.userLiked || false,
      user_saved: savedSet.has(p.id),
      author_badge: badgeMap[p.user_id] ?? null
    }));
  }

  async function handlePost() {
    if ((!newContent.trim() && selectedFiles.length === 0) || !user) return;
    setPosting(true);
    try {
      let uploadedUrls: string[] = [];
      let documentUrl: string | null = null;
      let videoUrl: string | null = null;

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const bucket = mediaType === "document" ? "post-documents" : "post-media";
          
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
          if (uploadError) throw uploadError;

          if (bucket === "post-documents") {
            const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 365);
            documentUrl = signed?.signedUrl ?? null;
          } else {
            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            if (mediaType === "video") videoUrl = data.publicUrl;
            else uploadedUrls.push(data.publicUrl);
          }
        }
      }

      const pPrice = newPrice ? parseFloat(newPrice.replace(",", ".")) : null;
      const pOriginal = newOriginalPrice ? parseFloat(newOriginalPrice.replace(",", ".")) : null;
      const isEvent = activeTab !== "market" && selectedTag === "Evento";

      const { error } = await supabase.from("posts").insert({
        user_id: user.id, 
        title: activeTab === "market" ? newTitle.trim() : null,
        content: newContent.trim(), 
        media_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        media_url: uploadedUrls.length === 1 ? uploadedUrls[0] : null, // Fallback legado
        price: activeTab === "market" ? pPrice : null,
        original_price: activeTab === "market" ? pOriginal : null,
        is_sold: false,
        tag: selectedTag, 
        category: activeTab !== "market" ? selectedTag : null,
        event_at: isEvent && eventAt ? new Date(eventAt).toISOString() : null,
        event_location: isEvent ? (eventLocation.trim() || null) : null,
        media_type: mediaType, 
        document_url: documentUrl, 
        video_url: videoUrl,
      });
      if (error) throw error;

      setNewContent(""); setNewTitle(""); setNewPrice(""); setNewOriginalPrice(""); 
      setSelectedFiles([]); setPreviewUrls([]); setSelectedTag(null); setMediaType("text"); setComposerOpen(false);
      setEventAt(""); setEventLocation("");
      toast({ title: activeTab === "market" ? "Anúncio publicado na loja!" : "Publicação no ar!" });
      loadPosts();
    } catch (e: any) {
      toast({ title: "Falha na postagem", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

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
      toast({ title: "Edição publicada no Painel!" });
      setNewsComposerOpen(false); setNewsTitle(""); setNewsContent(""); setNewsLink(""); setNewsCoverFile(null); setNewsCoverPreview(null);
      loadNews();
    } catch (e: any) {
      toast({ title: "Acesso Negado", description: "Apenas editores autorizados podem publicar neste canal.", variant: "destructive" });
    } finally { setPublishingNews(false); }
  }

  async function handleLike(post: Post) {
    if (!user) return;
    try {
      if (post.user_liked) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      else await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !p.user_liked, likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    } catch (e) {}
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
    if (!window.confirm("Confirmar exclusão definitiva?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast({ title: "Publicação/Anúncio removido." });
    } catch (e: any) { toast({ title: "Erro na exclusão", variant: "destructive" }); }
  }

  async function handleMarkAsSold(post: Post) {
    if (!user || post.user_id !== user.id) return;
    try {
      const { error } = await supabase.from("posts").update({ is_sold: !post.is_sold }).eq("id", post.id);
      if (error) throw error;
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_sold: !p.is_sold } : p));
      toast({ title: !post.is_sold ? "Marcado como Vendido! 🎉" : "Anúncio reativado." });
    } catch (e: any) { toast({ title: "Erro ao atualizar status", variant: "destructive" }); }
  }

  // Capítulo 6, seção 8 — ação rápida "Adicionar ao meu calendário" em posts de Evento.
  async function handleAddToCalendar(post: Post) {
    if (!user || !post.event_at) return;
    try {
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        title: post.title?.trim() || post.content.slice(0, 80),
        due_date: post.event_at,
        type: "evento",
      });
      if (error) throw error;
      toast({ title: "Adicionado aos seus lembretes!" });
    } catch (e: any) {
      toast({ title: "Erro ao adicionar ao calendário", variant: "destructive" });
    }
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
      openComments(activePost);
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (e: any) { toast({ title: "Erro ao comentar", variant: "destructive" }); } finally { setSendingComment(false); }
  }

  const visiblePosts = useMemo(() => {
    let filtered = posts;
    if (activeTab === "market" && marketSearch.trim() !== "") {
      const q = marketSearch.toLowerCase();
      filtered = filtered.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) || 
        p.content.toLowerCase().includes(q) || 
        (p.tag && p.tag.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [posts, activeTab, marketSearch]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-28 animate-in fade-in duration-500">
      
      {/* HEADER COMPACTO E AÇÃO RÁPIDA — muda conforme a seção aberta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(() => {
            const info = SECTION_INFO[activeTab] ?? SECTION_INFO.feed;
            const SectionIcon = info.icon;
            return (
              <>
                <div className="h-11 w-11 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
                  <SectionIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-foreground">{info.title}</h1>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{info.subtitle}</p>
                </div>
              </>
            );
          })()}
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab !== "news" && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={cn("h-11 w-11 rounded-full border-border/40 transition-all shadow-sm", showSavedOnly ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : "bg-card hover:bg-muted")}
              title="Meus Salvos"
            >
              <Bookmark className={cn("h-5 w-5", showSavedOnly && "fill-current")} />
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
            className="rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-black px-5 h-11 bg-primary text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" /> 
            {activeTab === "market" ? "Vender Algo" : activeTab === "news" ? "Escrever" : "Criar Post"}
          </Button>
        </div>
      </div>

      {/* Filtros do Feed. No Mercado e nas Notícias eles somem: aquelas seções
          já têm seu próprio botão na barra inferior e seus próprios controles. */}
      {activeTab !== "market" && activeTab !== "news" && (
        <Tabs value={activeTab} onValueChange={changeTab}>
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="rounded-[24px] bg-muted/40 p-1.5 inline-flex shadow-inner gap-1">
              {FEED_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-[20px] font-bold text-sm h-11 gap-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all"
                >
                  <Icon className="h-4 w-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </Tabs>
      )}

      {/* SUB-MENU DO MERCADO (Painel do Vendedor vs Explorar) */}
      {activeTab === "market" && !showSavedOnly && (
        <div className="flex flex-col space-y-4 animate-in slide-in-from-top-2">
          <div className="flex bg-muted/30 p-1 rounded-2xl w-fit mx-auto border border-border/40">
            <button onClick={() => setMarketView("explore")} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", marketView === "explore" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Explorar Loja</button>
            <button onClick={() => setMarketView("my_ads")} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", marketView === "my_ads" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>Meus Anúncios</button>
          </div>
          
          {marketView === "explore" && (
            <div className="relative group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)} placeholder="Busque por livros, cadernos, serviços, estagios..." className="pl-12 h-14 rounded-[20px] bg-card border border-border/40 shadow-sm focus-visible:ring-primary text-base font-medium" />
            </div>
          )}
        </div>
      )}

      {/* MODAL DE COMPOSIÇÃO DE POST (Adaptação Inteligente) */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="rounded-[32px] p-6 sm:max-w-xl border border-white/10 bg-background/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black">{activeTab === "market" ? "Anunciar na Loja" : "Nova Publicação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            
            {/* CAMPOS ESPECÍFICOS DO MARKETPLACE */}
            {activeTab === "market" && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">O que você está vendendo ou anunciando?</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Livro de Anatomia Humana (Seminovo)" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-black text-lg" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Preço (R$)</Label>
                    <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="150,00" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-bold text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Preço Original <span className="text-[10px] opacity-70">(Opcional)</span></Label>
                    <Input type="number" value={newOriginalPrice} onChange={(e) => setNewOriginalPrice(e.target.value)} placeholder="200,00" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-bold text-base text-muted-foreground line-through decoration-red-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Categoria do Anúncio</Label>
                  <select value={selectedTag || ""} onChange={(e) => setSelectedTag(e.target.value)} className="w-full rounded-2xl bg-muted/40 border-0 h-14 px-4 text-base font-bold focus:ring-2 focus:ring-primary outline-none">
                    <option value="" disabled>Selecione uma categoria...</option>
                    {MARKETPLACE_TAGS.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>
            )}

            {/* CAMPOS GERAIS DO CONNECT — em qualquer aba acadêmica (Para Você, Em Alta,
                Universidade, Curso, Comunidades), nunca no Marketplace/Notícias */}
            {activeTab !== "market" && activeTab !== "news" && (
              <div className="flex gap-2 flex-wrap">
                {ACADEMIC_TAGS
                  .filter((t) => !RESTRICTED_TAGS.includes(t) || myRoles.some((r) => ["professor", "university_official", "admin"].includes(r)))
                  .map((t) => {
                    const TagIcon = POST_CATEGORY_ICONS[t];
                    return (
                      <button key={t} type="button" onClick={() => setSelectedTag(selectedTag === t ? null : t)} className={cn("text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all border flex items-center gap-1.5", selectedTag === t ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border/40 hover:bg-muted")}>
                        {selectedTag === t ? <Check className="h-3 w-3" /> : TagIcon && <TagIcon className="h-3 w-3" />} {t}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Campos extras da categoria Evento (Capítulo 6, seção 4 e 8 — data usada
                pela IA para "adicionar ao meu calendário") */}
            {selectedTag === "Evento" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Data e hora</Label>
                  <Input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="h-12 rounded-2xl bg-card border border-border/40 text-sm shadow-inner" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Local</Label>
                  <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Ex: Auditório do CTEC" className="h-12 rounded-2xl bg-card border border-border/40 text-sm shadow-inner" />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">{activeTab === "market" ? "Descrição detalhada" : "Sua mensagem"}</Label>
              <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={activeTab === "market" ? "Descreva os detalhes, estado de conservação, onde entregar..." : "Compartilhe suas ideias, resumos ou dúvidas..."} rows={activeTab === "market" ? 3 : 5} className="rounded-2xl resize-none border border-border/40 bg-card focus-visible:ring-primary text-base p-4 shadow-inner" />
            </div>

            {/* PRÉ-VISUALIZAÇÃO DE MÚLTIPLAS FOTOS */}
            {previewUrls.length > 0 && previewUrls[0] !== "pdf-preview" && (
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative shrink-0 snap-center animate-in zoom-in-95">
                    {mediaType === "video" ? (
                      <video src={url} className="rounded-2xl h-32 w-32 object-cover shadow-sm border border-border/30" />
                    ) : (
                      <img src={url} className="rounded-2xl h-32 w-32 object-cover shadow-sm border border-border/30" />
                    )}
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg border-2 border-background" onClick={() => removeFile(i)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            
            {previewUrls[0] === "pdf-preview" && selectedFiles[0] && (
              <div className="flex items-center justify-between bg-card rounded-2xl p-3 border border-border/40 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0"><FileText className="h-5 w-5" /></div>
                  <span className="text-sm font-bold truncate">{selectedFiles[0].name}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFile(0)}><X className="h-4 w-4" /></Button>
              </div>
            )}

            {/* BOTÕES DE AÇÃO DO MODAL */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-2">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer group">
                  <input type="file" multiple={activeTab === "market"} accept="image/*,video/*" className="hidden" onChange={(e) => { setMediaType(e.target.files?.[0]?.type.startsWith('video') ? "video" : "image"); handleFileSelect(e); }} />
                  <div className="h-12 w-12 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"><ImageIcon className="h-5 w-5" /></div>
                </label>
                {activeTab !== "market" && (
                  <label className="cursor-pointer group">
                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { setMediaType("document"); handleFileSelect(e); }} />
                    <div className="h-12 w-12 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"><FileText className="h-5 w-5" /></div>
                  </label>
                )}
                {activeTab === "market" && <span className="text-[10px] font-bold text-muted-foreground ml-2">Máx 5 fotos</span>}
              </div>
              <Button onClick={handlePost} disabled={posting || (!newContent.trim() && selectedFiles.length === 0)} className="rounded-full font-black h-12 px-8 text-sm shadow-md">
                {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : activeTab === "market" ? "Publicar Anúncio" : "Postar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDITOR DE NOTÍCIAS RESTANTE MANTIDO IDÊNTICO AO ANTERIOR... */}
      <Dialog open={newsComposerOpen} onOpenChange={setNewsComposerOpen}>
        <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden border-0 shadow-2xl bg-background">
          <div className="p-6 border-b border-border/40 bg-muted/20">
            <h2 className="font-black text-2xl flex items-center gap-2"><Newspaper className="h-6 w-6 text-primary"/> Redação Oficial</h2>
            <p className="text-sm text-muted-foreground font-semibold mt-1">Publique comunicados para o campus digital.</p>
          </div>
          <ScrollArea className="max-h-[65vh] p-6 space-y-6">
            {myChannels.length === 0 ? (
              <div className="text-center p-8 bg-card rounded-3xl border-2 border-dashed border-border/50">
                <p className="text-base font-bold text-muted-foreground">Você não tem permissão de editor em canais oficiais.</p>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Canal de Publicação</Label>
                  <select value={newsChannelId} onChange={(e) => setNewsChannelId(e.target.value)} className="w-full rounded-2xl bg-card border border-border/50 h-14 px-4 text-base font-bold shadow-sm outline-none focus:border-primary">
                    {myChannels.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Capa da Notícia</Label>
                  {newsCoverPreview ? (
                    <div className="relative rounded-3xl overflow-hidden shadow-sm group border border-border/30">
                      <img src={newsCoverPreview} className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <Button size="sm" variant="destructive" className="rounded-full font-bold h-10 px-4" onClick={() => {setNewsCoverFile(null); setNewsCoverPreview(null);}}><Trash2 className="h-4 w-4 mr-2"/>Remover Capa</Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer bg-card hover:bg-muted/50 transition-colors shadow-sm">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-3"><UploadCloud className="h-6 w-6 text-primary" /></div>
                        <p className="text-sm font-black text-foreground">Upload da imagem de capa</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleNewsCoverSelect} />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Manchete (Título)</Label>
                  <Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="Ex: Nova biblioteca inaugurada..." className="h-14 rounded-2xl bg-card border border-border/50 font-black text-lg shadow-sm focus-visible:ring-primary" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Corpo da Notícia</Label>
                  <Textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} placeholder="Escreva os detalhes da notícia..." rows={8} className="rounded-2xl bg-card border border-border/50 text-base p-5 resize-none shadow-sm focus-visible:ring-primary" />
                </div>
              </div>
            )}
          </ScrollArea>
          {myChannels.length > 0 && (
            <div className="p-5 border-t border-border/40 bg-background">
              <Button onClick={publishNews} disabled={publishingNews || !newsTitle.trim()} className="w-full h-14 rounded-2xl font-black text-lg shadow-lg">
                {publishingNews ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : "Publicar Edição no Portal"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RENDERIZAÇÃO DO FEED — cobre as 6 abas de posts (Para Você, Em Alta,
          Universidade, Curso, Comunidades, Marketplace). "news" tem seu próprio
          bloco abaixo, pois usa a tabela news_posts, não posts. */}
      {/* Atalho para a página dedicada de cada comunidade (9 abas internas) */}
      {activeTab === "communities" && communities.length > 0 && (
        <div className="mt-4 space-y-2">
          {communities.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/community/${c.id}`)}
              className="w-full text-left p-4 rounded-3xl bg-card border border-border/40 shadow-sm hover:bg-muted/60 transition-colors"
            >
              <p className="text-sm font-bold truncate">{c.name}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
                {c.type} · {c.member_count} integrantes
              </p>
            </button>
          ))}
        </div>
      )}

      {activeTab !== "news" && (
        loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : visiblePosts.length === 0 ? (
          <div className="p-12 text-center rounded-[32px] bg-card border border-border/30 shadow-sm animate-in fade-in mt-6">
            {activeTab === "market" ? <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" /> : <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />}
            <p className="text-xl font-black text-foreground">Nada por aqui.</p>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              {activeTab === "market" ? "Não há produtos ou serviços listados agora."
                : activeTab === "university" ? "Nenhuma publicação da sua universidade ainda."
                : activeTab === "course" ? "Nenhuma publicação do seu curso ainda."
                : activeTab === "communities" ? "Entre em uma comunidade para ver publicações aqui."
                : activeTab === "trending" ? "Ainda não há publicações em alta."
                : "Seja o primeiro a postar no campus."}
            </p>
          </div>
        ) : (
          <div className={cn("mt-4", activeTab === "market" ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-6")}>
            {visiblePosts.map((p) => (
              <PostCard 
                key={p.id} 
                post={p} 
                isOwner={p.user_id === user?.id} 
                navigate={navigate} 
                isMarketplace={activeTab === "market"} 
                onLike={() => handleLike(p)} 
                onSave={() => handleSave(p)} 
                onComment={() => openComments(p)} 
                onDelete={() => handleDelete(p)} 
                onMarkAsSold={() => handleMarkAsSold(p)}
                onAddToCalendar={() => handleAddToCalendar(p)}
              />
            ))}
          </div>
        )
      )}

      {/* RENDERIZAÇÃO DA ABA NOTÍCIAS (news_posts via news_channels) */}
      {activeTab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : newsItems.length === 0 ? (
          <div className="p-12 text-center rounded-[32px] bg-card border border-border/30 shadow-sm animate-in fade-in mt-6">
            <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-xl font-black text-foreground">Nenhuma notícia publicada ainda.</p>
            <p className="text-sm font-medium text-muted-foreground mt-2">Os canais oficiais (universidade, campus, cursos) aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-5 mt-4">
            {newsItems.map((n) => (
              <Card
                key={n.id}
                onClick={() => setActiveNews(n)}
                className="rounded-[32px] border border-border/20 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden cursor-pointer hover:shadow-lg transition-all"
              >
                {n.cover_url && <img src={n.cover_url} className="w-full h-44 object-cover" />}
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.pinned && (
                      <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-black gap-1"><Pin className="h-3 w-3" /> Fixado</Badge>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{n.news_channels?.name ?? "Painel Oficial"}</span>
                  </div>
                  <h3 className="font-black text-lg leading-snug text-foreground">{n.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{n.content}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{formatDistanceToNow(new Date(n.published_at), { locale: ptBR, addSuffix: true })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* MODAL DE LEITURA DE NOTÍCIA */}
      <Dialog open={!!activeNews} onOpenChange={(open) => !open && setActiveNews(null)}>
        <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden border-0 shadow-2xl bg-background max-h-[85vh] flex flex-col">
          {activeNews && (
            <>
              {activeNews.cover_url && <img src={activeNews.cover_url} className="w-full h-52 object-cover shrink-0" />}
              <ScrollArea className="p-6 overflow-y-auto">
                <DialogHeader className="text-left space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">{activeNews.news_channels?.name ?? "Painel Oficial"}</span>
                  <DialogTitle className="text-2xl font-black leading-tight">{activeNews.title}</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {formatDistanceToNow(new Date(activeNews.published_at), { locale: ptBR, addSuffix: true })}
                  </DialogDescription>
                </DialogHeader>
                <p className="text-base text-foreground/90 whitespace-pre-wrap leading-relaxed mt-4">{activeNews.content}</p>
                {activeNews.link_url && (
                  <a href={activeNews.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-4 text-sm font-black text-primary hover:underline">
                    Saiba mais <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE COMENTÁRIOS — antes existia só o estado (commentModalOpen/postComments),
          sem nenhuma Dialog renderizando; usuários não conseguiam ver nem escrever comentários. */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden border-0 shadow-2xl bg-background max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-xl font-black">Comentários</DialogTitle>
            {activePost && <DialogDescription className="text-sm line-clamp-2">{activePost.content}</DialogDescription>}
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            {postComments.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Seja o primeiro a comentar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {postComments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-9 w-9 shrink-0 border border-border/30">
                      <AvatarImage src={c.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">{c.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/40 rounded-2xl rounded-tl-sm px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-foreground">{c.profiles?.full_name || "Estudante"}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-border/40 bg-background flex items-center gap-2 shrink-0">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !sendingComment) sendComment(); }}
              placeholder="Escreva um comentário..."
              className="h-12 rounded-full bg-muted/40 border-0 px-5 text-sm focus-visible:ring-primary"
            />
            <Button
              size="icon"
              onClick={sendComment}
              disabled={sendingComment || !newComment.trim()}
              className="h-12 w-12 rounded-full shrink-0 shadow-md"
            >
              {sendingComment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// O NOVO POST CARD COM O SUPER APP DO MERCADO (Painel, Preços, Carrossel)
function PostCard({ post, onLike, onSave, onComment, isOwner, onDelete, navigate, isMarketplace, onMarkAsSold, onAddToCalendar }: any) {
  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i) || post.document_url;
  
  // Tratamento para nova estrutura de array ou legado
  const mediaList = post.media_urls && post.media_urls.length > 0 ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const mediaSource = post.document_url || post.video_url || mediaList[0];

  return (
    <Card className={cn("rounded-[32px] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all relative", post.is_sold ? "border-border/40 opacity-80 bg-muted/20" : "border-border/20 bg-card hover:shadow-lg")}>
      
      {/* Tarja de Vendido (Mercado) */}
      {isMarketplace && post.is_sold && (
        <div className="absolute top-6 -right-10 bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest py-1.5 px-12 rotate-45 z-10 shadow-lg">
          Vendido
        </div>
      )}

      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
        <div className="flex gap-3 items-center group cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
          <Avatar className="h-11 w-11 shadow-sm border border-border/30 group-hover:scale-105 transition-transform">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">{post.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="font-black text-[15px] text-foreground leading-tight group-hover:text-primary transition-colors flex items-center gap-1">
              {post.profiles?.full_name || "Estudante"}
              {post.author_badge && ROLE_BADGES[post.author_badge] && (() => {
                const BadgeIcon = ROLE_BADGES[post.author_badge].icon;
                return (
                  <span title={ROLE_BADGES[post.author_badge].label}>
                    <BadgeIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  </span>
                );
              })()}
              {isMarketplace && isOwner && <Badge variant="secondary" className="ml-2 text-[8px] bg-primary/10 text-primary border-0">Seu Anúncio</Badge>}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: true })}</p>
          </div>
        </div>

        {/* Gerenciamento do Vendedor ou Autor */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/80"><MoreHorizontal className="h-5 w-5"/></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border border-border/20 shadow-xl bg-background/95 backdrop-blur-xl p-2 min-w-[200px]">
            {isOwner && isMarketplace && (
              <DropdownMenuItem onClick={onMarkAsSold} className="font-bold rounded-xl py-3 focus:bg-primary/10 focus:text-primary cursor-pointer mb-1">
                <CheckCircle2 className="h-4 w-4 mr-2"/> {post.is_sold ? "Reativar Anúncio" : "Marcar como Vendido"}
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold rounded-xl focus:bg-destructive/10 py-3 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2"/> {isMarketplace ? "Excluir Anúncio" : "Apagar Publicação"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)} className="font-bold rounded-xl py-3 cursor-pointer">
              <Share2 className="h-4 w-4 mr-2"/> Copiar Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-5 pt-1">
        {/* Renderização Premium do Marketplace */}
        {isMarketplace ? (
          <div className="mb-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                {post.title && <h3 className="font-black text-2xl text-foreground leading-tight line-clamp-2">{post.title}</h3>}
                {post.tag && <Badge variant="secondary" className="mt-2 rounded-lg text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-muted/80 text-muted-foreground">{post.tag}</Badge>}
              </div>
              {post.price !== null && (
                <div className="flex flex-col items-end shrink-0 text-right bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                  {post.original_price && (
                    <span className="text-[11px] font-bold text-muted-foreground line-through decoration-destructive mb-0.5">
                      R$ {post.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <span className="font-black text-xl text-emerald-600 leading-none">
                    R$ {post.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          post.tag && (() => {
            const CatIcon = POST_CATEGORY_ICONS[post.tag];
            return (
              <Badge variant="secondary" className="mb-3 rounded-lg text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-primary/10 text-primary border-0 gap-1">
                {CatIcon && <CatIcon className="h-3 w-3" />} {post.tag}
              </Badge>
            );
          })()
        )}
        
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{post.content}</p>

        {/* Capítulo 6, seção 8 — post do tipo Evento mostra data/local e ação de calendário */}
        {post.tag === "Evento" && post.event_at && (
          <div className="mt-3 flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
            <div className="text-xs font-bold text-foreground">
              <p>{new Date(post.event_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              {post.event_location && <p className="text-muted-foreground font-semibold mt-0.5">{post.event_location}</p>}
            </div>
            <Button size="sm" variant="secondary" className="rounded-full text-[11px] font-black h-9 shrink-0" onClick={onAddToCalendar}>
              Adicionar ao calendário
            </Button>
          </div>
        )}
        
        {/* Renderização de Múltiplas Imagens (Carrossel Horizontal) */}
        {mediaList.length > 0 && !isPdf && !isVideo && (
          <div className="mt-5 flex overflow-x-auto snap-x snap-mandatory rounded-[24px] gap-2 pb-2 scrollbar-none">
            {mediaList.map((url: string, idx: number) => (
              <div key={idx} className="shrink-0 w-full snap-center relative border border-border/10 rounded-[24px] overflow-hidden bg-muted/10">
                <img src={url} className={cn("w-full object-cover", isMarketplace ? "aspect-square" : "max-h-[400px]")} />
                {mediaList.length > 1 && (
                  <Badge variant="secondary" className="absolute top-3 right-3 bg-black/50 text-white border-0 backdrop-blur-md">
                    {idx + 1}/{mediaList.length}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fallback para Documentos e Vídeos antigos */}
        {(isPdf || isVideo) && mediaSource && (
          <div className="mt-4 rounded-[24px] overflow-hidden border border-border/20 shadow-sm bg-muted/10">
            {isPdf ? (
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><FileText className="h-6 w-6" /></div>
                  <div><span className="text-sm font-black text-foreground block">Documento Anexo</span><span className="text-xs font-semibold text-muted-foreground">Toque para baixar</span></div>
                </div>
                <Button size="sm" className="h-10 rounded-xl font-bold px-4 shadow-sm" onClick={() => window.open(mediaSource)}><Download className="h-4 w-4 mr-1.5"/>Baixar</Button>
              </div>
            ) : (
              <video src={mediaSource} controls className="w-full max-h-[400px] object-cover bg-black" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className={cn("p-4 flex flex-col gap-3 bg-muted/10 border-t border-border/20", isMarketplace ? "pt-5" : "pt-3")}>
        
        {/* Botão de Compra Real */}
        {isMarketplace && !isOwner && !post.is_sold && (
          <Button onClick={() => navigate(`/messages?user=${post.user_id}`)} className="w-full h-14 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black text-base shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 mr-2" /> Tenho Interesse
          </Button>
        )}
        {isMarketplace && post.is_sold && (
          <Button disabled className="w-full h-14 rounded-2xl bg-muted text-muted-foreground font-black text-base opacity-70">
            Produto Indisponível
          </Button>
        )}

        <div className="flex justify-between items-center w-full">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onLike} className={cn("h-11 rounded-2xl px-4 text-xs font-black transition-all border border-transparent", post.user_liked ? "text-red-500 hover:text-red-600 bg-red-500/10 border-red-500/20" : "text-muted-foreground hover:bg-muted/80")}>
              <Heart className={cn("h-4 w-4 mr-1.5", post.user_liked && "fill-current")} /> {post.likes_count > 0 ? post.likes_count : "Curtir"}
            </Button>
            <Button variant="ghost" onClick={onComment} className="h-11 rounded-2xl px-4 text-xs font-black text-muted-foreground hover:bg-muted/80 transition-all">
              <MessageSquare className="h-4 w-4 mr-1.5"/> {post.comments_count > 0 ? post.comments_count : "Comentar"}
            </Button>
          </div>
          <div className="flex gap-1">
            {/* IA contextual (Capítulo 6, seção 8) — não aparece no Marketplace, que não tem conteúdo a explicar/resumir */}
            {!isMarketplace && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-primary hover:bg-primary/10" title="Perguntar à IA sobre este post">
                    <Sparkles className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl border border-border/20 shadow-xl bg-background/95 backdrop-blur-xl p-2 min-w-[220px]">
                  <DropdownMenuItem className="rounded-xl font-bold text-sm gap-2 py-2.5" onClick={() => navigate("/assistant", { state: { initialPrompt: `Explique este conteúdo de forma clara e didática:\n\n"${post.content}"` } })}>
                    <Sparkles className="h-4 w-4 text-primary" /> Explicar este conteúdo
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl font-bold text-sm gap-2 py-2.5" onClick={() => navigate("/assistant", { state: { initialPrompt: `Gere flashcards (pergunta e resposta) a partir deste conteúdo:\n\n"${post.content}"` } })}>
                    <Brain className="h-4 w-4 text-primary" /> Gerar flashcards
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl font-bold text-sm gap-2 py-2.5" onClick={() => navigate("/assistant", { state: { initialPrompt: `Resuma em 5 tópicos objetivos:\n\n"${post.content}"` } })}>
                    <FileText className="h-4 w-4 text-primary" /> Resumir em 5 tópicos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="icon" onClick={onSave} className={cn("h-11 w-11 rounded-2xl transition-all border border-transparent", post.user_saved ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-muted-foreground hover:bg-muted/80")}>
              <Bookmark className={cn("h-5 w-5", post.user_saved && "fill-current")} />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
      }
