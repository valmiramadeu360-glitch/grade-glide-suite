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
  Music, Smile, Link as LinkIcon, CalendarDays, MapPin, BarChart3, Sparkles, Brain,
  UserPlus, Users, Eye, Flag, ImagePlus, Camera, Clock, ArrowUpRight, Edit3, Save,
  AlertCircle, Info, Megaphone, GraduationCap, BookOpen, BriefcaseBusiness, Trophy,
  MessageCircle, Paperclip, AtSign, Hash, SlidersHorizontal, Filter, RefreshCw,
  Building2, ShieldCheck
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type FeedMode = "for-you" | "trending" | "university" | "course";

type MediaType = "text" | "image" | "video" | "document" | "poll";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  course: string | null;
  course_id?: string | null;
  university_id?: string | null;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  title?: string | null;
  created_at: string;
  updated_at?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
  video_url?: string | null;
  document_url?: string | null;
  tag?: string | null;
  price?: number | null;
  original_price?: number | null;
  is_sold?: boolean;
  event_at?: string | null;
  event_location?: string | null;
  likes_count: number;
  comments_count: number;
  user_liked?: boolean;
  user_saved?: boolean;
  author_badge?: string | null;
  university_id?: string | null;
  profiles?: Profile | null;
}

interface Vibe {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  created_at: string;
  profiles?: Profile | null;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile | null;
}

const ACADEMIC_TAGS = [
  "Geral", "Dúvida", "Oportunidade", "Evento", "Acadêmico",
  "Estágio", "Pesquisa", "Extensão", "Monitoria", "Aviso",
];

const MARKET_TAGS = ["Venda", "Compra", "Serviço", "Troca", "Doação"];

const ROLE_BADGES: Record<string, { label: string; icon: any }> = {
  professor: { label: "Professor", icon: GraduationCap },
  university_official: { label: "Institucional", icon: Building2 },
  admin: { label: "Admin", icon: ShieldCheck },
  journalist: { label: "Jornalista", icon: Newspaper },
};

const POST_CATEGORY_ICONS: Record<string, any> = {
  Geral: Globe,
  Dúvida: MessageCircle,
  Oportunidade: BriefcaseBusiness,
  Evento: CalendarDays,
  Acadêmico: BookOpen,
  Estágio: BriefcaseBusiness,
  Pesquisa: Search,
  Extensão: Users,
  Monitoria: GraduationCap,
  Aviso: Megaphone,
  Venda: ShoppingBag,
  Compra: ShoppingBag,
  Serviço: BriefcaseBusiness,
  Troca: Tag,
  Doação: Heart,
};

export default function Connect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");

  const [posts, setPosts] = useState<Post[]>([]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingVibe, setViewingVibe] = useState<Vibe | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("text");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [eventAt, setEventAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [isVibe, setIsVibe] = useState(false);
  const [musicRef, setMusicRef] = useState("");
  const [editContent, setEditContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (showSavedOnly) {
      result = result.filter((post) => post.user_saved);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (post) =>
          post.content?.toLowerCase().includes(term) ||
          post.title?.toLowerCase().includes(term) ||
          post.tag?.toLowerCase().includes(term) ||
          post.profiles?.full_name?.toLowerCase().includes(term)
      );
    }

    if (feedMode === "trending") {
      result.sort(
        (a, b) => b.likes_count + b.comments_count - (a.likes_count + a.comments_count)
      );
    }

    if (feedMode === "university" && myProfile?.university_id) {
      result = result.filter(
        (post) => !post.university_id || post.university_id === myProfile.university_id
      );
    }

    if (feedMode === "course" && myProfile?.course_id) {
      result = result.filter(
        (post) => !post.profiles?.course_id || post.profiles.course_id === myProfile.course_id
      );
    }

    return result;
  }, [posts, showSavedOnly, searchTerm, feedMode, myProfile]);

  useEffect(() => {
    if (!user) return;
    loadProfile();
    loadPosts();
    loadVibes();
    loadRoles();
  }, [user]);

  useEffect(() => {
    const postId = searchParams.get("post");
    if (postId && posts.length > 0) {
      const post = posts.find((item) => item.id === postId);
      if (post) {
        setSelectedPost(post);
        setCommentsOpen(true);
      }
    }
  }, [searchParams, posts]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  async function fetchProfilesByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) return new Map<string, Profile>();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, course, course_id, university_id")
      .in("id", uniqueIds);

    if (error) {
      console.error("Erro ao carregar autores:", error);
      return new Map<string, Profile>();
    }

    return new Map<string, Profile>((data ?? []).map((profile) => [profile.id, profile]));
  }

  async function loadProfile() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, course, course_id, university_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setMyAvatar(data?.avatar_url ?? null);
      setMyProfile(data ?? null);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    }
  }

  async function loadRoles() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      setMyRoles(data?.map((item) => item.role) ?? []);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
    }
  }

  async function loadPosts() {
    if (!user) return;
    setLoading(true);
    let profilesById = new Map<string, Profile>();
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .or("tag.neq.Vibe,tag.is.null")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postList = data ?? [];
      const postIds = postList.map((post) => post.id);

      let likedIds = new Set<string>();
      let savedIds = new Set<string>();
      const likesByPost = new Map<string, number>();
      const commentsByPost = new Map<string, number>();

      if (postIds.length) {
        const [likesResult, savesResult, likesCountResult, commentsCountResult, profilesResult] =
          await Promise.all([
            supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
            supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
            supabase.from("post_likes").select("post_id").in("post_id", postIds),
            supabase.from("post_comments").select("post_id").in("post_id", postIds),
            fetchProfilesByIds(postList.map((post) => post.user_id)),
          ]);

        likedIds = new Set(likesResult.data?.map((item) => item.post_id) ?? []);
        savedIds = new Set(savesResult.data?.map((item) => item.post_id) ?? []);

        (likesCountResult.data ?? []).forEach((item) => {
          likesByPost.set(item.post_id, (likesByPost.get(item.post_id) ?? 0) + 1);
        });
        (commentsCountResult.data ?? []).forEach((item) => {
          commentsByPost.set(item.post_id, (commentsByPost.get(item.post_id) ?? 0) + 1);
        });

        profilesById = profilesResult;
      }

      const normalized = postList.map((post) => ({
        ...post,
        likes_count: likesByPost.get(post.id) ?? 0,
        comments_count: commentsByPost.get(post.id) ?? 0,
        user_liked: likedIds.has(post.id),
        user_saved: savedIds.has(post.id),
        profiles: profilesById.get(post.user_id) ?? null,
      }));

      setPosts(normalized);
    } catch (error) {
      console.error("Erro ao carregar posts:", error);
      toast({
        title: "Não foi possível carregar o feed",
        description: "Tente atualizar a página.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadVibes() {
    if (!user) return;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("tag", "Vibe")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const vibeList = data ?? [];
      const profiles = await fetchProfilesByIds(vibeList.map((vibe) => vibe.user_id));
      setVibes(vibeList.map((vibe) => ({ ...vibe, profiles: profiles.get(vibe.user_id) ?? null })));
    } catch (error) {
      console.error("Erro ao carregar Vibes:", error);
    }
  }

  function openComposer(vibe = false) {
    resetComposer();
    setIsVibe(vibe);
    setComposerOpen(true);
    setTimeout(() => composerTextareaRef.current?.focus(), 150);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const allowed = files.filter((file) => {
      if (mediaType === "video") return file.type.startsWith("video/");
      if (mediaType === "document") {
        return [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ].includes(file.type);
      }
      return file.type.startsWith("image/");
    });

    if (!allowed.length) {
      toast({
        title: "Arquivo não suportado",
        description: "Selecione um arquivo compatível com o tipo escolhido.",
        variant: "destructive",
      });
      return;
    }

    const newFiles =
      mediaType === "image" ? [...selectedFiles, ...allowed].slice(0, 6) : [allowed[0]];

    const urls = newFiles.map((file) =>
      mediaType === "document" ? "pdf-preview" : URL.createObjectURL(file)
    );

    previewUrls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });

    setSelectedFiles(newFiles);
    setPreviewUrls(urls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    const url = previewUrls[index];
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);

    setSelectedFiles((files) => files.filter((_, i) => i !== index));
    setPreviewUrls((urls) => urls.filter((_, i) => i !== index));
  }

  async function uploadPostFiles() {
    if (!user || !selectedFiles.length) return [];
    const urls: string[] = [];

    for (const file of selectedFiles) {
      const extension = file.name.split(".").pop() || "file";
      const path = `${user.id}/post_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;

      const { error } = await supabase.storage.from("post-media").upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handlePost() {
    if (!user) return;
    if (!newContent.trim() && selectedFiles.length === 0) {
      toast({
        title: "Sua publicação está vazia",
        description: "Adicione um texto ou arquivo antes de publicar.",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    try {
      const mediaUrls = await uploadPostFiles();

      if (isVibe) {
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          content: newContent.trim(),
          tag: "Vibe",
          media_url: mediaUrls[0] ?? null,
        });

        if (error) throw error;
        toast({ title: "Vibe publicada!", description: "Seu momento ficará disponível por 24 horas." });
        closeComposer();
        loadVibes();
        return;
      }

      const payload = {
        user_id: user.id,
        content: newContent.trim(),
        title: newTitle.trim() || null,
        tag: selectedTag || null,
        media_url: mediaUrls[0] ?? null,
        media_urls: mediaUrls.length ? mediaUrls : null,
        video_url: mediaType === "video" ? mediaUrls[0] ?? null : null,
        document_url: mediaType === "document" ? mediaUrls[0] ?? null : null,
        event_at: eventAt || null,
        event_location: eventLocation.trim() || null,
        is_sold: false,
      };

      const { error } = await supabase.from("posts").insert(payload);
      if (error) throw error;

      toast({ title: "Publicação criada!", description: "Sua publicação foi adicionada ao feed." });
      closeComposer();
      loadPosts();
    } catch (error: any) {
      console.error("Erro ao publicar:", error);
      toast({
        title: "Não foi possível publicar",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: Post) {
    if (!user) return;
    const liked = !!post.user_liked;

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              user_liked: !liked,
              likes_count: Math.max(0, item.likes_count + (liked ? -1 : 1)),
            }
          : item
      )
    );

    try {
      if (liked) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    } catch (error) {
      console.error("Erro ao alterar curtida:", error);
      loadPosts();
      toast({ title: "Não foi possível atualizar a curtida", variant: "destructive" });
    }
  }

  async function handleSave(post: Post) {
    if (!user) return;
    const saved = !!post.user_saved;

    setPosts((current) =>
      current.map((item) => (item.id === post.id ? { ...item, user_saved: !saved } : item))
    );

    try {
      if (saved) {
        const { error } = await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Removido dos salvos" });
      } else {
        const { error } = await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
        toast({ title: "Publicação salva" });
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      loadPosts();
      toast({ title: "Não foi possível salvar a publicação", variant: "destructive" });
    }
  }

  async function handleDelete(post: Post) {
    if (!user || post.user_id !== user.id) return;
    if (!window.confirm("Tem certeza que deseja excluir esta publicação?")) return;

    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", user.id);
      if (error) throw error;

      setPosts((current) => current.filter((item) => item.id !== post.id));
      toast({ title: "Publicação excluída" });
    } catch (error) {
      console.error("Erro ao excluir publicação:", error);
      toast({ title: "Não foi possível excluir", variant: "destructive" });
    }
  }

  async function handleEdit() {
    if (!user || !editingPost) return;
    if (!editContent.trim()) {
      toast({ title: "A publicação não pode ficar vazia", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("posts")
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingPost.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPosts((current) =>
        current.map((post) => (post.id === editingPost.id ? { ...post, ...data } : post))
      );

      setEditingPost(null);
      setEditContent("");
      toast({ title: "Publicação atualizada" });
    } catch (error) {
      console.error("Erro ao editar:", error);
      toast({ title: "Não foi possível editar a publicação", variant: "destructive" });
    }
  }

  async function handleMarkAsSold(post: Post) {
    if (!user || post.user_id !== user.id) return;

    try {
      const { data, error } = await supabase
        .from("posts")
        .update({ is_sold: !post.is_sold })
        .eq("id", post.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPosts((current) =>
        current.map((item) => (item.id === post.id ? { ...item, ...data } : item))
      );

      toast({ title: post.is_sold ? "Anúncio reativado" : "Anúncio marcado como vendido" });
    } catch (error) {
      console.error("Erro ao alterar anúncio:", error);
      toast({ title: "Não foi possível atualizar o anúncio", variant: "destructive" });
    }
  }

  async function openComments(post: Post) {
    setSelectedPost(post);
    setCommentsOpen(true);
    setCommentsLoading(true);

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const commentList = data ?? [];
      const profiles = await fetchProfilesByIds(commentList.map((comment) => comment.user_id));
      setComments(commentList.map((comment) => ({ ...comment, profiles: profiles.get(comment.user_id) ?? null })));
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
      toast({ title: "Não foi possível carregar os comentários", variant: "destructive" });
    } finally {
      setCommentsLoading(false);
    }
  }

  async function addComment() {
    if (!user || !selectedPost || !commentText.trim()) return;
    const content = commentText.trim();
    setCommentText("");

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({ post_id: selectedPost.id, user_id: user.id, content })
        .select("*")
        .single();

      if (error) throw error;

      const profile = myProfile ?? (await fetchProfilesByIds([user.id])).get(user.id) ?? null;
      setComments((current) => [...current, { ...data, profiles: profile }]);
      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id ? { ...post, comments_count: post.comments_count + 1 } : post
        )
      );
    } catch (error) {
      console.error("Erro ao comentar:", error);
      setCommentText(content);
      toast({ title: "Não foi possível enviar o comentário", variant: "destructive" });
    }
  }

  function handleAddToCalendar(post: Post) {
    if (!post.event_at) return;
    const start = new Date(post.event_at);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      post.title || "Evento"
    )}&dates=${formatDate(start)}/${formatDate(end)}&details=${encodeURIComponent(
      post.content || ""
    )}&location=${encodeURIComponent(post.event_location || "")}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function closeComposer() {
    setComposerOpen(false);
    resetComposer();
  }

  function resetComposer() {
    previewUrls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });

    setNewContent("");
    setNewTitle("");
    setSelectedTag(null);
    setMediaType("text");
    setSelectedFiles([]);
    setPreviewUrls([]);
    setEventAt("");
    setEventLocation("");
    setIsVibe(false);
    setMusicRef("");
    setEditingPost(null);
  }

  function openEditComposer(post: Post) {
    setEditingPost(post);
    setNewContent(post.content || "");
    setNewTitle(post.title || "");
    setSelectedTag(post.tag || null);
    setNewPrice(post.price != null ? String(post.price) : "");
    setNewOriginalPrice(post.original_price != null ? String(post.original_price) : "");
    setEventAt(post.event_at ? new Date(post.event_at).toISOString().slice(0, 16) : "");
    setEventLocation(post.event_location || "");
    setComposerOpen(true);
  }

  function handleComposerMediaType(type: MediaType) {
    setMediaType(type);
    setSelectedFiles([]);
    previewUrls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    setPreviewUrls([]);
  }

  function getProfileInitials(profile?: Profile | null) {
    if (!profile?.full_name) return "U";
    return profile.full_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function getRoleBadge(post: Post) {
    const badge = post.author_badge;
    if (!badge) return null;
    return ROLE_BADGES[badge] ?? null;
  }

  function formatPostDate(date: string) {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  }

  function formatPrice(value: number | null | undefined) {
    if (value == null) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function sharePost(post: Post) {
    const url = `${window.location.origin}/connect?post=${post.id}`;
    if (navigator.share) {
      navigator.share({ title: post.title || "Publicação", text: post.content || "", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: "Link copiado!", description: "Você pode compartilhar a publicação onde quiser." });
      }).catch(() => {
        toast({ title: "Não foi possível copiar o link", variant: "destructive" });
      });
    }
  }

  function openProfile(userId: string) {
    navigate(`/profile/${userId}`);
  }

  function handleVibeClick(vibe: Vibe) {
    setViewingVibe(vibe);
  }

  function selectComposerTag(tag: string) {
    setSelectedTag((current) => (current === tag ? null : tag));
  }

  function renderVibes() {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">Status</h2>
            <p className="text-xs text-muted-foreground">Compartilhe algo que está acontecendo agora.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => openComposer(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => openComposer(true)} className="w-[76px] shrink-0 text-left">
              <div className="h-[76px] rounded-2xl border border-dashed flex items-center justify-center bg-muted/30">
                <div className="flex flex-col items-center gap-1">
                  <Plus className="h-6 w-6" />
                  <span className="text-[10px] font-medium">Seu status</span>
                </div>
              </div>
            </button>

            {vibes.map((vibe) => (
              <button type="button" key={vibe.id} onClick={() => handleVibeClick(vibe)} className="w-[76px] shrink-0 text-left">
                <div className="relative">
                  <div className="h-[76px] rounded-2xl overflow-hidden border bg-muted">
                    {vibe.media_url ? (
                      <img src={vibe.media_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full p-2 flex items-center justify-center text-center text-[10px] font-medium">
                        {vibe.content.slice(0, 50)}
                      </div>
                    )}
                  </div>
                  <Avatar className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-7 w-7 border-2 border-background">
                    <AvatarImage src={vibe.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{getProfileInitials(vibe.profiles)}</AvatarFallback>
                  </Avatar>
                </div>
                <p className="mt-3 text-[10px] text-center truncate">{vibe.profiles?.full_name || "Estudante"}</p>
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>
    );
  }

  function renderComposer() {
    return (
      <Dialog open={composerOpen} onOpenChange={(open) => (open ? setComposerOpen(true) : closeComposer())}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">
                  {isVibe ? "Criar status" : editingPost ? "Editar publicação" : "Criar publicação"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isVibe
                    ? "Compartilhe um momento rápido com a comunidade."
                    : "Compartilhe conhecimento, oportunidades, eventos e ideias com outros estudantes."}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeComposer} aria-label="Fechar">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={myAvatar ?? undefined} />
                <AvatarFallback>
                  {getProfileInitials({
                    id: user?.id || "",
                    full_name: user?.user_metadata?.full_name ?? null,
                    avatar_url: myAvatar,
                    course: null,
                    })}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{user?.user_metadata?.full_name || "Você"}</span>
                  <Badge variant="secondary" className="text-[10px] h-5">
                    <Globe className="h-3 w-3 mr-1" />
                    Público
                  </Badge>
                </div>

                {isVibe ? (
                  <Textarea
                    ref={composerTextareaRef}
                    value={newContent}
                    onChange={(event) => setNewContent(event.target.value)}
                    placeholder="O que está acontecendo?"
                    className="min-h-[150px] resize-none border-0 px-0 focus-visible:ring-0 text-base"
                    maxLength={500}
                  />
                ) : (
                  <>
                    <Input
                      value={newTitle}
                      onChange={(event) => setNewTitle(event.target.value)}
                      placeholder="Título (opcional)"
                      className="mb-3"
                      maxLength={120}
                    />
                    <Textarea
                      ref={composerTextareaRef}
                      value={newContent}
                      onChange={(event) => setNewContent(event.target.value)}
                      placeholder="O que você quer compartilhar com a comunidade?"
                      className="min-h-[160px] resize-none text-base"
                      maxLength={5000}
                    />
                  </>
                )}
                <div className="flex justify-end mt-1">
                  <span className="text-[11px] text-muted-foreground">{newContent.length}/{isVibe ? 500 : 5000}</span>
                </div>
              </div>
            </div>

            {!isVibe && (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Categoria</Label>
                    {selectedTag && (
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedTag(null)}>
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACADEMIC_TAGS.map((tag) => {
                      const Icon = POST_CATEGORY_ICONS[tag] ?? Tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => selectComposerTag(tag)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                            selectedTag === tag ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>


                {selectedTag === "Evento" && (
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarDays className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-semibold">Dados do evento</p>
                        <p className="text-xs text-muted-foreground">Adicione data, horário e local.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Data e horário</Label>
                        <Input type="datetime-local" value={eventAt} onChange={(event) => setEventAt(event.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label className="text-xs">Local</Label>
                        <Input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Ex.: Auditório..." className="mt-1.5" />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Adicionar ao post</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <Button
                      type="button"
                      variant={mediaType === "image" ? "secondary" : "outline"}
                      className="justify-start gap-2"
                      onClick={() => handleComposerMediaType("image")}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Foto
                    </Button>
                    <Button
                      type="button"
                      variant={mediaType === "video" ? "secondary" : "outline"}
                      className="justify-start gap-2"
                      onClick={() => handleComposerMediaType("video")}
                    >
                      <Video className="h-4 w-4" />
                      Vídeo
                    </Button>
                    <Button
                      type="button"
                      variant={mediaType === "document" ? "secondary" : "outline"}
                      className="justify-start gap-2"
                      onClick={() => handleComposerMediaType("document")}
                    >
                      <FileText className="h-4 w-4" />
                      Arquivo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() => toast({ title: "Enquetes", description: "Recurso pronto para expansão." })}
                    >
                      <BarChart3 className="h-4 w-4" />
                      Enquete
                    </Button>
                  </div>

                  {mediaType !== "text" && (
                    <div className="mt-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx"}
                        multiple={mediaType === "image"}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-24 border-dashed flex flex-col gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadCloud className="h-6 w-6" />
                        <span className="text-sm font-medium">
                          {mediaType === "image" ? "Escolher fotos" : mediaType === "video" ? "Escolher vídeo" : "Escolher arquivo"}
                        </span>
                        <span className="text-xs text-muted-foreground">Clique para selecionar do dispositivo</span>
                      </Button>
                    </div>
                  )}

                  {previewUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative rounded-xl overflow-hidden border bg-muted aspect-square">
                          {mediaType === "image" ? (
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          ) : mediaType === "video" ? (
                            <video src={url} controls className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-3 text-center">
                              <FileText className="h-8 w-8" />
                              <span className="text-xs break-all">{selectedFiles[index]?.name}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isVibe && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="h-4 w-4" />
                  <Label className="text-sm">Música</Label>
                  <span className="text-xs text-muted-foreground">opcional</span>
                </div>
                <Input
                  value={musicRef}
                  onChange={(event) => setMusicRef(event.target.value)}
                  placeholder="Cole um link de música, se quiser"
                />
                <div className="mt-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" />
                    Adicionar imagem
                  </Button>
                </div>
                {previewUrls[0] && (
                  <div className="relative mt-3 overflow-hidden rounded-xl border aspect-video">
                    <img src={previewUrls[0]} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(0)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground hidden sm:block">
              {isVibe ? "Seu status desaparecerá após 24 horas." : "Revise as informações antes de publicar."}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={closeComposer}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handlePost}
                disabled={posting || (!newContent.trim() && !selectedFiles.length)}
                className="gap-2 min-w-[120px]"
              >
                {posting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Publicar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderPostCard(post: Post) {
    const roleBadge = getRoleBadge(post);
    const CategoryIcon = post.tag ? POST_CATEGORY_ICONS[post.tag] ?? Tag : Globe;

    return (
      <Card key={post.id} className="overflow-hidden border-border/70 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => openProfile(post.user_id)} className="shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>{getProfileInitials(post.profiles)}</AvatarFallback>
              </Avatar>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openProfile(post.user_id)} className="font-semibold text-sm hover:underline truncate">
                  {post.profiles?.full_name || "Estudante"}
                </button>
                {roleBadge && (
                  <Badge variant="secondary" className="h-5 gap-1 text-[10px] shrink-0">
                    <roleBadge.icon className="h-3 w-3" />
                    {roleBadge.label}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatPostDate(post.created_at)}</span>
                {post.profiles?.course && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[180px]">{post.profiles.course}</span>
                  </>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {post.user_id === user?.id && (
                  <>
                    <DropdownMenuItem onClick={() => openEditComposer(post)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    {post.tag === "Venda" && (
                      <DropdownMenuItem onClick={() => handleMarkAsSold(post)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {post.is_sold ? "Reativar anúncio" : "Marcar como vendido"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDelete(post)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => sharePost(post)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: "Obrigado pelo aviso", description: "A publicação será analisada." })}>
                  <Flag className="h-4 w-4 mr-2" />
                  Denunciar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(post.tag || post.title) && (
            <div className="mt-2 flex items-center gap-2">
              {post.tag && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <CategoryIcon className="h-3 w-3" />
                  {post.tag}
                </Badge>
              )}
              {post.is_sold && (
                <Badge variant="secondary" className="text-xs">
                  Vendido
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pb-3">
          {post.title && <h3 className="font-semibold text-lg mb-2 leading-snug">{post.title}</h3>}
          <p className="text-sm leading-6 whitespace-pre-wrap break-words">{post.content}</p>

          {post.media_urls && post.media_urls.length > 0 && (
            <div className={cn("grid gap-2 mt-4", post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {post.media_urls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className={cn("overflow-hidden rounded-xl border bg-muted", post.media_urls?.length === 1 ? "max-h-[520px]" : "aspect-square")}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {!post.media_urls && post.media_url && !post.video_url && !post.document_url && (
            <div className="mt-4 rounded-xl overflow-hidden border bg-muted max-h-[520px]">
              <img src={post.media_url} alt="" className="w-full object-cover" />
            </div>
          )}

          {post.video_url && (
            <div className="mt-4 rounded-xl overflow-hidden border bg-black">
              <video src={post.video_url} controls playsInline className="w-full max-h-[520px]" />
            </div>
          )}

          {post.document_url && (
            <a
              href={post.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Documento anexado</p>
                <p className="text-xs text-muted-foreground">Clique para abrir o arquivo</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          )}

          {post.price != null && (
            <div className="mt-4 rounded-xl border p-4 bg-muted/20">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Preço</p>
                  <p className="text-xl font-bold">{formatPrice(post.price)}</p>
                  {post.original_price != null && post.original_price > post.price && (
                    <p className="text-xs text-muted-foreground line-through">{formatPrice(post.original_price)}</p>
                  )}
                </div>
                {post.is_sold ? <Badge variant="secondary">Vendido</Badge> : <Badge>Disponível</Badge>}
              </div>
            </div>
          )}

          {post.event_at && (
            <div className="mt-4 rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">Evento</p>
                  <p className="text-sm mt-1">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(
                      new Date(post.event_at)
                    )}
                  </p>
                  {post.event_location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {post.event_location}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => handleAddToCalendar(post)}>
                    <CalendarDays className="h-4 w-4" />
                    Adicionar ao calendário
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 flex-col items-stretch">
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>{post.likes_count} curtida{post.likes_count !== 1 ? "s" : ""}</span>
            <span>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-4 gap-1 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleLike(post)}
              className={cn("gap-2", post.user_liked && "text-primary")}
            >
              <Heart className={cn("h-4 w-4", post.user_liked && "fill-current")} />
              <span className="hidden sm:inline">Curtir</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openComments(post)} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Comentar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSave(post)}
              className={cn("gap-2", post.user_saved && "text-primary")}
            >
              <Bookmark className={cn("h-4 w-4", post.user_saved && "fill-current")} />
              <span className="hidden sm:inline">Salvar</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => sharePost(post)} className="gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compartilhar</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }

  function renderFeedHeader() {

    return (
      <div className="space-y-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feed</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe o que está acontecendo na comunidade acadêmica.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => loadPosts()}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button className="gap-2" onClick={() => openComposer(false)}>
              <Plus className="h-4 w-4" />
              Publicar
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={myAvatar ?? undefined} />
              <AvatarFallback>
                {getProfileInitials({
                  id: user?.id || "",
                  full_name: user?.user_metadata?.full_name ?? null,
                  avatar_url: myAvatar,
                  course: null,
                })}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => openComposer(false)}
              className="flex-1 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors text-left px-4 py-3 text-sm text-muted-foreground"
            >
              O que você quer compartilhar hoje?
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar no feed..."
              className="pl-9"
            />
          </div>

          {(
            <div className="flex items-center gap-1 rounded-lg border p-1 overflow-x-auto">
              <Button size="sm" variant={feedMode === "for-you" ? "secondary" : "ghost"} onClick={() => setFeedMode("for-you")} className="shrink-0">
                Para você
              </Button>
              <Button size="sm" variant={feedMode === "trending" ? "secondary" : "ghost"} onClick={() => setFeedMode("trending")} className="shrink-0">
                Em alta
              </Button>
              <Button size="sm" variant={feedMode === "university" ? "secondary" : "ghost"} onClick={() => setFeedMode("university")} className="shrink-0">
                Universidade
              </Button>
              <Button size="sm" variant={feedMode === "course" ? "secondary" : "ghost"} onClick={() => setFeedMode("course")} className="shrink-0">
                Meu curso
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showSavedOnly ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setShowSavedOnly((value) => !value)}
          >
            <Bookmark className={cn("h-4 w-4", showSavedOnly && "fill-current")} />
            Salvos
          </Button>
        </div>
      </div>
    );
  }

  function renderFeed() {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredPosts.length === 0) {
      return (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-lg">Nenhuma publicação encontrada</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              {showSavedOnly
                ? "Você ainda não salvou publicações."
                : searchTerm
                ? "Tente pesquisar por outro termo."
                : "Seja o primeiro a compartilhar algo com a comunidade."}
            </p>
            {!showSavedOnly && !searchTerm && (
              <Button className="mt-5 gap-2" onClick={() => openComposer(false)}>
                <Plus className="h-4 w-4" />
                Criar publicação
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {filteredPosts.map((post) => renderPostCard(post))}
      </div>
    );
  }

  function renderCommentsDialog() {
    return (
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle>Comentários</DialogTitle>
            <DialogDescription>Participe da conversa.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
            {commentsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="py-10 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium text-sm">Ainda não há comentários</p>
                <p className="text-xs text-muted-foreground mt-1">Seja o primeiro a comentar.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={comment.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback>{getProfileInitials(comment.profiles)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="rounded-xl bg-muted px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs">{comment.profiles?.full_name || "Estudante"}</span>
                          <span className="text-[10px] text-muted-foreground">{formatPostDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    addComment();
                  }
                }}
                placeholder="Escreva um comentário..."
              />
              <Button size="icon" onClick={addComment} disabled={!commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderVibeDialog() {
    if (!viewingVibe) return null;

    return (
      <Dialog open={!!viewingVibe} onOpenChange={(open) => !open && setViewingVibe(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="relative">
            {viewingVibe.media_url ? (
              <img src={viewingVibe.media_url} alt="" className="w-full max-h-[65vh] object-cover" />
            ) : (
              <div className="min-h-[350px] flex items-center justify-center p-10 bg-muted">
                <p className="text-center text-lg font-medium whitespace-pre-wrap">{viewingVibe.content}</p>
              </div>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 rounded-full"
              onClick={() => setViewingVibe(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={viewingVibe.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>{getProfileInitials(viewingVibe.profiles)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{viewingVibe.profiles?.full_name || "Estudante"}</p>
                <p className="text-xs text-muted-foreground">{formatPostDate(viewingVibe.created_at)}</p>
              </div>
            </div>
            {viewingVibe.media_url && viewingVibe.content && (
              <p className="text-sm whitespace-pre-wrap mt-4">{viewingVibe.content}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-6">
        {renderVibes()}
        {renderFeedHeader()}
        {renderFeed()}
      </div>

      {renderComposer()}
      {renderCommentsDialog()}
      {renderVibeDialog()}

      <Dialog
        open={!!editingPost}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPost(null);
            setEditContent("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
            <DialogDescription>Altere o texto da sua publicação.</DialogDescription>
          </DialogHeader>

          <Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} className="min-h-[180px]" />

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingPost(null);
                setEditContent("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!editContent.trim()} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
