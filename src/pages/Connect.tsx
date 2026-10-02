import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Sparkles, Building2, GraduationCap, Users, BadgeCheck, HelpCircle, Brain,
  FlaskConical, Award, Briefcase, Home as HomeIcon, Volume2, VolumeX, Play,
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

// Identidade de cada seção do Connect (título, ícone e legenda do cabeçalho).
const SECTION_INFO: Record<string, { title: string; subtitle: string; icon: any }> = {
  market: { title: "Mercado", subtitle: "Compre e venda no campus", icon: Store },
  news: { title: "Notícias", subtitle: "Jornal universitário", icon: Newspaper },
  feed: { title: "Feed", subtitle: "Campus Digital", icon: Globe },
};

// Links antigos podem chegar com "global", "foryou", "trending", "university",
// "course" ou "communities" — todos viram "feed", já que essas abas se fundiram
// no algoritmo único (ver rankFeedPosts).
const LEGACY_FEED_TABS = new Set(["global", "foryou", "trending", "university", "course", "communities"]);

/**
 * O algoritmo do feed único. Substitui as 4 abas antigas por UMA ordem só,
 * combinando três sinais — igual ao que Instagram/TikTok fazem, simplificado
 * para o tamanho do EduConect:
 *  - Recência: post de hoje pesa mais que post de 5 dias atrás, mas com queda
 *    suave (meia-vida de ~28h) em vez de um corte seco — nada "desaparece" de repente.
 *  - Engajamento: curtidas + comentários (peso maior, comentário é sinal mais forte
 *    de interesse real que curtida), em escala logarítmica pra um post viral não
 *    dominar o feed pra sempre.
 *  - Afinidade: um empurrãozinho para posts de gente da mesma universidade, do
 *    mesmo curso (mais forte) ou de uma comunidade da qual o estudante participa —
 *    é o que as abas "Universidade"/"Curso"/"Comunidades" faziam, só que agora
 *    misturado ao invés de exigir trocar de aba.
 * Um pequeno "jitter" evita que o feed fique idêntico a cada refresh.
 */
function rankFeedPosts(list: any[], myProfile: MyProfile | null, myCommunityIds: Set<string>) {
  const now = Date.now();
  return [...list]
    .map((p) => {
      const ageHours = Math.max(0, (now - new Date(p.created_at).getTime()) / 36e5);
      const recency = Math.exp(-ageHours / 28);
      const engagementRaw = (p.likes_count ?? 0) * 1 + (p.comments_count ?? 0) * 2.5;
      const engagement = Math.min(Math.log1p(engagementRaw) / 4, 1);
      let affinity = 0;
      if (myProfile?.university_id && p.profiles?.university_id === myProfile.university_id) affinity += 0.12;
      if (myProfile?.course_id && p.profiles?.course_id === myProfile.course_id) affinity += 0.22;
      if (p.community_id && myCommunityIds.has(p.community_id)) affinity += 0.18;
      const jitter = Math.random() * 0.03;
      const score = recency * 0.42 + engagement * 0.4 + Math.min(affinity, 0.4) + jitter;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

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
  const [searchParams] = useSearchParams();

  const rawInitialTab = searchParams.get("tab") || "feed";
  const initialTab = LEGACY_FEED_TABS.has(rawInitialTab) ? "feed" : rawInitialTab;
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
    if (activeTab === "news") loadNews();
    else loadPosts();
    // myProfile some no dependency array de propósito: quando ele chega depois
    // (perfil ainda carregando), o feed já mostrado é reordenado com o afinidade
    // de universidade/curso, sem precisar de uma tela de espera.
  }, [user, activeTab, marketView, showSavedOnly, myProfile]);

  // A barra inferior navega para /connect, /connect?tab=market e /connect?tab=news
  // sem desmontar esta tela. Sem esta sincronização, a aba ficava "presa" na
  // anterior — era por isso que o Feed aparecia idêntico ao Mercado.
  useEffect(() => {
    const raw = searchParams.get("tab") || "feed";
    if (raw === "market") { navigate("/marketplace", { replace: true }); return; }
    const next = LEGACY_FEED_TABS.has(raw) ? "feed" : raw;
    if (next !== activeTab) {
      setActiveTab(next);
      setShowSavedOnly(false);
      setMarketSearch("");
      setMarketView("explore");
    }
  }, [searchParams]);

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

      if (activeTab === "market") {
        let query = supabase.from("posts").select("*").in("tag", MARKETPLACE_TAGS).order("created_at", { ascending: false }).limit(60);
        if (marketView === "my_ads") query = query.eq("user_id", user!.id);
        const { data, error } = await query;
        if (error) throw error;
        if (data) setPosts(await fetchMetricsForPosts(data));
        return;
      }

      // FEED ÚNICO — as antigas abas (Para Você/Em Alta/Universidade/Curso/Comunidades)
      // viraram sinais de UM algoritmo só, em vez de 4 listas separadas que o
      // estudante tinha que escolher manualmente. Busca um lote amplo e recente,
      // e quem decide a ordem final é rankFeedPosts (recência + engajamento + afinidade).
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .not("tag", "in", `(${MARKETPLACE_TAGS.join(',')})`)
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      const withMetrics = await fetchMetricsForPosts(data ?? []);
      const myCommunityIds = new Set(communities.map((c) => c.id));
      setPosts(rankFeedPosts(withMetrics, myProfile, myCommunityIds));
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
      supabase.from("profiles").select("user_id,full_name,avatar_url,university_id,course_id").in("user_id", userIds),
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

      {/* As pílulas de filtro (Para Você/Em Alta/Universidade/Curso) saíram —
          o feed agora é um único fluxo, ordenado por um algoritmo que já mistura
          esses sinais (ver rankFeedPosts). Uma aba a menos para o estudante decidir. */}

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

      {/* RENDERIZAÇÃO DO FEED — feed único (algoritmo) ou Mercado.
          "news" tem seu próprio bloco abaixo, pois usa a tabela news_posts, não posts. */}
      {activeTab !== "news" && (
        loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : visiblePosts.length === 0 ? (
          <div className="p-12 text-center rounded-[32px] bg-card border border-border/30 shadow-sm animate-in fade-in mt-6">
            {activeTab === "market" ? <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" /> : <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />}
            <p className="text-xl font-black text-foreground">Nada por aqui.</p>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              {showSavedOnly ? "Você ainda não salvou nenhuma publicação."
                : activeTab === "market" ? "Não há produtos ou serviços listados agora."
                : "Seja o primeiro a postar no campus."}
            </p>
          </div>
        ) : (
          <div className={cn("mt-4", activeTab === "market" ? "grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" : "space-y-6")}>
            {visiblePosts.map((p) => (
              activeTab === "market" ? (
                <MarketCard
                  key={p.id}
                  post={p}
                  isOwner={p.user_id === user?.id}
                  navigate={navigate}
                  onSave={() => handleSave(p)}
                  onDelete={() => handleDelete(p)}
                  onMarkAsSold={() => handleMarkAsSold(p)}
                />
              ) : (
                <PostCard
                  key={p.id}
                  post={p}
                  isOwner={p.user_id === user?.id}
                  navigate={navigate}
                  onLike={() => handleLike(p)}
                  onSave={() => handleSave(p)}
                  onComment={() => openComments(p)}
                  onDelete={() => handleDelete(p)}
                  onMarkAsSold={() => handleMarkAsSold(p)}
                  onAddToCalendar={() => handleAddToCalendar(p)}
                />
              )
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

// VITRINE DO MERCADO — card de produto em formato de loja: foto grande,
// preço em destaque, sem avatar/curtidas (aquilo é do Feed, não da vitrine).
function MarketCard({ post, isOwner, navigate, onSave, onDelete, onMarkAsSold }: any) {
  const mediaList = post.media_urls && post.media_urls.length > 0 ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const cover = mediaList[0];

  return (
    <Card className={cn(
      "group relative flex flex-col overflow-hidden rounded-[24px] border shadow-sm transition-all",
      post.is_sold ? "border-border/40 bg-muted/20 opacity-75" : "border-border/20 bg-card hover:shadow-lg",
    )}>
      {/* Foto — o produto é o protagonista */}
      <button
        type="button"
        onClick={() => navigate(`/profile/${post.user_id}`)}
        className="relative block aspect-square w-full overflow-hidden bg-muted/30"
      >
        {cover ? (
          <img src={cover} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
            <Store className="h-10 w-10" />
          </div>
        )}

        {post.is_sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-zinc-900 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
              Vendido
            </span>
          </div>
        )}

        {mediaList.length > 1 && !post.is_sold && (
          <Badge variant="secondary" className="absolute right-2 top-2 border-0 bg-black/50 text-[9px] text-white backdrop-blur-md">
            {mediaList.length} fotos
          </Badge>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className={cn(
            "absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all",
            post.user_saved ? "bg-amber-500 text-white" : "bg-black/40 text-white hover:bg-black/60",
          )}
        >
          <Bookmark className={cn("h-4 w-4", post.user_saved && "fill-current")} />
        </button>
      </button>

      {/* Preço + título */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-baseline gap-1.5">
          {post.price !== null && (
            <span className="text-base font-black leading-none text-emerald-600">
              R$ {post.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
          {post.original_price && (
            <span className="text-[10px] font-bold leading-none text-muted-foreground line-through decoration-destructive">
              R$ {post.original_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {post.title && <p className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground">{post.title}</p>}

        {post.tag && (
          <Badge variant="secondary" className="w-fit rounded-md border-0 bg-muted/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
            {post.tag}
          </Badge>
        )}

        {/* Vendedor — discreto, é a assinatura da loja, não o autor de um post */}
        <button
          type="button"
          onClick={() => navigate(`/profile/${post.user_id}`)}
          className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary"
        >
          <span className="truncate">{post.profiles?.full_name || "Estudante"}</span>
          {post.author_badge && ROLE_BADGES[post.author_badge] && (() => {
            const BadgeIcon = ROLE_BADGES[post.author_badge].icon;
            return <BadgeIcon className="h-3 w-3 shrink-0 text-primary" />;
          })()}
          {isOwner && <Badge variant="secondary" className="ml-auto shrink-0 border-0 bg-primary/10 px-1.5 py-0 text-[8px] text-primary">Seu</Badge>}
        </button>
      </div>

      {/* Ação — comprador negocia por chat, dono gerencia o anúncio */}
      <div className="border-t border-border/20 p-2">
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-full rounded-xl text-[11px] font-black text-muted-foreground hover:bg-muted/80">
                <MoreHorizontal className="mr-1.5 h-4 w-4" /> Gerenciar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px] rounded-2xl border border-border/20 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
              <DropdownMenuItem onClick={onMarkAsSold} className="mb-1 cursor-pointer rounded-xl py-2.5 font-bold focus:bg-primary/10 focus:text-primary">
                <CheckCircle2 className="mr-2 h-4 w-4" /> {post.is_sold ? "Reativar Anúncio" : "Marcar como Vendido"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="cursor-pointer rounded-xl py-2.5 font-bold text-destructive focus:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir Anúncio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : post.is_sold ? (
          <Button disabled className="h-9 w-full rounded-xl bg-muted text-[11px] font-black text-muted-foreground">
            Indisponível
          </Button>
        ) : (
          <Button
            onClick={() => navigate(`/messages?user=${post.user_id}`)}
            className="h-9 w-full rounded-xl bg-foreground text-[11px] font-black text-background hover:bg-foreground/90"
          >
            <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Tenho Interesse
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * Vídeo do feed, no estilo Instagram/TikTok: toca sozinho (mudo, por exigência
 * dos navegadores) assim que pelo menos 60% dele aparece na tela ao rolar, e
 * pausa quando sai de vista — sem precisar tocar em "play". Um toque no vídeo
 * liga/desliga o som; o ícone de alto-falante no canto mostra o estado atual.
 */
function AutoplayVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView) {
      // O navegador pode recusar o autoplay com som antes do primeiro toque do
      // usuário na página inteira — por isso o vídeo já nasce mudo (muted=true
      // no <video>) e falha silenciosamente se mesmo assim for bloqueado.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [inView]);

  return (
    <div className="relative rounded-[24px] overflow-hidden bg-black shadow-sm">
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={() => setMuted((m) => !m)}
        className="w-full max-h-[520px] object-cover bg-black cursor-pointer"
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white transition-transform active:scale-90"
        title={muted ? "Ativar som" : "Silenciar"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      {!inView && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
          <div className="h-14 w-14 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="h-6 w-6 text-white/90 fill-white/90 ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

// POST CARD DO FEED — usado no feed único e nas Notícias. O Mercado tem seu
// próprio card (MarketCard, acima).
function PostCard({ post, onLike, onSave, onComment, isOwner, onDelete, navigate, onAddToCalendar }: any) {
  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i) || post.document_url;
  
  // Tratamento para nova estrutura de array ou legado
  const mediaList = post.media_urls && post.media_urls.length > 0 ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const mediaSource = post.document_url || post.video_url || mediaList[0];

  return (
    <Card className="rounded-[28px] border border-border/10 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden transition-shadow duration-300 relative hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_16px_36px_rgba(0,0,0,0.05)]">

      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
        <div className="flex gap-3 items-center group cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
          <Avatar className="h-11 w-11 ring-1 ring-border/40 group-hover:scale-105 transition-transform">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">{post.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="font-bold text-[15px] text-foreground leading-tight group-hover:text-primary transition-colors flex items-center gap-1">
              {post.profiles?.full_name || "Estudante"}
              {post.author_badge && ROLE_BADGES[post.author_badge] && (() => {
                const BadgeIcon = ROLE_BADGES[post.author_badge].icon;
                return (
                  <span title={ROLE_BADGES[post.author_badge].label}>
                    <BadgeIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  </span>
                );
              })()}
            </p>
            <p className="text-[12.5px] font-medium text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: true })}</p>
          </div>
        </div>

        {/* Gerenciamento do Autor */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/80"><MoreHorizontal className="h-5 w-5"/></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border border-border/20 shadow-xl bg-background/95 backdrop-blur-xl p-2 min-w-[200px]">
            {isOwner && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive font-bold rounded-xl focus:bg-destructive/10 py-3 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2"/> Apagar Publicação
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)} className="font-bold rounded-xl py-3 cursor-pointer">
              <Share2 className="h-4 w-4 mr-2"/> Copiar Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-5 pt-1">
        {post.tag && (() => {
          const CatIcon = POST_CATEGORY_ICONS[post.tag];
          return (
            <Badge variant="secondary" className="mb-3 rounded-full text-[10.5px] font-bold tracking-wide px-3 py-1 bg-primary/[0.07] text-primary border-0 gap-1">
              {CatIcon && <CatIcon className="h-3 w-3" />} {post.tag}
            </Badge>
          );
        })()}
        
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
                <img src={url} className="w-full max-h-[400px] object-cover" />
                {mediaList.length > 1 && (
                  <Badge variant="secondary" className="absolute top-3 right-3 bg-black/50 text-white border-0 backdrop-blur-md">
                    {idx + 1}/{mediaList.length}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documento anexo */}
        {isPdf && mediaSource && (
          <div className="mt-4 rounded-[24px] overflow-hidden border border-border/20 shadow-sm bg-muted/10">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><FileText className="h-6 w-6" /></div>
                <div><span className="text-sm font-black text-foreground block">Documento Anexo</span><span className="text-xs font-semibold text-muted-foreground">Toque para baixar</span></div>
              </div>
              <Button size="sm" className="h-10 rounded-xl font-bold px-4 shadow-sm" onClick={() => window.open(mediaSource)}><Download className="h-4 w-4 mr-1.5"/>Baixar</Button>
            </div>
          </div>
        )}

        {/* Vídeo — toca sozinho ao rolar até ele, como no Instagram (ver AutoplayVideo) */}
        {isVideo && mediaSource && (
          <div className="mt-4">
            <AutoplayVideo src={mediaSource} />
          </div>
        )}
      </CardContent>

      <CardFooter className="px-5 py-3 flex flex-col gap-3 border-t border-border/10">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={onLike} className={cn("h-10 rounded-full px-3 text-[13px] font-bold transition-colors", post.user_liked ? "text-red-500 hover:text-red-600 hover:bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}>
              <Heart className={cn("h-[18px] w-[18px]", post.likes_count > 0 && "mr-1.5", post.user_liked && "fill-current")} /> {post.likes_count > 0 && post.likes_count}
            </Button>
            <Button variant="ghost" onClick={onComment} className="h-10 rounded-full px-3 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <MessageSquare className={cn("h-[18px] w-[18px]", post.comments_count > 0 && "mr-1.5")} /> {post.comments_count > 0 && post.comments_count}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-primary hover:bg-primary/10" title="Perguntar à IA sobre este post">
                  <Sparkles className="h-[18px] w-[18px]" />
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
            <Button variant="ghost" size="icon" onClick={onSave} className={cn("h-10 w-10 rounded-full transition-colors", post.user_saved ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}>
              <Bookmark className={cn("h-[18px] w-[18px]", post.user_saved && "fill-current")} />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
      }
