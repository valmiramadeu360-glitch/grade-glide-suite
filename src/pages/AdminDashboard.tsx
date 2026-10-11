import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  ShieldCheck, Users, MessageSquare, AlertTriangle, Loader2, ArrowLeft, CheckCircle2, Newspaper, XCircle,
  Trash2, Ban, Megaphone, Send, Search, Sparkles, Plus, Power, X, Crown, LayoutDashboard,
  MapPin, ImagePlus, Building2, BadgeCheck, GraduationCap, Briefcase, FileText, UtensilsCrossed,
  FlaskConical, ClipboardList, Archive, ArchiveRestore, UserMinus, ChevronDown, ChevronRight, Flag, Activity,
  Pencil, LocateFixed, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Selos institucionais do Connect
const BADGE_ROLES: Record<string, { label: string; icon: any }> = {
  student_verified: { label: "Estudante Verificado", icon: BadgeCheck },
  professor: { label: "Professor", icon: GraduationCap },
  university_official: { label: "Universidade Oficial", icon: Building2 },
  company: { label: "Empresa", icon: Briefcase },
  library: { label: "Biblioteca", icon: FileText },
  ru: { label: "Restaurante Universitário", icon: UtensilsCrossed },
  project: { label: "Projeto/Centro Acadêmico", icon: FlaskConical },
};

const REPORT_TARGET_LABEL: Record<string, string> = { comment: "Comentário", user: "Usuário", message: "Mensagem" };

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Métricas Consolidadas (Lazy Load)
  const [metrics, setMetrics] = useState({ users: 0, feedbacks: 0, reports: 0, journals: 0 });

  // Listagens de cada aba
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState("");
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [journalFilter, setJournalFilter] = useState<"pending" | "approved" | "all">("pending");
  const [reviewingJournalId, setReviewingJournalId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reports, setReports] = useState<any[]>([]);
  const [contentReports, setContentReports] = useState<any[]>([]);
  
  // Megafone e Banners
  const [promoTitle, setPromoTitle] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [sendingPromo, setSendingPromo] = useState(false);
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annType, setAnnType] = useState<"notice" | "news" | "poll">("notice");
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaUrl, setAnnCtaUrl] = useState("");
  const [annOptions, setAnnOptions] = useState<string[]>(["", ""]);
  const [savingAnn, setSavingAnn] = useState(false);

  // Privilégios e Selos
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [badgeMap, setBadgeMap] = useState<Map<string, string[]>>(new Map());
  const [badgeSearch, setBadgeSearch] = useState("");
  const [badgeRoleToGrant, setBadgeRoleToGrant] = useState<string>("student_verified");

  // Mapa do Campus
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [campusBlocks, setCampusBlocks] = useState<any[]>([]);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [mapSignedUrl, setMapSignedUrl] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [blockName, setBlockName] = useState("");
  const [blockCategory, setBlockCategory] = useState("bloco");
  const [blockDescription, setBlockDescription] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  // Restaurante Universitário (RU)
  const [ruRestaurants, setRuRestaurants] = useState<any[]>([]);
  const [ruCampusOptions, setRuCampusOptions] = useState<any[]>([]);
  const [ruFormOpen, setRuFormOpen] = useState(false);
  const [ruEditingId, setRuEditingId] = useState<string | null>(null);
  const [ruSavingRestaurant, setRuSavingRestaurant] = useState(false);
  const [ruLocating, setRuLocating] = useState(false);
  const [ruForm, setRuForm] = useState({
    campus_id: "",
    name: "Restaurante Universitário",
    description: "",
    latitude: "",
    longitude: "",
    radius_meters: "100",
    lunch_start: "11:00",
    lunch_end: "14:00",
    dinner_start: "17:00",
    dinner_end: "19:00",
    is_open: true,
    closed_reason: "",
    notice: "",
  });

  // Moderação e Auditoria
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [communitiesList, setCommunitiesList] = useState<any[]>([]);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);
  const [communityMembers, setCommunityMembers] = useState<Record<string, any[]>>({});

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId) || null;

  // 1. CHECAGEM DE ACESSO E CARREGAMENTO DE MÉTRICAS (MUITO MAIS RÁPIDO)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: isAdmin, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error || !isAdmin) {
        toast({ title: "Acesso Negado 🚫", description: "Área restrita.", variant: "destructive" });
        navigate("/");
        return;
      }
      loadMetrics();
    })();
  }, [user]);

  async function loadMetrics() {
    try {
      const [uRes, fRes, rPostRes, rContentRes, jRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("feedbacks").select("*", { count: "exact", head: true }),
        supabase.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("news_channels").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setMetrics({
        users: uRes.count || 0,
        feedbacks: fRes.count || 0,
        reports: (rPostRes.count || 0) + (rContentRes.count || 0),
        journals: jRes.count || 0,
      });
    } catch (e) {
      console.error("Erro ao carregar métricas admin:", e);
    } finally {
      setInitialLoading(false);
    }
  }

  // 2. ORQUESTRAÇÃO DO LAZY LOADING (SÓ CARREGA O QUE VOCÊ CLICA)
  useEffect(() => {
    if (initialLoading) return;
    
    // Debounce para Busca de Usuários e Selos (Escalabilidade real)
    if (activeTab === "users" || activeTab === "badges") {
      const query = activeTab === "users" ? searchUser : badgeSearch;
      const delay = setTimeout(() => { loadUsersAndRoles(query); }, 400);
      return () => clearTimeout(delay);
    }
    
    if (activeTab === "reports" && reports.length === 0 && contentReports.length === 0) loadAllReports();
    if (activeTab === "audit" && auditLog.length === 0) loadAuditLog();
    if (activeTab === "feedbacks" && feedbacks.length === 0) loadFeedbacks();
    if (activeTab === "communities" && communitiesList.length === 0) loadCommunities();
    if (activeTab === "map" && campuses.length === 0) loadCampuses();
    if (activeTab === "ru" && ruRestaurants.length === 0) loadRuRestaurants();
    if (activeTab === "announcements" && announcements.length === 0) loadAnnouncements();
    if (activeTab === "journals") loadJournals();

  }, [activeTab, searchUser, badgeSearch, initialLoading, journalFilter]);

  // FUNÇÕES DE LAZY LOAD SERVER-SIDE
  async function loadUsersAndRoles(query: string) {
    setLoadingTab(true);
    try {
      let q = supabase.from("profiles").select("*").order("full_name", { ascending: true }).limit(30);
      if (query) q = q.ilike("full_name", `%${query}%`);
      const { data: usersData, error } = await q;
      if (error) throw error;
      setUsersList(usersData || []);

      if (usersData && usersData.length > 0) {
        const ids = usersData.map(u => u.user_id);
        const { data: rolesData } = await supabase.from("user_roles").select("user_id,role").in("user_id", ids);
        const admins = new Set<string>();
        const badges = new Map<string, string[]>();
        (rolesData || []).forEach((r: any) => {
          if (r.role === "admin") admins.add(r.user_id);
          if (BADGE_ROLES[r.role]) {
            const list = badges.get(r.user_id) ?? [];
            list.push(r.role);
            badges.set(r.user_id, list);
          }
        });
        setAdminIds(admins);
        setBadgeMap(badges);
      }
    } catch {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally { setLoadingTab(false); }
  }

  async function loadAllReports() {
    setLoadingTab(true);
    try {
      const { data: rPosts } = await supabase.from("post_reports").select("*, posts(*)").eq("status", "pending");
      setReports(rPosts || []);

      const { data: cReports } = await (supabase as any).from("content_reports").select("*").eq("status", "pending").order("created_at", { ascending: false });
      const list: any[] = cReports || [];
      const commentIds = list.filter((r) => r.target_type === "comment").map((r) => r.target_id);
      const userIds = list.filter((r) => r.target_type === "user").map((r) => r.target_id);
      const messageIds = list.filter((r) => r.target_type === "message").map((r) => r.target_id);

      const [comments, users, messages] = await Promise.all([
        commentIds.length ? supabase.from("post_comments").select("id,content,user_id").in("id", commentIds) : Promise.resolve({ data: [] as any[] }),
        userIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
        messageIds.length ? supabase.from("direct_messages").select("id,content,sender_id").in("id", messageIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const commentMap = new Map((comments.data ?? []).map((c: any) => [c.id, c]));
      const userMap = new Map((users.data ?? []).map((u: any) => [u.user_id, u]));
      const messageMap = new Map((messages.data ?? []).map((m: any) => [m.id, m]));

      setContentReports(list.map((r) => ({
        ...r,
        _preview:
          r.target_type === "comment" ? commentMap.get(r.target_id)?.content
          : r.target_type === "user" ? userMap.get(r.target_id)?.full_name
          : r.target_type === "message" ? messageMap.get(r.target_id)?.content
          : null,
      })));
    } finally { setLoadingTab(false); }
  }

  async function loadAuditLog() {
    setLoadingTab(true);
    const { data } = await (supabase as any).from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    setAuditLog(data || []);
    const ids = Array.from(new Set<string>((data || []).map((l: any) => l.admin_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || "Admin"; });
      setAdminNames(map);
    }
    setLoadingTab(false);
  }

  async function loadFeedbacks() {
    setLoadingTab(true);
    const { data } = await supabase.from("feedbacks").select("*").order("created_at", { ascending: false });
    setFeedbacks(data || []);
    setLoadingTab(false);
  }

  async function loadJournals() {
    setLoadingTab(true);
    try {
      let query = (supabase as any).from("news_channels").select("*").order("created_at", { ascending: false });
      if (journalFilter !== "all") query = query.eq("status", journalFilter);
      const { data, error } = await query;
      if (error) {
        toast({
          title: "Erro ao buscar jornais",
          description: error.message,
          variant: "destructive",
        });
        setJournals([]);
      } else {
        setJournals(data || []);
      }
    } catch (err: any) {
      console.error("Falha ao carregar jornais:", err);
      setJournals([]);
    } finally {
      setLoadingTab(false);
    }
  }

  async function reviewJournalAction(id: string, status: "approved" | "rejected" | "suspended") {
    const { error } = await (supabase as any).rpc("review_journal", { _channel_id: id, _status: status, _note: reviewNote.trim() || null });
    if (error) {
      toast({ title: "Não foi possível revisar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Jornal aprovado" : status === "rejected" ? "Jornal recusado" : "Jornal suspenso" });
    setReviewingJournalId(null);
    setReviewNote("");
    loadJournals();
    loadMetrics();
  }

  async function loadCommunities() {
    setLoadingTab(true);
    const { data } = await supabase.from("communities").select("*").order("member_count", { ascending: false });
    setCommunitiesList(data || []);
    setLoadingTab(false);
  }

  async function loadCampuses() {
    setLoadingTab(true);
    const { data } = await supabase.from("campuses").select("*").order("name", { ascending: true });
    setCampuses(data || []);
    if (data && data.length > 0 && !selectedCampusId) setSelectedCampusId(data[0].id);
    setLoadingTab(false);
  }

  // RESTAURANTE UNIVERSITÁRIO (RU) — um por campus, criado/editado aqui.
  async function loadRuRestaurants() {
    setLoadingTab(true);
    const [ruRes, campusRes] = await Promise.all([
      (supabase as any).from("ru_restaurants").select("*, campuses(name)").order("name", { ascending: true }),
      supabase.from("campuses").select("id, name").order("name", { ascending: true }),
    ]);
    setRuRestaurants(ruRes.data || []);
    setRuCampusOptions(campusRes.data || []);
    setLoadingTab(false);
  }

  function openCreateRuModal() {
    setRuEditingId(null);
    setRuForm({
      campus_id: ruCampusOptions[0]?.id || "",
      name: "Restaurante Universitário",
      description: "",
      latitude: "",
      longitude: "",
      radius_meters: "100",
      lunch_start: "11:00",
      lunch_end: "14:00",
      dinner_start: "17:00",
      dinner_end: "19:00",
      is_open: true,
      closed_reason: "",
      notice: "",
    });
    setRuFormOpen(true);
  }

  function openEditRuModal(r: any) {
    setRuEditingId(r.id);
    setRuForm({
      campus_id: r.campus_id || "",
      name: r.name || "Restaurante Universitário",
      description: r.description || "",
      latitude: r.latitude ? String(r.latitude) : "",
      longitude: r.longitude ? String(r.longitude) : "",
      radius_meters: r.radius_meters ? String(r.radius_meters) : "100",
      lunch_start: r.lunch_start ? r.lunch_start.slice(0, 5) : "11:00",
      lunch_end: r.lunch_end ? r.lunch_end.slice(0, 5) : "14:00",
      dinner_start: r.dinner_start ? r.dinner_start.slice(0, 5) : "17:00",
      dinner_end: r.dinner_end ? r.dinner_end.slice(0, 5) : "19:00",
      is_open: r.is_open ?? true,
      closed_reason: r.closed_reason || "",
      notice: r.notice || "",
    });
    setRuFormOpen(true);
  }

  function captureAdminGpsForRu() {
    if (!navigator.geolocation) {
      toast({ title: "GPS indisponível", description: "Seu navegador não suporta geolocalização.", variant: "destructive" });
      return;
    }
    setRuLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRuLocating(false);
        setRuForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast({ title: "Coordenadas capturadas!", description: `Precisão de ~${Math.round(pos.coords.accuracy)}m.` });
      },
      (err) => {
        setRuLocating(false);
        toast({ title: "Falha ao obter GPS", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleSaveRuRestaurant() {
    if (!ruForm.campus_id) {
      toast({ title: "Campus obrigatório", description: "Vincule o RU a um campus.", variant: "destructive" });
      return;
    }
    if (!ruForm.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do RU.", variant: "destructive" });
      return;
    }

    setRuSavingRestaurant(true);
    try {
      const payload: any = {
        campus_id: ruForm.campus_id,
        name: ruForm.name.trim(),
        description: ruForm.description.trim() || null,
        latitude: ruForm.latitude ? parseFloat(ruForm.latitude) : null,
        longitude: ruForm.longitude ? parseFloat(ruForm.longitude) : null,
        radius_meters: parseInt(ruForm.radius_meters, 10) || 100,
        lunch_start: ruForm.lunch_start ? `${ruForm.lunch_start}:00` : "11:00:00",
        lunch_end: ruForm.lunch_end ? `${ruForm.lunch_end}:00` : "14:00:00",
        dinner_start: ruForm.dinner_start ? `${ruForm.dinner_start}:00` : "17:00:00",
        dinner_end: ruForm.dinner_end ? `${ruForm.dinner_end}:00` : "19:00:00",
        is_open: ruForm.is_open,
        closed_reason: ruForm.is_open ? null : (ruForm.closed_reason.trim() || null),
        notice: ruForm.notice.trim() || null,
      };

      if (ruEditingId) {
        const { error } = await (supabase as any).from("ru_restaurants").update(payload).eq("id", ruEditingId);
        if (error) throw error;
        toast({ title: "RU atualizado com sucesso!" });
      } else {
        const { error } = await (supabase as any).from("ru_restaurants").insert(payload);
        if (error) throw error;
        toast({ title: "RU cadastrado com sucesso!" });
      }
      setRuFormOpen(false);
      loadRuRestaurants();
    } catch (err: any) {
      toast({ title: "Erro ao salvar RU", description: err.message, variant: "destructive" });
    } finally {
      setRuSavingRestaurant(false);
    }
  }

  async function handleToggleRuOpen(r: any) {
    const nextState = !r.is_open;
    const { error } = await (supabase as any)
      .from("ru_restaurants")
      .update({ is_open: nextState, closed_reason: nextState ? null : (r.closed_reason || "Fechado temporariamente pelo admin") })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro ao alterar status do RU", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: nextState ? "RU reaberto!" : "RU fechado temporariamente." });
    setRuRestaurants((prev) => prev.map((item) => (item.id === r.id ? { ...item, is_open: nextState } : item)));
  }

  async function handleDeleteRu(id: string) {
    if (!confirm("Tem certeza que deseja excluir este RU? Menus e registros associados poderão ser afetados.")) return;
    const { error } = await (supabase as any).from("ru_restaurants").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "RU excluído com sucesso." });
    setRuRestaurants((prev) => prev.filter((r) => r.id !== id));
  }

  useEffect(() => {
    if (!selectedCampusId) return;
    (async () => {
      const { data } = await supabase.from("campus_blocks").select("*").eq("campus_id", selectedCampusId).order("name");
      setCampusBlocks(data || []);
      const c = campuses.find((x) => x.id === selectedCampusId);
      if (c?.map_image_url) {
        const { data: signed } = await supabase.storage.from("campus-maps").createSignedUrl(c.map_image_url, 3600);
        setMapSignedUrl(signed?.signedUrl || null);
      } else {
        setMapSignedUrl(null);
      }
    })();
  }, [selectedCampusId, campuses]);

  async function handleMapUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedCampusId) return;
    setUploadingMap(true);
    try {
      const path = `${selectedCampusId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("campus-maps").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: updateErr } = await supabase.from("campuses").update({ map_image_url: path }).eq("id", selectedCampusId);
      if (updateErr) throw updateErr;
      setCampuses((prev) => prev.map((c) => (c.id === selectedCampusId ? { ...c, map_image_url: path } : c)));
      const { data: signed } = await supabase.storage.from("campus-maps").createSignedUrl(path, 3600);
      setMapSignedUrl(signed?.signedUrl || null);
      toast({ title: "Mapa atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingMap(false);
    }
  }

  async function handleSavePin() {
    if (!pendingPin || !selectedCampusId || !blockName.trim()) return;
    setSavingBlock(true);
    try {
      const { data, error } = await supabase.from("campus_blocks").insert({
        campus_id: selectedCampusId,
        name: blockName.trim(),
        category: blockCategory,
        description: blockDescription.trim() || null,
        pin_x: pendingPin.x,
        pin_y: pendingPin.y,
      }).select().single();
      if (error) throw error;
      setCampusBlocks((prev) => [...prev, data]);
      setPendingPin(null);
      setBlockName("");
      setBlockDescription("");
      toast({ title: "Pino adicionado!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar pino", description: err.message, variant: "destructive" });
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleDeletePin(id: string) {
    const { error } = await supabase.from("campus_blocks").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setCampusBlocks((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Pino removido" });
  }

  async function handleToggleCommunityArchive(comm: any) {
    const nextArchived = !comm.is_archived;
    const { error } = await supabase.from("communities").update({ is_archived: nextArchived }).eq("id", comm.id);
    if (error) {
      toast({ title: "Erro ao alterar status", description: error.message, variant: "destructive" });
      return;
    }
    setCommunitiesList((prev) => prev.map((c) => (c.id === comm.id ? { ...c, is_archived: nextArchived } : c)));
    toast({ title: nextArchived ? "Comunidade arquivada" : "Comunidade desarquivada" });
  }

  async function loadCommunityMembers(communityId: string) {
    if (communityMembers[communityId]) {
      setExpandedCommunityId(expandedCommunityId === communityId ? null : communityId);
      return;
    }
    const { data } = await supabase.from("community_members").select("id, user_id, role, created_at, profiles(user_id, full_name, avatar_url)").eq("community_id", communityId);
    setCommunityMembers((prev) => ({ ...prev, [communityId]: data || [] }));
    setExpandedCommunityId(communityId);
  }

  async function handleRemoveMember(communityId: string, memberId: string) {
    const { error } = await supabase.from("community_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setCommunityMembers((prev) => ({
      ...prev,
      [communityId]: (prev[communityId] || []).filter((m) => m.id !== memberId),
    }));
    toast({ title: "Membro removido da comunidade" });
  }

  async function loadAnnouncements() {
    setLoadingTab(true);
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setLoadingTab(false);
  }

  async function handleCreateAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setSavingAnn(true);
    const filteredOptions = annType === "poll" ? annOptions.map((o) => o.trim()).filter(Boolean) : null;
    const { error } = await supabase.from("announcements").insert({
      title: annTitle.trim(),
      body: annBody.trim(),
      type: annType,
      cta_label: annCtaLabel.trim() || null,
      cta_url: annCtaUrl.trim() || null,
      options: filteredOptions && filteredOptions.length >= 2 ? filteredOptions : null,
      is_active: true,
      created_by: user!.id,
    });
    setSavingAnn(false);
    if (error) {
      toast({ title: "Erro ao criar banner", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Banner criado e publicado!" });
    setAnnTitle("");
    setAnnBody("");
    setAnnCtaLabel("");
    setAnnCtaUrl("");
    setAnnOptions(["", ""]);
    loadAnnouncements();
  }

  async function handleToggleAnnouncement(id: string, current: boolean) {
    const { error } = await supabase.from("announcements").update({ is_active: !current }).eq("id", id);
    if (!error) {
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a)));
      toast({ title: !current ? "Banner ativado" : "Banner desativado" });
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (!error) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Banner excluído" });
    }
  }

  async function toggleAdmin(userId: string, isCurrentAdmin: boolean) {
    if (isCurrentAdmin && adminIds.size <= 1) {
      toast({ title: "Ação bloqueada", description: "O sistema precisa de pelo menos 1 administrador ativo.", variant: "destructive" });
      return;
    }
    if (isCurrentAdmin) {
      const { error } = await supabase.from("user_roles").delete().match({ user_id: userId, role: "admin" });
      if (!error) {
        setAdminIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
        toast({ title: "Privilégio de Admin removido" });
      }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (!error) {
        setAdminIds((prev) => new Set([...prev, userId]));
        toast({ title: "Privilégio de Admin concedido! 👑" });
      }
    }
  }

  async function grantBadgeRole(userId: string, role: string) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) {
      toast({ title: "Erro ao conceder selo", description: error.message, variant: "destructive" });
      return;
    }
    setBadgeMap((prev) => {
      const next = new Map(prev);
      const list = next.get(userId) ?? [];
      if (!list.includes(role)) next.set(userId, [...list, role]);
      return next;
    });
    toast({ title: "Selo concedido com sucesso!" });
  }

  async function revokeBadgeRole(userId: string, role: string) {
    const { error } = await supabase.from("user_roles").delete().match({ user_id: userId, role });
    if (error) {
      toast({ title: "Erro ao revogar selo", description: error.message, variant: "destructive" });
      return;
    }
    setBadgeMap((prev) => {
      const next = new Map(prev);
      const list = (next.get(userId) ?? []).filter((r) => r !== role);
      next.set(userId, list);
      return next;
    });
    toast({ title: "Selo revogado" });
  }

  async function handleBanUser(userId: string, isBanned: boolean) {
    const { error } = await supabase.from("profiles").update({ is_banned: !isBanned }).eq("user_id", userId);
    if (!error) {
      setUsersList((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_banned: !isBanned } : u)));
      toast({ title: !isBanned ? "Usuário banido do ecossistema" : "Usuário desbanido" });
    }
  }

  async function handleDismissFeedback(id: string) {
    const { error } = await supabase.from("feedbacks").delete().eq("id", id);
    if (!error) {
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      toast({ title: "Feedback arquivado" });
    }
  }

  async function handleResolveReport(reportId: string, action: "ignore" | "delete_post", postId?: string) {
    if (action === "delete_post" && postId) {
      await supabase.from("posts").delete().eq("id", postId);
    }
    const { error } = await supabase.from("post_reports").update({ status: "resolved" }).eq("id", reportId);
    if (!error) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      loadMetrics();
      toast({ title: action === "delete_post" ? "Post removido e denúncia resolvida" : "Denúncia ignorada" });
    }
  }

  async function handleResolveContentReport(report: any, action: "dismiss" | "delete_content") {
    if (action === "delete_content") {
      if (report.target_type === "comment") await supabase.from("post_comments").delete().eq("id", report.target_id);
      else if (report.target_type === "message") await supabase.from("direct_messages").delete().eq("id", report.target_id);
      else if (report.target_type === "user") await supabase.from("profiles").update({ is_banned: true }).eq("user_id", report.target_id);
    }
    const { error } = await (supabase as any).from("content_reports").update({ status: "resolved" }).eq("id", report.id);
    if (!error) {
      setContentReports((prev) => prev.filter((r) => r.id !== report.id));
      loadMetrics();
      toast({ title: action === "delete_content" ? "Conteúdo removido e denúncia encerrada" : "Denúncia dispensada" });
    }
  }

  async function handleSendPromo() {
    if (!promoTitle.trim() || !promoMessage.trim()) {
      toast({ title: "Preencha todos os campos do megafone", variant: "destructive" });
      return;
    }
    setSendingPromo(true);
    try {
      const { data: users, error: uErr } = await supabase.from("profiles").select("user_id");
      if (uErr) throw uErr;
      if (!users || users.length === 0) {
        toast({ title: "Nenhum usuário encontrado" });
        return;
      }
      const notifications = users.map((u) => ({
        user_id: u.user_id,
        type: "system_announcement",
        title: `📢 ${promoTitle}`,
        message: promoMessage,
      }));
      const { error: nErr } = await supabase.from("notifications").insert(notifications);
      if (nErr) throw nErr;
      toast({ title: "Megafone disparado!", description: `Mensagem enviada para ${users.length} estudantes.` });
      setPromoTitle("");
      setPromoMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao disparar megafone", description: e.message, variant: "destructive" });
    } finally {
      setSendingPromo(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Autenticando Acesso Master...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-xl border border-border/40 p-6 rounded-[32px] shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-2xl h-12 w-12 hover:bg-muted/50 border border-border/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Painel Administrativo</h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] font-black uppercase px-2.5 py-0.5">Master</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Controle absoluto, moderação e expansão da rede</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-6 items-start">
        {/* NAVEGAÇÃO LATERAL */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6 bg-card/40 border border-border/30 rounded-[32px] p-4">
          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Visão & Controle</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="overview" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><ShieldCheck className="h-4 w-4" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="users" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
              <TabsTrigger value="badges" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><BadgeCheck className="h-4 w-4" /> Selos & Cargos</TabsTrigger>
              <TabsTrigger value="communities" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Building2 className="h-4 w-4" /> Comunidades</TabsTrigger>
              <TabsTrigger value="map" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><MapPin className="h-4 w-4" /> Mapa Campus</TabsTrigger>
              <TabsTrigger value="ru" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><UtensilsCrossed className="h-4 w-4" /> Restaurante (RU)</TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Segurança & Moderação</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="reports" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-destructive data-[state=active]:text-white bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center">
                <AlertTriangle className="h-4 w-4" /> Denúncias 
                {metrics.reports > 0 && <span className="bg-white text-destructive rounded-full px-2 py-0.5 text-[10px] ml-auto font-black">{metrics.reports}</span>}
              </TabsTrigger>
              <TabsTrigger value="audit" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><ClipboardList className="h-4 w-4" /> Auditoria</TabsTrigger>
              <TabsTrigger value="feedbacks" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><MessageSquare className="h-4 w-4" /> Feedbacks</TabsTrigger>
              <TabsTrigger value="journals" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center">
                <Newspaper className="h-4 w-4" /> Jornais
                {metrics.journals > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] ml-auto font-black">
                    {metrics.journals}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Comunicação</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="announcements" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><LayoutDashboard className="h-4 w-4" /> Banners</TabsTrigger>
              <TabsTrigger value="broadcast" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Megaphone className="h-4 w-4" /> Megafone</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="flex-1 min-w-0 bg-card rounded-[32px] p-4 sm:p-6 lg:p-8 shadow-sm border border-border/30 relative min-h-[60vh]">
          {loadingTab && (
             <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-[32px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
          )}

          {/* 0. VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-8 mt-0 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Users className="h-6 w-6" /></div>
                  <p className="text-3xl font-black leading-none text-foreground">{metrics.users}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Usuários Cadastrados</p>
                </CardContent>
              </Card>
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><MessageSquare className="h-6 w-6" /></div>
                  <p className="text-3xl font-black leading-none text-foreground">{metrics.feedbacks}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Feedbacks Recebidos</p>
                </CardContent>
              </Card>
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4"><AlertTriangle className="h-6 w-6" /></div>
                  <p className="text-3xl font-black leading-none text-foreground">{metrics.reports}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Denúncias Pendentes</p>
                </CardContent>
              </Card>
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4"><Newspaper className="h-6 w-6" /></div>
                  <p className="text-3xl font-black leading-none text-foreground">{metrics.journals}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Jornais Pendentes</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 1. GESTÃO DE USUÁRIOS */}
          <TabsContent value="users" className="space-y-6 mt-0 animate-in fade-in">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Busque por nome ou sobrenome..." className="pl-14 h-14 rounded-[24px] bg-muted/30 border-0 shadow-sm text-base font-medium focus-visible:ring-primary transition-all" />
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {usersList.length === 0 ? (
                <div className="xl:col-span-2"><EmptyState icon={<Users className="h-10 w-10" />} text="Nenhum usuário encontrado." /></div>
              ) : (
                usersList.map((u) => (
                  <Card key={u.user_id} className={cn("rounded-[24px] border border-border/30 shadow-none transition-all", u.is_banned ? "bg-destructive/5 opacity-80" : "bg-background")}>
                    <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                      <Avatar className={cn("h-12 w-12 border-2", adminIds.has(u.user_id) ? "border-amber-400" : "border-border/40")}>
                        <AvatarImage src={u.avatar_url} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-black">{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate flex items-center gap-2">
                          {u.full_name || "Perfil Pendente"}
                          {adminIds.has(u.user_id) && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0 px-2 py-0 text-[9px]"><Crown className="h-3 w-3 mr-1" /> Admin</Badge>}
                          {u.is_banned && <Badge variant="destructive" className="px-2 py-0 text-[9px]">Banido</Badge>}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate mt-1">
                          {u.course || "Não Informado"} · {u.current_semester_label || "Sem vínculo"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="icon" variant={adminIds.has(u.user_id) ? "default" : "secondary"} className={cn("h-8 w-8 rounded-full", adminIds.has(u.user_id) && "bg-amber-500 hover:bg-amber-600 text-white")} title="Gerenciar Cargo" onClick={() => toggleAdmin(u.user_id, adminIds.has(u.user_id))}>
                          <Crown className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant={u.is_banned ? "outline" : "destructive"} className="h-8 w-8 rounded-full" title={u.is_banned ? "Desbanir" : "Banir Usuário"} onClick={() => handleBanUser(u.user_id, !!u.is_banned)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* 2. SELOS & CARGOS INSTITUCIONAIS */}
          <TabsContent value="badges" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><BadgeCheck className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Selos de Verificação</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Conceda autoridade e selos oficiais para perfis acadêmicos</p></div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={badgeSearch} onChange={(e) => setBadgeSearch(e.target.value)} placeholder="Buscar estudante para atribuir selo..." className="pl-11 h-12 rounded-[20px] bg-muted/20 border-border/40" />
              </div>
              <Select value={badgeRoleToGrant} onValueChange={setBadgeRoleToGrant}>
                <SelectTrigger className="h-12 w-full sm:w-64 rounded-[20px] border-border/40 bg-muted/20 text-xs font-black"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-[20px]">
                  {Object.entries(BADGE_ROLES).map(([key, cfg]) => (<SelectItem key={key} value={key} className="text-xs font-bold">{cfg.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {usersList.map((u) => {
                const userBadges = badgeMap.get(u.user_id) ?? [];
                return (
                  <Card key={u.user_id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border/30">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback className="font-black text-xs">{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm truncate">{u.full_name || "Perfil Pendente"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.course || "Não Informado"}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border/20">
                        {userBadges.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground font-medium italic">Nenhum selo atribuído</span>
                        ) : (
                          userBadges.map((role) => {
                            const cfg = BADGE_ROLES[role];
                            return (
                              <Badge key={role} variant="secondary" className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                {cfg?.label || role}
                                <button type="button" onClick={() => revokeBadgeRole(u.user_id, role)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                              </Badge>
                            );
                          })
                        )}
                        {!userBadges.includes(badgeRoleToGrant) && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] font-black rounded-full px-2 ml-auto" onClick={() => grantBadgeRole(u.user_id, badgeRoleToGrant)}>
                            <Plus className="h-3 w-3 mr-1" /> Conceder
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* 3. COMUNIDADES ACADÊMICAS */}
          <TabsContent value="communities" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Comunidades Acadêmicas</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Modere grupos de disciplinas, projetos e centros acadêmicos</p></div>
            </div>

            <div className="space-y-3">
              {communitiesList.map((c) => {
                const isExpanded = expandedCommunityId === c.id;
                const members = communityMembers[c.id] || [];
                return (
                  <Card key={c.id} className="rounded-[24px] border border-border/30 bg-background shadow-none overflow-hidden">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm truncate">{c.name}</h4>
                            {c.is_archived && <Badge variant="destructive" className="text-[9px] px-2 py-0">Arquivada</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.description || "Sem descrição"}</p>
                          <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{c.member_count || 0} membros · {c.type || "pública"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="ghost" className="h-9 text-xs font-bold gap-1 rounded-xl" onClick={() => loadCommunityMembers(c.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Membros
                          </Button>
                          <Button size="sm" variant={c.is_archived ? "default" : "outline"} className="h-9 text-xs font-black gap-1.5 rounded-xl" onClick={() => handleToggleCommunityArchive(c)}>
                            {c.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                            {c.is_archived ? "Desarquivar" : "Arquivar"}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-border/20 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Membros Registrados ({members.length})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar">
                            {members.map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/20 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px] font-black">{m.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                                  <span className="font-bold truncate">{m.profiles?.full_name || "Sem nome"}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{m.role}</Badge>
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(c.id, m.id)}><UserMinus className="h-3.5 w-3.5" /></Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* 4. MAPA DO CAMPUS */}
          <TabsContent value="map" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-black text-lg">Mapeamento do Campus</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Faça o upload da planta e posicione blocos interativos</p></div>
              </div>
              <Select value={selectedCampusId} onValueChange={setSelectedCampusId}>
                <SelectTrigger className="w-full sm:w-60 h-10 rounded-xl border-border/40 bg-muted/20 text-xs font-black"><SelectValue placeholder="Selecione o Campus" /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {campuses.map((c) => (<SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="map-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-sm">
                  {uploadingMap ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {mapSignedUrl ? "Trocar Imagem do Mapa" : "Fazer Upload da Imagem da Planta"}
                </div>
                <input id="map-upload" type="file" accept="image/*" onChange={handleMapUpload} className="hidden" disabled={uploadingMap || !selectedCampusId} />
              </Label>
              <span className="text-[11px] text-muted-foreground font-medium">PNG ou JPG de alta resolução da planta do campus.</span>
            </div>

            {mapSignedUrl ? (
              <div className="space-y-4">
                <div
                  className="relative rounded-[24px] overflow-hidden border border-border/40 bg-muted/10 cursor-crosshair select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setPendingPin({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
                  }}
                >
                  <img src={mapSignedUrl} alt="Mapa Campus" className="w-full h-auto max-h-[600px] object-contain block mx-auto pointer-events-none" />
                  {campusBlocks.map((b) => (
                    <div key={b.id} style={{ left: `${b.pin_x}%`, top: `${b.pin_y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 group">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background cursor-pointer"><MapPin className="h-3 w-3" /></div>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:flex items-center gap-1.5 bg-background border border-border/60 text-foreground text-[10px] font-black px-2 py-1 rounded-lg shadow-xl whitespace-nowrap z-20">
                        <span>{b.name}</span>
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); handleDeletePin(b.id); }} className="text-destructive hover:opacity-75"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                  {pendingPin && (
                    <div style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 animate-bounce">
                      <div className="h-7 w-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-background"><MapPin className="h-4 w-4" /></div>
                    </div>
                  )}
                </div>

                {pendingPin && (
                  <Card className="rounded-[24px] border border-amber-500/40 bg-amber-500/5 shadow-none">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Novo Ponto ({pendingPin.x}%, {pendingPin.y}%)</p>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingPin(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input placeholder="Nome (Ex: Bloco de Medicina, Biblioteca Central)" value={blockName} onChange={(e) => setBlockName(e.target.value)} className="h-10 text-xs rounded-xl" />
                        <Select value={blockCategory} onValueChange={setBlockCategory}>
                          <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="bloco">Bloco / Sala de Aula</SelectItem>
                            <SelectItem value="biblioteca">Biblioteca</SelectItem>
                            <SelectItem value="laboratorio">Laboratório</SelectItem>
                            <SelectItem value="secretaria">Secretaria / Atendimento</SelectItem>
                            <SelectItem value="auditorio">Auditório</SelectItem>
                            <SelectItem value="alimentacao">Restaurante / Lanchonete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Descrição ou pontos de referência..." value={blockDescription} onChange={(e) => setBlockDescription(e.target.value)} rows={2} className="text-xs rounded-xl resize-none" />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPendingPin(null)} className="h-9 text-xs font-bold rounded-xl">Cancelar</Button>
                        <Button size="sm" onClick={handleSavePin} disabled={savingBlock || !blockName.trim()} className="h-9 text-xs font-black rounded-xl">
                          {savingBlock ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fixar Ponto"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <EmptyState icon={<MapPin className="h-10 w-10" />} text="Nenhuma planta cadastrada para este campus. Faça o upload acima." />
            )}
          </TabsContent>

          {/* RESTAURANTE UNIVERSITÁRIO (RU) */}
          <TabsContent value="ru" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg">Restaurantes Universitários (RU)</h3>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Gerencie localização (geofencing da fila), horários e comunicados por campus
                  </p>
                </div>
              </div>
              <Button onClick={openCreateRuModal} className="h-10 rounded-xl text-xs font-black gap-2">
                <Plus className="h-4 w-4" /> Novo RU
              </Button>
            </div>

            {ruRestaurants.length === 0 ? (
              <EmptyState
                icon={<UtensilsCrossed className="h-10 w-10" />}
                text="Nenhum RU cadastrado ainda. Clique em 'Novo RU' para criar o primeiro vinculado ao campus."
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {ruRestaurants.map((r) => (
                  <Card key={r.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-base truncate">{r.name}</h4>
                            <Badge
                              variant={r.is_open ? "default" : "secondary"}
                              className={cn(
                                "text-[9px] font-black uppercase px-2 py-0 border-0",
                                r.is_open ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                              )}
                            >
                              {r.is_open ? "Em Operação" : "Fechado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-bold mt-0.5">
                            {r.campuses?.name || "Campus não identificado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg"
                            title="Editar RU"
                            onClick={() => openEditRuModal(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            title="Excluir RU"
                            onClick={() => handleDeleteRu(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {r.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {r.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-2xl border border-border/20">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almoço</p>
                          <p className="font-black mt-0.5">
                            {r.lunch_start?.slice(0, 5) || "11:00"} – {r.lunch_end?.slice(0, 5) || "14:00"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jantar</p>
                          <p className="font-black mt-0.5">
                            {r.dinner_start?.slice(0, 5) || "17:00"} – {r.dinner_end?.slice(0, 5) || "19:00"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1 font-bold">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {r.latitude && r.longitude
                            ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)} (raio ${r.radius_meters || 100}m)`
                            : "GPS não configurado"}
                        </span>
                        <Button
                          size="sm"
                          variant={r.is_open ? "outline" : "default"}
                          className="h-7 text-[11px] font-black rounded-lg gap-1"
                          onClick={() => handleToggleRuOpen(r)}
                        >
                          <Power className="h-3 w-3" />
                          {r.is_open ? "Pausar RU" : "Reabrir RU"}
                        </Button>
                      </div>

                      {r.notice && (
                        <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl font-medium">
                          📢 <span className="font-bold">Aviso: </span>{r.notice}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* MODAL CRIAR/EDITAR RU */}
            <Dialog open={ruFormOpen} onOpenChange={setRuFormOpen}>
              <DialogContent className="max-w-lg rounded-[28px] p-6 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-black text-lg flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    {ruEditingId ? "Editar Restaurante Universitário" : "Novo Restaurante Universitário"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Campus</Label>
                    <Select
                      value={ruForm.campus_id}
                      onValueChange={(val) => setRuForm((prev) => ({ ...prev, campus_id: val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl text-xs font-bold">
                        <SelectValue placeholder="Selecione o campus..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {ruCampusOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs font-bold">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome do RU</Label>
                    <Input
                      value={ruForm.name}
                      onChange={(e) => setRuForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Restaurante Universitário - Campus A.C. Simões"
                      className="h-11 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Descrição</Label>
                    <Textarea
                      value={ruForm.description}
                      onChange={(e) => setRuForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Orientações sobre fichas, pagamento ou localização..."
                      rows={2}
                      className="rounded-xl text-xs resize-none"
                    />
                  </div>

                  {/* COORDENADAS E GEOFENCING */}
                  <div className="space-y-2 p-3 bg-muted/20 rounded-2xl border border-border/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <LocateFixed className="h-3.5 w-3.5 text-primary" />
                        Geofencing (Validação de Fila)
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={captureAdminGpsForRu}
                        disabled={ruLocating}
                        className="h-7 text-[10px] font-black rounded-lg gap-1"
                      >
                        {ruLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                        Usar meu GPS atual
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground">Latitude</span>
                        <Input
                          value={ruForm.latitude}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, latitude: e.target.value }))}
                          placeholder="-9.5558"
                          className="h-9 rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground">Longitude</span>
                        <Input
                          value={ruForm.longitude}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, longitude: e.target.value }))}
                          placeholder="-35.7744"
                          className="h-9 rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground">Raio (metros)</span>
                        <Input
                          type="number"
                          value={ruForm.radius_meters}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, radius_meters: e.target.value }))}
                          placeholder="100"
                          className="h-9 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Estudantes só podem registrar status da fila se estiverem dentro deste raio no mapa.
                    </p>
                  </div>

                  {/* HORÁRIOS */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 p-3 bg-muted/20 rounded-2xl border border-border/30">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Almoço
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Input
                          type="time"
                          value={ruForm.lunch_start}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, lunch_start: e.target.value }))}
                          className="h-9 rounded-lg text-xs"
                        />
                        <Input
                          type="time"
                          value={ruForm.lunch_end}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, lunch_end: e.target.value }))}
                          className="h-9 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 bg-muted/20 rounded-2xl border border-border/30">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Jantar
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Input
                          type="time"
                          value={ruForm.dinner_start}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, dinner_start: e.target.value }))}
                          className="h-9 rounded-lg text-xs"
                        />
                        <Input
                          type="time"
                          value={ruForm.dinner_end}
                          onChange={(e) => setRuForm((prev) => ({ ...prev, dinner_end: e.target.value }))}
                          className="h-9 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STATUS E COMUNICADOS */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/30">
                    <div>
                      <Label className="text-xs font-black">RU Aberto em Operação</Label>
                      <p className="text-[10px] text-muted-foreground">Desative em caso de reforma, greve ou recesso.</p>
                    </div>
                    <Switch
                      checked={ruForm.is_open}
                      onCheckedChange={(checked) => setRuForm((prev) => ({ ...prev, is_open: checked }))}
                    />
                  </div>

                  {!ruForm.is_open && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-destructive uppercase">Motivo do Fechamento</Label>
                      <Input
                        value={ruForm.closed_reason}
                        onChange={(e) => setRuForm((prev) => ({ ...prev, closed_reason: e.target.value }))}
                        placeholder="Ex: Em recesso acadêmico até 15/02"
                        className="h-10 rounded-xl text-xs border-destructive/30"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Aviso Geral (Banner no topo do RU)</Label>
                    <Input
                      value={ruForm.notice}
                      onChange={(e) => setRuForm((prev) => ({ ...prev, notice: e.target.value }))}
                      placeholder="Ex: Hoje o cardápio terá opção vegana especial"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRuFormOpen(false)}
                      className="h-10 rounded-xl text-xs font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveRuRestaurant}
                      disabled={ruSavingRestaurant}
                      className="h-10 rounded-xl text-xs font-black gap-2"
                    >
                      {ruSavingRestaurant && <Loader2 className="h-4 w-4 animate-spin" />}
                      Salvar RU
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* JORNAIS: FUNDAÇÃO DE REDAÇÕES (aprovar/recusar/suspender) */}
          <TabsContent value="journals" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><Newspaper className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Fundação de Jornais</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Solicitações de redação estudantil para aprovar ou recusar</p></div>
            </div>

            <div className="flex gap-2 bg-muted/20 p-1.5 rounded-[20px] w-fit border border-border/30">
              {([
                { id: "pending", label: "Em análise" },
                { id: "approved", label: "Aprovados" },
                { id: "all", label: "Todos" },
              ] as const).map((f) => (
                <button key={f.id} type="button" onClick={() => setJournalFilter(f.id)} className={cn("px-4 py-2 rounded-[14px] text-xs font-black uppercase tracking-wider transition-all", journalFilter === f.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {f.label}
                </button>
              ))}
            </div>

            {loadingTab ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : journals.length === 0 ? (
              <EmptyState icon={<Newspaper className="h-10 w-10" />} text="Nenhuma solicitação por aqui." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {journals.map((j) => (
                  <Card key={j.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden">
                            {j.logo_url ? <img src={j.logo_url} alt="" className="h-full w-full object-cover" /> : <Newspaper className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm truncate">{j.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">@{j.handle} · {j.category || "Sem categoria"}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 border-0 shrink-0",
                          j.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                          j.status === "pending" ? "bg-amber-500/10 text-amber-600" :
                          j.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                          {j.status === "approved" ? "Aprovado" : j.status === "pending" ? "Em análise" : j.status === "rejected" ? "Recusado" : "Suspenso"}
                        </Badge>
                      </div>

                      {j.editorial_line && <p className="text-xs text-muted-foreground leading-relaxed bg-muted/10 p-3 rounded-[14px] border border-border/30">{j.editorial_line}</p>}
                      {j.purpose && <p className="text-xs font-medium leading-relaxed"><span className="font-black">Intuito: </span>{j.purpose}</p>}
                      {j.team_note && <p className="text-xs font-medium leading-relaxed"><span className="font-black">Equipe: </span>{j.team_note}</p>}
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(j.created_at).toLocaleString("pt-BR")}</p>

                      {reviewingJournalId === j.id ? (
                        <div className="space-y-2 pt-2 border-t border-border/30">
                          <Textarea placeholder="Motivo (aparece pro fundador do jornal)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} className="rounded-[14px] text-xs" />
                          <div className="flex gap-2">
                            {j.status !== "approved" && (
                              <Button size="sm" onClick={() => reviewJournalAction(j.id, "approved")} className="h-9 rounded-xl text-xs font-black gap-1.5 bg-emerald-600 hover:bg-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Aprovar</Button>
                            )}
                            {j.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => reviewJournalAction(j.id, "rejected")} className="h-9 rounded-xl text-xs font-black gap-1.5 text-destructive border-destructive/30"><XCircle className="h-3.5 w-3.5" /> Recusar</Button>
                            )}
                            {j.status === "approved" && (
                              <Button size="sm" variant="outline" onClick={() => reviewJournalAction(j.id, "suspended")} className="h-9 rounded-xl text-xs font-black gap-1.5 text-destructive border-destructive/30"><Ban className="h-3.5 w-3.5" /> Suspender</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => { setReviewingJournalId(null); setReviewNote(""); }} className="h-9 rounded-xl text-xs font-bold">Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReviewingJournalId(j.id)} className="h-9 rounded-xl text-xs font-black w-full">Revisar</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 5. COMUNICAÇÃO: BANNERS E MEGAFONE */}
          <TabsContent value="announcements" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><LayoutDashboard className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Gerenciamento de Banners</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Injete cards destacados diretamente no feed de todos os alunos</p></div>
            </div>

            <div className="bg-muted/10 border border-border/40 rounded-[28px] p-6 sm:p-8 space-y-6">
              <div className="flex gap-2 bg-background p-1.5 rounded-[20px] w-fit border border-border/30 shadow-sm">
                {(["notice", "news", "poll"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setAnnType(t)} className={cn("px-5 py-2.5 rounded-[16px] text-xs font-black uppercase tracking-wider transition-all", annType === t ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                    {t === "notice" ? "Aviso Curto" : t === "news" ? "Notícia com Link" : "Enquete Aberta"}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <Input placeholder="Ex: Novo edital de monitoria publicado na UFAL..." value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="h-14 rounded-[20px] bg-background border-border/40 font-black text-base focus-visible:ring-primary shadow-sm" />
                <Textarea placeholder="Explique os detalhes para a rede de estudantes. (Ex: Inscrições abertas até dia 20 para o curso de Economia...)" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} className="rounded-[20px] resize-none bg-background border-border/40 font-medium focus-visible:ring-primary p-4 text-sm shadow-sm" />

                {annType !== "poll" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input placeholder="Texto do Botão (Ex: Acessar Edital)" value={annCtaLabel} onChange={(e) => setAnnCtaLabel(e.target.value)} className="h-12 rounded-[16px] bg-background border-border/40 text-xs font-bold" />
                    <Input placeholder="Link de Destino (https://...)" value={annCtaUrl} onChange={(e) => setAnnCtaUrl(e.target.value)} className="h-12 rounded-[16px] bg-background border-border/40 text-xs font-bold" />
                  </div>
                ) : (
                  <div className="space-y-2 p-4 bg-background border border-border/30 rounded-[20px]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opções de Voto</p>
                    {annOptions.map((opt, i) => (
                      <Input key={i} placeholder={`Opção ${i + 1}`} value={opt} onChange={(e) => { const next = [...annOptions]; next[i] = e.target.value; setAnnOptions(next); }} className="h-10 text-xs rounded-xl" />
                    ))}
                    {annOptions.length < 5 && (
                      <Button size="sm" variant="ghost" onClick={() => setAnnOptions([...annOptions, ""])} className="text-xs font-black">+ Opção</Button>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleCreateAnnouncement} disabled={savingAnn} className="h-12 px-6 rounded-[20px] font-black text-xs gap-2">
                    {savingAnn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publicar no Feed
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {announcements.map((a) => (
                <Card key={a.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                  <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0">{a.type}</Badge>
                        <h4 className="font-black text-sm truncate">{a.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">{a.body}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="icon" variant={a.is_active ? "default" : "secondary"} className="h-8 w-8 rounded-full" onClick={() => handleToggleAnnouncement(a.id, a.is_active)} title={a.is_active ? "Desativar" : "Ativar"}><Power className="h-4 w-4" /></Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => handleDeleteAnnouncement(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 6. MEGAFONE NOTIFICAÇÃO PUSH */}
          <TabsContent value="broadcast" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><Megaphone className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Megafone Institucional</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Disparo de alertas e notificações em massa para todos os estudantes</p></div>
            </div>

            <div className="bg-muted/10 border border-border/40 rounded-[28px] p-6 sm:p-8 space-y-4 max-w-xl">
              <Input placeholder="Título do Alerta (Ex: Manutenção Programada do Sistema)" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="h-14 rounded-[20px] bg-background border-border/40 font-black text-base focus-visible:ring-primary shadow-sm" />
              <Textarea placeholder="Mensagem completa que aparecerá na central de notificações de todos os usuários..." value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} rows={4} className="rounded-[20px] resize-none bg-background border-border/40 font-medium focus-visible:ring-primary p-4 text-sm shadow-sm" />
              <div className="flex justify-end pt-2">
                <Button onClick={handleSendPromo} disabled={sendingPromo} className="h-12 px-6 rounded-[20px] font-black text-xs gap-2">
                  {sendingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Disparar Alerta Geral
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 7. MODERAÇÃO DE DENÚNCIAS */}
          <TabsContent value="reports" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-destructive/10 rounded-xl flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div><h3 className="font-black text-lg">Fila de Moderação</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Denúncias ativas realizadas pela comunidade estudantil</p></div>
            </div>

            {reports.length === 0 && contentReports.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />} text="Nenhuma denúncia pendente! Comunidade segura e em paz." />
            ) : (
              <div className="space-y-4">
                {reports.map((r) => (
                  <Card key={r.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-[9px] font-black uppercase px-2 py-0">Postagem</Badge>
                          <span className="text-xs font-black text-foreground">Motivo: {r.reason || "Não especificado"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/20 p-2.5 rounded-xl border border-border/20 font-medium">{r.posts?.content || "Post indisponível ou já excluído"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 text-xs font-bold rounded-xl" onClick={() => handleResolveReport(r.id, "ignore")}>Ignorar</Button>
                        <Button size="sm" variant="destructive" className="flex-1 sm:flex-none h-9 text-xs font-black rounded-xl" onClick={() => handleResolveReport(r.id, "delete_post", r.post_id)}>Excluir Post</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {contentReports.map((r) => (
                  <Card key={r.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-[9px] font-black uppercase px-2 py-0">{REPORT_TARGET_LABEL[r.target_type] || r.target_type}</Badge>
                          <span className="text-xs font-black text-foreground">Motivo: {r.reason || "Não especificado"}</span>
                        </div>
                        {r._preview && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/20 p-2.5 rounded-xl border border-border/20 font-medium">{r._preview}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 text-xs font-bold rounded-xl" onClick={() => handleResolveContentReport(r, "dismiss")}>Ignorar</Button>
                        <Button size="sm" variant="destructive" className="flex-1 sm:flex-none h-9 text-xs font-black rounded-xl" onClick={() => handleResolveContentReport(r, "delete_content")}>Excluir Conteúdo</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 8. FEEDBACKS DA COMUNIDADE */}
          <TabsContent value="feedbacks" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><MessageSquare className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Central de Feedbacks</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Opiniões, ideias e relatos enviados por estudantes</p></div>
            </div>

            {feedbacks.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-10 w-10" />} text="Nenhum feedback recebido até o momento." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {feedbacks.map((f) => (
                  <Card key={f.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0 border-0">{f.category || "Geral"}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => handleDismissFeedback(f.id)}><CheckCircle2 className="h-4 w-4" /></Button>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-relaxed">{f.message}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(f.created_at).toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 9. LOG DE AUDITORIA */}
          <TabsContent value="audit" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Registro de Auditoria Master</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Rastreamento de todas as ações administrativas executadas</p></div>
            </div>

            {auditLog.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-10 w-10" />} text="Nenhuma ação administrativa registrada no log." />
            ) : (
              <div className="space-y-2">
                {auditLog.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/20 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <Activity className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold truncate text-foreground">{log.action}</p>
                        <p className="text-[10px] text-muted-foreground truncate">Por: {adminNames[log.admin_id] || "Administrador Master"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground shrink-0 pl-2">{new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="h-14 w-14 rounded-3xl bg-muted/30 flex items-center justify-center text-muted-foreground/60">{icon}</div>
      <p className="text-xs font-bold text-muted-foreground max-w-xs">{text}</p>
    </div>
  );
}
