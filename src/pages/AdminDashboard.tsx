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
  const [metrics, setMetrics] = useState({ users: 0, feedbacks: 0, reports: 0 });

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
      const [uRes, fRes, rPostRes, rContentRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("feedbacks").select("*", { count: "exact", head: true }),
        supabase.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending")
      ]);
      setMetrics({
        users: uRes.count || 0,
        feedbacks: fRes.count || 0,
        reports: (rPostRes.count || 0) + (rContentRes.count || 0)
      });
    } catch (e) {
      console.error(e);
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
    let query = (supabase as any).from("news_channels").select("*").order("created_at", { ascending: false });
    if (journalFilter !== "all") query = query.eq("status", journalFilter);
    const { data } = await query;
    setJournals(data || []);
    setLoadingTab(false);
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
      supabase
        .from("ru_restaurants")
        .select("*, campuses(name, university_id, universities(name, acronym))")
        .order("created_at", { ascending: true }),
      supabase
        .from("campuses")
        .select("id, name, city, university_id, universities(name, acronym)")
        .order("name", { ascending: true }),
    ]);
    setRuRestaurants(ruRes.data || []);
    setRuCampusOptions(campusRes.data || []);
    setLoadingTab(false);
  }

  function resetRuForm() {
    setRuForm({
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
  }

  function openRuCreateForm() {
    setRuEditingId(null);
    resetRuForm();
    setRuFormOpen(true);
  }

  function openRuEditForm(ru: any) {
    setRuEditingId(ru.id);
    setRuForm({
      campus_id: ru.campus_id ?? "",
      name: ru.name ?? "",
      description: ru.description ?? "",
      latitude: String(ru.latitude ?? ""),
      longitude: String(ru.longitude ?? ""),
      radius_meters: String(ru.radius_meters ?? "100"),
      lunch_start: (ru.lunch_start ?? "11:00").slice(0, 5),
      lunch_end: (ru.lunch_end ?? "14:00").slice(0, 5),
      dinner_start: (ru.dinner_start ?? "17:00").slice(0, 5),
      dinner_end: (ru.dinner_end ?? "19:00").slice(0, 5),
      is_open: ru.is_open ?? true,
      closed_reason: ru.closed_reason ?? "",
      notice: ru.notice ?? "",
    });
    setRuFormOpen(true);
  }

  // Botão "Usar minha localização atual" — muito mais confiável do que o admin
  // digitar coordenadas de cabeça; ele só precisa estar em pé no restaurante.
  function useMyLocationForRu() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocalização indisponível", description: "Seu navegador não suporta essa função.", variant: "destructive" });
      return;
    }
    setRuLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRuForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setRuLocating(false);
        toast({ title: "Localização capturada 📍", description: "Confira o pino no mapa antes de salvar." });
      },
      () => {
        setRuLocating(false);
        toast({ title: "Não foi possível obter sua localização", description: "Verifique a permissão de GPS do navegador.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function saveRuRestaurant() {
    if (!ruForm.campus_id) {
      toast({ title: "Escolha o campus", description: "Todo RU precisa estar vinculado a um campus.", variant: "destructive" });
      return;
    }
    const lat = parseFloat(ruForm.latitude.replace(",", "."));
    const lng = parseFloat(ruForm.longitude.replace(",", "."));
    if (!ruForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast({ title: "Preencha nome e coordenadas", description: "Nome, latitude e longitude são obrigatórios.", variant: "destructive" });
      return;
    }

    setRuSavingRestaurant(true);
    try {
      const payload = {
        campus_id: ruForm.campus_id,
        name: ruForm.name.trim(),
        description: ruForm.description.trim() || null,
        latitude: lat,
        longitude: lng,
        radius_meters: parseInt(ruForm.radius_meters, 10) || 100,
        lunch_start: ruForm.lunch_start || null,
        lunch_end: ruForm.lunch_end || null,
        dinner_start: ruForm.dinner_start || null,
        dinner_end: ruForm.dinner_end || null,
        is_open: ruForm.is_open,
        closed_reason: ruForm.is_open ? null : (ruForm.closed_reason.trim() || null),
        notice: ruForm.notice.trim() || null,
      };

      if (ruEditingId) {
        const { error } = await supabase.from("ru_restaurants").update(payload).eq("id", ruEditingId);
        if (error) throw error;
        toast({ title: "RU atualizado ✅" });
      } else {
        const { error } = await supabase.from("ru_restaurants").insert(payload);
        if (error) throw error;
        toast({ title: "RU cadastrado ✅", description: "Já aparece para os estudantes do campus escolhido." });
      }

      setRuFormOpen(false);
      setRuRestaurants([]); // força recarregar a lista com o campus/university já unidos
      await loadRuRestaurants();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setRuSavingRestaurant(false);
    }
  }

  async function deleteRuRestaurant(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Os cardápios e relatos de fila deste RU também serão apagados.`)) return;
    const { error } = await supabase.from("ru_restaurants").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setRuRestaurants((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "RU excluído" });
  }

  async function loadAnnouncements() {
    setLoadingTab(true);
    const { data } = await supabase.from("admin_announcements").select("*").order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setLoadingTab(false);
  }

  // AUDITORIA BASE
  async function audit(action: string, targetType?: string, targetId?: string, details?: Record<string, any>) {
    try {
      await (supabase as any).rpc("log_admin_action", { _action: action, _target_type: targetType ?? null, _target_id: targetId ?? null, _details: details ?? null } as any);
    } catch (e) { console.error("Falha ao registrar auditoria:", e); }
  }

  // Lógica do Mapa Assinatura
  useEffect(() => {
    if (!selectedCampusId) return;
    loadCampusBlocks(selectedCampusId);
    setPendingPin(null);
  }, [selectedCampusId]);

  useEffect(() => {
    const raw = selectedCampus?.map_image_url;
    if (!raw) { setMapSignedUrl(null); return; }
    let active = true;
    (async () => {
      const path = raw.includes("/campus-media/") ? raw.split("/campus-media/")[1].split("?")[0] : raw;
      const { data } = await supabase.storage.from("campus-media").createSignedUrl(decodeURIComponent(path), 3600);
      if (active) setMapSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { active = false; };
  }, [selectedCampus?.map_image_url]);

  async function loadCampusBlocks(campusId: string) {
    const { data } = await supabase.from("campus_blocks").select("*").eq("campus_id", campusId).order("created_at", { ascending: true });
    setCampusBlocks(data || []);
  }

  // ================= AÇÕES DIRETAS =================

  async function grantBadge(userId: string, role: string) {
    try {
      await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      setBadgeMap((prev) => { const next = new Map(prev); next.set(userId, [...(next.get(userId) ?? []), role]); return next; });
      await audit("badge_granted", "user", userId, { role });
      toast({ title: `Selo "${BADGE_ROLES[role]?.label}" concedido! ✅` });
    } catch { toast({ title: "Erro ao conceder", variant: "destructive" }); }
  }

  async function revokeBadge(userId: string, role: string) {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      setBadgeMap((prev) => { const next = new Map(prev); next.set(userId, (next.get(userId) ?? []).filter((r) => r !== role)); return next; });
      await audit("badge_revoked", "user", userId, { role });
      toast({ title: "Selo removido." });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    if (userId === user?.id && isAdmin) { toast({ title: "Ação bloqueada", variant: "destructive" }); return; }
    if (!window.confirm(isAdmin ? "Remover acesso de administrador?" : "Conceder acesso de administrador?")) return;
    try {
      if (isAdmin) {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        const next = new Set(adminIds); next.delete(userId); setAdminIds(next);
        await audit("admin_access_revoked", "user", userId);
        toast({ title: "Privilégios removidos." });
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
        const next = new Set(adminIds); next.add(userId); setAdminIds(next);
        await audit("admin_access_granted", "user", userId);
        toast({ title: "Usuário promovido a Admin 👑" });
      }
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleBanUser(userId: string, currentStatus: boolean) {
    if (userId === user?.id) return;
    if (!window.confirm(`Deseja realmente ${currentStatus ? "Desbanir" : "Banir"} este usuário?`)) return;
    try {
      await supabase.from("profiles").update({ is_banned: !currentStatus }).eq("user_id", userId);
      setUsersList(usersList.map(u => u.user_id === userId ? { ...u, is_banned: !currentStatus } : u));
      await audit(currentStatus ? "user_unbanned" : "user_banned", "user", userId);
      toast({ title: currentStatus ? "Acesso Restaurado" : "Usuário Banido", variant: currentStatus ? "default" : "destructive" });
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  }

  // --- Ações do Mapa ---
  async function handleMapUpload(file: File) {
    if (!selectedCampusId) return;
    setUploadingMap(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `campus-maps/${selectedCampusId}-${Date.now()}.${ext}`;
      await supabase.storage.from("campus-media").upload(filePath, file, { upsert: true });
      await supabase.from("campuses").update({ map_image_url: filePath }).eq("id", selectedCampusId);
      setCampuses((prev) => prev.map((c) => c.id === selectedCampusId ? { ...c, map_image_url: filePath } : c));
      await audit("campus_map_updated", "campus", selectedCampusId);
      toast({ title: "Mapa atualizado! 🗺️" });
    } catch { toast({ title: "Erro ao subir", variant: "destructive" }); } 
    finally { setUploadingMap(false); }
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setBlockName(""); setBlockCategory("bloco"); setBlockDescription("");
  }

  async function handleCreateBlock() {
    if (!selectedCampusId || !pendingPin || !blockName.trim()) return;
    setSavingBlock(true);
    try {
      const { data, error } = await supabase.from("campus_blocks").insert({
        campus_id: selectedCampusId, name: blockName.trim(), category: blockCategory,
        description: blockDescription.trim() || null, x_percent: pendingPin.x, y_percent: pendingPin.y,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      setCampusBlocks((prev) => [...prev, data]);
      setPendingPin(null);
      await audit("campus_block_created", "campus_block", data.id, { name: blockName.trim() });
      toast({ title: "Bloco cadastrado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); } 
    finally { setSavingBlock(false); }
  }

  async function handleDeleteBlock(id: string) {
    if (!window.confirm("Remover este bloco do mapa?")) return;
    try {
      await supabase.from("campus_blocks").delete().eq("id", id);
      setCampusBlocks((prev) => prev.filter((b) => b.id !== id));
      await audit("campus_block_deleted", "campus_block", id);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  // --- Moderação ---
  async function toggleCommunityExpand(communityId: string) {
    if (expandedCommunityId === communityId) { setExpandedCommunityId(null); return; }
    setExpandedCommunityId(communityId);
    if (!communityMembers[communityId]) {
      const { data } = await supabase.from("community_members").select("id,user_id,role,profiles(full_name,avatar_url)").eq("community_id", communityId);
      setCommunityMembers((prev) => ({ ...prev, [communityId]: data || [] }));
    }
  }

  async function toggleCommunityStatus(communityId: string, currentStatus: string) {
    const next = currentStatus === "archived" ? "active" : "archived";
    try {
      await supabase.from("communities").update({ status: next }).eq("id", communityId);
      setCommunitiesList((prev) => prev.map((c) => c.id === communityId ? { ...c, status: next } : c));
      await audit(next === "archived" ? "community_archived" : "community_unarchived", "community", communityId);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function removeCommunityMember(communityId: string, membershipId: string, memberUserId: string) {
    if (!window.confirm("Remover integrante?")) return;
    try {
      await supabase.from("community_members").delete().eq("id", membershipId);
      setCommunityMembers((prev) => ({ ...prev, [communityId]: (prev[communityId] || []).filter((m) => m.id !== membershipId) }));
      setCommunitiesList((prev) => prev.map((c) => c.id === communityId ? { ...c, member_count: Math.max(0, (c.member_count || 1) - 1) } : c));
      await audit("community_member_removed", "community", communityId, { removed_user_id: memberUserId });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleDeletePost(reportId: string, postId: string) {
    if (!window.confirm("Isso apagará a publicação permanentemente. Confirmar?")) return;
    try {
      await supabase.from("posts").delete().eq("id", postId);
      await supabase.from("post_reports").update({ status: "resolved" }).eq("id", reportId);
      setReports(reports.filter(r => r.id !== reportId));
      await audit("post_deleted", "post", postId, { via_report: reportId });
      toast({ title: "Publicação Excluída" });
    } catch { toast({ title: "Erro ao deletar", variant: "destructive" }); }
  }

  async function resolveContentReport(id: string, resolution: "resolved" | "dismissed") {
    try {
      await (supabase as any).from("content_reports").update({ status: resolution }).eq("id", id);
      setContentReports((prev) => prev.filter((r) => r.id !== id));
      await audit(resolution === "resolved" ? "content_report_resolved" : "content_report_dismissed", "content_report", id);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleIgnoreReport(reportId: string) {
    try {
      await supabase.from("post_reports").update({ status: "dismissed" }).eq("id", reportId);
      setReports(reports.filter(r => r.id !== reportId));
      await audit("post_report_dismissed", "post_report", reportId);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function deleteFeedback(id: string) {
    try {
      await supabase.from("feedbacks").delete().eq("id", id);
      setFeedbacks(feedbacks.filter(f => f.id !== id));
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  // --- Comunicação ---
  async function sendGlobalNotification() {
    if (!promoTitle.trim() || !promoMessage.trim()) return;
    setSendingPromo(true);
    try {
      const { data: users } = await supabase.from("profiles").select("user_id");
      if (!users || users.length === 0) throw new Error("Vazio");
      const notifications = users.map(u => ({
        user_id: u.user_id, title: `📢 AVISO OFICIAL: ${promoTitle}`, content: promoMessage, type: "system", is_read: false
      }));
      for (let i = 0; i < notifications.length; i += 100) {
        await supabase.from("notifications").insert(notifications.slice(i, i + 100));
      }
      await audit("global_broadcast_sent", undefined, undefined, { title: promoTitle, recipients: users.length });
      toast({ title: "Megafone Disparado 🚀" });
      setPromoTitle(""); setPromoMessage("");
    } catch { toast({ title: "Erro", variant: "destructive" }); } 
    finally { setSendingPromo(false); }
  }

  async function createAnnouncement() {
    if (!annTitle.trim()) return;
    setSavingAnn(true);
    try {
      let formattedUrl = annCtaUrl.trim();
      if (formattedUrl && !formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;
      const payload: any = {
        title: annTitle.trim(), body: annBody.trim() || null, type: annType,
        cta_label: annCtaLabel.trim() || null, cta_url: formattedUrl || null, created_by: user?.id, active: true,
      };
      if (annType === "poll") {
        const opts = annOptions.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) { setSavingAnn(false); return; }
        payload.poll_options = opts;
      }
      const { data, error } = await supabase.from("admin_announcements").insert(payload).select().single();
      if (error) throw error;
      setAnnouncements([data, ...announcements]);
      setAnnTitle(""); setAnnBody(""); setAnnCtaLabel(""); setAnnCtaUrl(""); setAnnOptions(["", ""]);
      toast({ title: "Publicado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); } 
    finally { setSavingAnn(false); }
  }

  async function toggleAnnouncement(id: string, current: boolean) {
    try {
      await supabase.from("admin_announcements").update({ active: !current }).eq("id", id);
      setAnnouncements(announcements.map((a) => (a.id === id ? { ...a, active: !current } : a)));
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm("Remover permanentemente?")) return;
    try {
      await supabase.from("admin_announcements").delete().eq("id", id);
      setAnnouncements(announcements.filter((a) => a.id !== id));
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  if (initialLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Iniciando Centro de Comando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-28 animate-in fade-in duration-500">
      
      {/* HEADER DE COMANDO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/30">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-muted/40 hover:bg-muted border border-border/40 shrink-0 transition-all" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Centro de Comando</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-0.5">Acesso Nível 1 · Admin</p>
            </div>
          </div>
        </div>
        <Button onClick={() => navigate("/admin/institutions")} variant="outline" className="rounded-2xl font-black text-xs h-11 px-5 shadow-sm">
          <LayoutDashboard className="h-4 w-4 mr-2" /> Universidades / Cursos
        </Button>
      </header>

      {/* ARQUITETURA PRINCIPAL: SIDEBAR + CONTEÚDO */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-8 w-full mt-6">
        
        {/* MENU LATERAL (SIDEBAR DE ABAS) */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
          
          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Visão Geral</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="overview" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Activity className="h-4 w-4" /> Dashboard</TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Gestão Escolar</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="users" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
              <TabsTrigger value="badges" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><BadgeCheck className="h-4 w-4" /> Selos</TabsTrigger>
              <TabsTrigger value="communities" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Users className="h-4 w-4" /> Comunidades</TabsTrigger>
              <TabsTrigger value="map" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><MapPin className="h-4 w-4" /> Mapa Campus</TabsTrigger>
              <TabsTrigger value="ru" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><UtensilsCrossed className="h-4 w-4" /> Restaurante (RU)</TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-1">
            <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 mb-3">Segurança & Moderação</h4>
            <TabsList className="flex flex-row lg:flex-col bg-transparent p-0 h-auto gap-1 w-full overflow-x-auto lg:overflow-visible justify-start snap-x no-scrollbar">
              <TabsTrigger value="reports" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-destructive data-[state=active]:text-white bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center">
                <AlertTriangle className="h-4 w-4" /> Denúncias 
                {metrics.reports > 0 && <span className="bg-white text-destructive rounded-full px-2 py-0.5 text-[10px] ml-auto">{metrics.reports}</span>}
              </TabsTrigger>
              <TabsTrigger value="audit" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><ClipboardList className="h-4 w-4" /> Auditoria</TabsTrigger>
              <TabsTrigger value="feedbacks" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><MessageSquare className="h-4 w-4" /> Feedbacks</TabsTrigger>
              <TabsTrigger value="journals" className="justify-start rounded-2xl font-bold text-sm h-11 px-4 gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/30 text-muted-foreground transition-all shrink-0 snap-center"><Newspaper className="h-4 w-4" /> Jornais</TabsTrigger>
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

          {/* 0. DASHBOARD (MÉTRICAS) */}
          <TabsContent value="overview" className="space-y-6 mt-0 animate-in fade-in">
            <h2 className="text-xl font-black mb-4">Visão Geral da Rede</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4"><Users className="h-6 w-6" /></div>
                  <p className="text-3xl font-black leading-none text-foreground">{metrics.users}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Alunos Cadastrados</p>
                </CardContent>
              </Card>
              <Card className="rounded-[24px] border-0 bg-muted/30 shadow-none">
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4"><MessageSquare className="h-6 w-6" /></div>
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

          {/* 1.2 SELOS DE VERIFICAÇÃO INSTITUCIONAL */}
          <TabsContent value="badges" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><BadgeCheck className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Verificação Institucional</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Conceda os selos que aparecem no Connect</p></div>
            </div>
            
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input value={badgeSearch} onChange={(e) => setBadgeSearch(e.target.value)} placeholder="Busque o perfil do servidor ou projeto..." className="pl-14 h-14 rounded-[24px] bg-muted/30 border-0 shadow-sm text-base font-medium focus-visible:ring-primary transition-all" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
              {usersList.length === 0 ? (
                <div className="xl:col-span-2"><EmptyState icon={<Users className="h-10 w-10" />} text="Nenhum usuário encontrado." /></div>
              ) : (
                usersList.map((u) => {
                  const userBadges = badgeMap.get(u.user_id) ?? [];
                  return (
                    <Card key={u.user_id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 border border-border/30 shrink-0">
                            <AvatarImage src={u.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary font-black">{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-sm truncate">{u.full_name || "Perfil Pendente"}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {userBadges.length === 0 ? (
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sem selo</span>
                              ) : userBadges.map((role) => {
                                const meta = BADGE_ROLES[role];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return (
                                  <Badge key={role} variant="secondary" className="bg-primary/10 text-primary border-0 text-[9px] font-black gap-1 pr-1">
                                    <Icon className="h-3 w-3" /> {meta.label}
                                    <button onClick={() => revokeBadge(u.user_id, role)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 bg-muted/20 p-2 rounded-2xl">
                          <Select value={badgeRoleToGrant} onValueChange={setBadgeRoleToGrant}>
                            <SelectTrigger className="h-10 rounded-xl bg-background border border-border/30 text-xs font-bold flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(BADGE_ROLES).map(([role, meta]) => (
                                <SelectItem key={role} value={role}>{meta.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="h-10 rounded-xl font-black text-xs shrink-0 px-4"
                            disabled={userBadges.includes(badgeRoleToGrant)}
                            onClick={() => grantBadge(u.user_id, badgeRoleToGrant)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Conceder
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* 1.5 MAPA DO CAMPUS */}
          <TabsContent value="map" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Mapeamento do Campus</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Gerencie os mapas interativos e as localizações</p></div>
            </div>

            {campuses.length === 0 ? (
              <EmptyState icon={<Building2 className="h-10 w-10" />} text="Nenhum campus cadastrado ainda." />
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selecione o Campus Base</p>
                  <Select value={selectedCampusId} onValueChange={setSelectedCampusId}>
                    <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-0 font-bold text-base"><SelectValue placeholder="Selecione um campus" /></SelectTrigger>
                    <SelectContent>
                      {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCampus && (
                  <div className="bg-background rounded-[24px] border border-border/30 p-4 sm:p-6 shadow-sm">
                    {!selectedCampus.map_image_url ? (
                      <label className="flex flex-col items-center justify-center gap-3 h-56 rounded-[20px] border-2 border-dashed border-border/50 bg-muted/10 cursor-pointer hover:bg-muted/30 transition-all">
                        {uploadingMap ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImagePlus className="h-8 w-8 text-muted-foreground/50" />}
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{uploadingMap ? "Enviando Planta..." : "Fazer Upload da Planta do Campus"}</p>
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingMap} onChange={(e) => e.target.files?.[0] && handleMapUpload(e.target.files[0])} />
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div
                          onClick={handleMapClick}
                          className="relative w-full rounded-[20px] overflow-hidden border border-border/40 shadow-inner cursor-crosshair select-none bg-muted/20"
                          title="Clique no mapa para marcar a posição de um novo bloco"
                        >
                          {mapSignedUrl && <img src={mapSignedUrl} alt="Mapa do campus" className="w-full h-auto block pointer-events-none" draggable={false} />}
                          {campusBlocks.map((b) => (
                            <div key={b.id} style={{ left: `${b.x_percent}%`, top: `${b.y_percent}%` }} className="absolute -translate-x-1/2 -translate-y-full group/pin">
                              <MapPin className="h-6 w-6 text-primary fill-primary/20 drop-shadow" />
                              <span className="absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap text-[10px] font-black bg-foreground text-background rounded-md px-2 py-1 opacity-0 group-hover/pin:opacity-100 transition-opacity">{b.name}</span>
                            </div>
                          ))}
                          {pendingPin && (
                            <div style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }} className="absolute -translate-x-1/2 -translate-y-full">
                              <MapPin className="h-7 w-7 text-amber-500 animate-bounce drop-shadow" />
                            </div>
                          )}
                        </div>

                        <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                          {uploadingMap ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Substituir Imagem do Mapa
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingMap} onChange={(e) => e.target.files?.[0] && handleMapUpload(e.target.files[0])} />
                        </label>

                        {/* Formulário Bloco Pendente */}
                        {pendingPin && (
                          <div className="rounded-[20px] border-2 border-amber-500/30 bg-amber-500/5 p-5 space-y-4 animate-in slide-in-from-top-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/> Configurando novo bloco nesta posição</p>
                            <Input placeholder="Nome oficial. Ex: Bloco de Economia, RU..." value={blockName} onChange={(e) => setBlockName(e.target.value)} className="h-12 rounded-xl bg-background border border-amber-500/20 shadow-sm font-bold" />
                            <Select value={blockCategory} onValueChange={setBlockCategory}>
                              <SelectTrigger className="h-12 rounded-xl bg-background border border-amber-500/20 shadow-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bloco">Bloco de aulas</SelectItem>
                                <SelectItem value="instituto">Instituto/Faculdade</SelectItem>
                                <SelectItem value="ru">Restaurante Universitário</SelectItem>
                                <SelectItem value="biblioteca">Biblioteca</SelectItem>
                                <SelectItem value="laboratorio">Laboratório</SelectItem>
                                <SelectItem value="esporte">Esporte/Ginásio</SelectItem>
                                <SelectItem value="administrativo">Administrativo</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea placeholder="Ex: Cursos que atuam ali, horários de funcionamento, ou pontos de referência." value={blockDescription} onChange={(e) => setBlockDescription(e.target.value)} rows={2} className="rounded-xl bg-background border border-amber-500/20 shadow-sm resize-none text-sm" />
                            <div className="flex gap-2">
                              <Button onClick={handleCreateBlock} disabled={savingBlock || !blockName.trim()} className="flex-1 h-11 rounded-xl font-black bg-amber-500 hover:bg-amber-600 text-white">
                                {savingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Salvar Coordenadas
                              </Button>
                              <Button variant="outline" className="h-11 rounded-xl bg-background" onClick={() => setPendingPin(null)}><X className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-border/30">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Pontos Mapeados Atualmente ({campusBlocks.length})</p>
                          {campusBlocks.length === 0 ? (
                            <p className="text-xs text-muted-foreground font-medium">O mapa ainda está em branco.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                              {campusBlocks.map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-2 bg-muted/20 border border-border/30 rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">{b.name}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{b.category}</p>
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* 1.6 RESTAURANTE UNIVERSITÁRIO (RU) — um por campus */}
          <TabsContent value="ru" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><UtensilsCrossed className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-black text-lg">Restaurantes Universitários</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Um RU por campus — cada estudante só vê o do seu</p></div>
              </div>
              <Button onClick={openRuCreateForm} className="rounded-2xl font-bold shrink-0"><Plus className="h-4 w-4 mr-1.5" /> Novo RU</Button>
            </div>

            {ruRestaurants.length === 0 ? (
              <EmptyState icon={<UtensilsCrossed className="h-10 w-10" />} text="Nenhum RU cadastrado ainda. Crie o primeiro." />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {ruRestaurants.map((ru) => (
                  <div key={ru.id} className="rounded-[24px] border border-border/30 bg-background shadow-sm p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm">{ru.name}</p>
                        <Badge variant="secondary" className={cn("text-[9px] font-black uppercase", ru.is_open ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                          {ru.is_open ? "Aberto" : "Fechado"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
                        {ru.campuses?.universities?.acronym ? `${ru.campuses.universities.acronym} · ` : ""}
                        {ru.campuses?.name ?? "Sem campus vinculado"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Almoço {ru.lunch_start?.slice(0,5) ?? "--"}–{ru.lunch_end?.slice(0,5) ?? "--"} · Jantar {ru.dinner_start?.slice(0,5) ?? "--"}–{ru.dinner_end?.slice(0,5) ?? "--"}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => openRuEditForm(ru)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => deleteRuRestaurant(ru.id, ru.name)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário de criação/edição */}
            <Dialog open={ruFormOpen} onOpenChange={setRuFormOpen}>
              <DialogContent className="max-w-lg rounded-[28px] border border-border/30 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-black">{ruEditingId ? "Editar RU" : "Novo Restaurante Universitário"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campus</Label>
                    <Select value={ruForm.campus_id} onValueChange={(v) => setRuForm((f) => ({ ...f, campus_id: v }))}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-0 font-bold"><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                      <SelectContent>
                        {ruCampusOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.universities?.acronym ? `${c.universities.acronym} · ` : ""}{c.name}{c.city ? ` — ${c.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ruCampusOptions.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">Nenhum campus cadastrado ainda — crie um campus primeiro na aba "Mapa Campus".</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome</Label>
                    <Input value={ruForm.name} onChange={(e) => setRuForm((f) => ({ ...f, name: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" placeholder="Ex: Restaurante Universitário — Campus A.C. Simões" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição (opcional)</Label>
                    <Textarea value={ruForm.description} onChange={(e) => setRuForm((f) => ({ ...f, description: e.target.value }))} className="rounded-xl bg-muted/30 border-0 font-medium min-h-[70px]" placeholder="Como chegar, observações para os estudantes..." />
                  </div>

                  {/* Coordenadas — o botão de localização evita o admin ter que descobrir lat/long na mão */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Localização (para validar quem reporta a fila)</Label>
                      <Button type="button" size="sm" variant="outline" onClick={useMyLocationForRu} disabled={ruLocating} className="h-8 rounded-lg text-[10px] font-black">
                        {ruLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <LocateFixed className="h-3.5 w-3.5 mr-1" />}
                        Usar minha localização
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={ruForm.latitude} onChange={(e) => setRuForm((f) => ({ ...f, latitude: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" placeholder="Latitude" inputMode="decimal" />
                      <Input value={ruForm.longitude} onChange={(e) => setRuForm((f) => ({ ...f, longitude: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" placeholder="Longitude" inputMode="decimal" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Dica: abra esta tela pelo celular estando no próprio RU e toque em "Usar minha localização".</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Raio de validação (metros)</Label>
                    <Input value={ruForm.radius_meters} onChange={(e) => setRuForm((f) => ({ ...f, radius_meters: e.target.value.replace(/\D/g, "") }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" inputMode="numeric" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almoço — início</Label>
                      <Input type="time" value={ruForm.lunch_start} onChange={(e) => setRuForm((f) => ({ ...f, lunch_start: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almoço — fim</Label>
                      <Input type="time" value={ruForm.lunch_end} onChange={(e) => setRuForm((f) => ({ ...f, lunch_end: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jantar — início</Label>
                      <Input type="time" value={ruForm.dinner_start} onChange={(e) => setRuForm((f) => ({ ...f, dinner_start: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jantar — fim</Label>
                      <Input type="time" value={ruForm.dinner_end} onChange={(e) => setRuForm((f) => ({ ...f, dinner_end: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3.5">
                    <div>
                      <Label className="text-xs font-bold">RU aberto normalmente</Label>
                      <p className="text-[10px] text-muted-foreground">Desative em greves, reformas ou recessos.</p>
                    </div>
                    <Switch checked={ruForm.is_open} onCheckedChange={(v) => setRuForm((f) => ({ ...f, is_open: v }))} />
                  </div>

                  {!ruForm.is_open && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo do fechamento</Label>
                      <Input value={ruForm.closed_reason} onChange={(e) => setRuForm((f) => ({ ...f, closed_reason: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" placeholder="Ex: Em reforma até 30/09" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aviso fixo (opcional)</Label>
                    <Input value={ruForm.notice} onChange={(e) => setRuForm((f) => ({ ...f, notice: e.target.value }))} className="h-12 rounded-xl bg-muted/30 border-0 font-bold" placeholder="Ex: Hoje o cardápio é especial" />
                  </div>

                  <Button onClick={saveRuRestaurant} disabled={ruSavingRestaurant} className="w-full h-12 rounded-xl font-black">
                    {ruSavingRestaurant ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {ruEditingId ? "Salvar alterações" : "Cadastrar RU"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>


          <TabsContent value="communities" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Diretório de Comunidades</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Modere espaços criados e os seus integrantes</p></div>
            </div>

            {communitiesList.length === 0 ? (
              <EmptyState icon={<Users className="h-10 w-10" />} text="Nenhuma comunidade criada ainda." />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {communitiesList.map((c) => (
                  <div key={c.id} className="rounded-[24px] border border-border/30 bg-background shadow-sm overflow-hidden">
                    <button onClick={() => toggleCommunityExpand(c.id)} className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedCommunityId === c.id ? <ChevronDown className="h-5 w-5 text-primary shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-black text-sm truncate flex items-center gap-2">
                            {c.name}
                            {c.status === "archived" && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-[9px]">Arquivada</Badge>}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{c.type} · {c.member_count ?? 0} integrantes</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn("h-9 rounded-xl font-black text-[11px] gap-1.5 shrink-0 transition-colors", c.status === "archived" ? "bg-primary/10 text-primary border-primary/20" : "")}
                        onClick={(e) => { e.stopPropagation(); toggleCommunityStatus(c.id, c.status); }}
                      >
                        {c.status === "archived" ? <><ArchiveRestore className="h-3.5 w-3.5" /> Reativar</> : <><Archive className="h-3.5 w-3.5" /> Arquivar</>}
                      </Button>
                    </button>

                    {expandedCommunityId === c.id && (
                      <div className="border-t border-border/30 p-4 sm:p-5 bg-muted/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Integrantes e Moderação</p>
                        {!communityMembers[c.id] ? (
                          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : communityMembers[c.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground font-medium text-center py-4 bg-background rounded-xl border border-dashed border-border/40">Nenhum integrante associado.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {communityMembers[c.id].map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between gap-2 bg-background border border-border/30 rounded-xl px-3 py-2.5 shadow-sm">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={m.profiles?.avatar_url} /><AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">{m.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                                  <span className="text-xs font-bold truncate">{m.profiles?.full_name || "Estudante"}</span>
                                  {m.role === "admin" && <Badge variant="secondary" className="text-[8px] bg-amber-500/10 text-amber-600 border-0">Admin / Mod</Badge>}
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeCommunityMember(c.id, m.id, m.user_id)}>
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 3. DENÚNCIAS */}
          <TabsContent value="reports" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-destructive/10 rounded-xl flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div><h3 className="font-black text-lg">Central de Denúncias</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Conteúdos, Posts e Mensagens reportadas pela comunidade</p></div>
            </div>

            {reports.length === 0 && contentReports.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />} text="O ecossistema acadêmico está limpo e seguro no momento." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {reports.map((r) => (
                  <Card key={`post-${r.id}`} className="rounded-[24px] border border-destructive/20 bg-destructive/5 shadow-none hover:border-destructive/40 transition-colors">
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-destructive/20 pb-3">
                        <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="font-black uppercase tracking-widest text-[11px]">Postagem no Feed · {r.reason || "Violação de Termos"}</span></div>
                        <span className="text-[10px] font-bold text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {r.posts && (
                        <div className="bg-background rounded-[16px] p-4 border border-border/40 shadow-inner">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Conteúdo Reportado:</p>
                          <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{r.posts.content || <em className="opacity-50">(Conteúdo já removido pelo autor original)</em>}</p>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button variant="destructive" className="rounded-xl font-black h-11 flex-1 shadow-md" onClick={() => handleDeletePost(r.id, r.post_id)}><Trash2 className="h-4 w-4 mr-2" /> Deletar Publicação Global</Button>
                        <Button variant="outline" className="rounded-xl font-bold h-11 flex-1 bg-background" onClick={() => handleIgnoreReport(r.id)}>Descartar Denúncia</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {contentReports.map((r) => (
                  <Card key={`content-${r.id}`} className="rounded-[24px] border border-amber-500/30 bg-amber-500/5 shadow-none hover:border-amber-500/50 transition-colors">
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-2 text-amber-600"><Flag className="h-5 w-5" /><span className="font-black uppercase tracking-widest text-[11px]">{REPORT_TARGET_LABEL[r.target_type]} · {r.reason}</span></div>
                        <span className="text-[10px] font-bold text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="bg-background rounded-[16px] p-4 border border-border/40 shadow-inner">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          {r.target_type === "user" ? "Perfil sob revisão:" : "Texto interceptado:"}
                        </p>
                        <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{r._preview || <em className="opacity-50">(Evidência indisponível ou já excluída)</em>}</p>
                        {r.context && <p className="text-xs text-muted-foreground mt-3 italic border-t border-border/30 pt-2">Contexto Adicional: "{r.context}"</p>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button variant="default" className="rounded-xl font-black h-11 flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-md" onClick={() => resolveContentReport(r.id, "resolved")}><CheckCircle2 className="h-4 w-4 mr-2" /> Ação Tomada / Resolvido</Button>
                        <Button variant="outline" className="rounded-xl font-bold h-11 flex-1 bg-background" onClick={() => resolveContentReport(r.id, "dismissed")}>Sem Violoção (Ignorar)</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 3.5 AUDITORIA */}
          <TabsContent value="audit" className="space-y-6 mt-0 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Log de Auditoria Interna</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Rastreabilidade das ações de todos os administradores</p></div>
            </div>
            
            {auditLog.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-10 w-10" />} text="O cofre de registros está vazio no momento." />
            ) : (
              <div className="space-y-2">
                {auditLog.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-4 bg-muted/20 border border-border/30 rounded-[16px] px-5 py-4 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground">{adminNames[l.admin_id] || "Admin Desconhecido"} <span className="font-medium text-muted-foreground">realizou a operação: </span> <span className="text-primary">{l.action}</span></p>
                      {l.target_type && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Alvo: {l.target_type}{l.target_id ? ` [ID: ${l.target_id.slice(0, 8)}]` : ""}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground block">{new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
                      <span className="text-xs font-black text-foreground block">{new Date(l.created_at).toLocaleTimeString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 4. FEEDBACKS */}
          <TabsContent value="feedbacks" className="space-y-6 mt-0 animate-in fade-in">
             <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><MessageSquare className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Avaliações da Comunidade</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Mensagens e sugestões enviadas pelos alunos</p></div>
            </div>

            {feedbacks.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-10 w-10" />} text="Nenhum feedback pendente na caixa de entrada." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {feedbacks.map((f) => (
                  <Card key={f.id} className="rounded-[24px] border border-border/30 bg-background shadow-none">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div>
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] font-black uppercase tracking-widest px-3 py-1 mb-2">{f.category || "Geral"}</Badge>
                          <p className="text-[11px] font-bold text-muted-foreground">{f.is_anonymous ? "🗣️ Autor Anônimo" : `📧 ${f.email || "Sem e-mail de contato"}`}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteFeedback(f.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="bg-muted/10 p-4 rounded-[16px] border border-border/30 flex-1">
                        <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">{f.message}</p>
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-4 text-right">{new Date(f.created_at).toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input placeholder="Texto do Botão (Ex: Ler Edital)" value={annCtaLabel} onChange={(e) => setAnnCtaLabel(e.target.value)} className="h-14 rounded-[20px] bg-background border-border/40 focus-visible:ring-primary shadow-sm" />
                    <Input placeholder="URL Oficial de Destino (https://...)" value={annCtaUrl} onChange={(e) => setAnnCtaUrl(e.target.value)} className="h-14 rounded-[20px] bg-background border-border/40 focus-visible:ring-primary shadow-sm" />
                  </div>
                ) : (
                  <div className="space-y-3 bg-background p-5 rounded-[24px] border border-border/40 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Monte as Alternativas da Enquete</p>
                    {annOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder={`Alternativa ${i + 1}`} value={opt} onChange={(e) => { const next = [...annOptions]; next[i] = e.target.value; setAnnOptions(next); }} className="h-12 rounded-[16px] bg-muted/20 border-border/40 focus-visible:ring-primary" />
                        {annOptions.length > 2 && <Button type="button" size="icon" variant="ghost" onClick={() => setAnnOptions(annOptions.filter((_, j) => j !== i))} className="h-12 w-12 rounded-[16px] text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setAnnOptions([...annOptions, ""])} className="rounded-full font-bold border-dashed border-border/60 bg-transparent hover:bg-muted mt-2"><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Mais Opções</Button>
                  </div>
                )}
              </div>

              <Button onClick={createAnnouncement} disabled={savingAnn} className="w-full h-14 rounded-[20px] font-black text-base shadow-lg hover:scale-[1.01] transition-transform">
                {savingAnn ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />} Fixar Banner na Rede
              </Button>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/30">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Histórico de Banners</h3>
              {announcements.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground italic">Nenhum banner ativo no momento.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {announcements.map((a) => (
                    <Card key={a.id} className={cn("rounded-[24px] border-0 transition-all", a.active ? "bg-muted/20 shadow-sm border border-border/30" : "bg-muted/10 border border-dashed border-border/40 opacity-70")}>
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-lg text-[9px] font-black uppercase tracking-widest">{a.type === "poll" ? "Enquete" : a.type === "news" ? "Notícia" : "Aviso"}</Badge>
                          <div className="flex gap-1 bg-background rounded-full border border-border/30 shadow-sm">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => toggleAnnouncement(a.id, a.active)} title={a.active ? "Pausar Banner" : "Reativar Banner"}><Power className={cn("h-3.5 w-3.5", a.active ? "text-primary" : "text-muted-foreground")} /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteAnnouncement(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <p className="font-black text-base text-foreground leading-tight">{a.title}</p>
                        {a.body && <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{a.body}</p>}
                        <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                          {Array.isArray(a.poll_options) && a.poll_options.map((opt: string, i: number) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-md bg-background text-muted-foreground border border-border/40 shadow-sm">{opt}</span>)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="broadcast" className="space-y-6 mt-0 animate-in fade-in">
             <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
              <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center"><Megaphone className="h-5 w-5 text-amber-600" /></div>
              <div><h3 className="font-black text-lg text-amber-600">Protocolo de Alerta Global</h3><p className="text-[10px] uppercase tracking-widest text-amber-600/80 font-bold">Mensagens Push e Notificações de Nível Vermelho</p></div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-[28px] p-6 sm:p-8 space-y-6">
              <div className="bg-amber-500/10 p-4 rounded-[16px] flex gap-3 text-amber-700/80 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed"><strong>Atenção:</strong> O disparo desta ferramenta criará um evento persistente na central de notificações de <strong>todos os {metrics.users} usuários cadastrados</strong> simultaneamente. Use apenas para comunicados emergenciais ou atualizações institucionais críticas.</p>
              </div>

              <div className="space-y-4">
                <Input placeholder="Título do Alerta (Ex: Suspensão das Aulas)" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="h-14 rounded-[20px] bg-background border border-amber-500/30 font-black text-base focus-visible:ring-amber-500 shadow-sm" />
                <Textarea placeholder="Corpo da mensagem oficial completa..." value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} rows={5} className="rounded-[20px] resize-none bg-background border border-amber-500/30 font-medium p-5 focus-visible:ring-amber-500 shadow-sm text-sm leading-relaxed" />
              </div>

              <Button onClick={sendGlobalNotification} disabled={sendingPromo || !promoTitle.trim() || !promoMessage.trim()} className="w-full h-14 rounded-[20px] font-black text-base shadow-xl hover:scale-[1.01] transition-transform bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">
                {sendingPromo ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Megaphone className="h-5 w-5 mr-2" />} Confirmar Disparo Global
              </Button>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}

// Componente Interno de Empty State Premium
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm mt-4 w-full">
      <div className="text-muted-foreground/30 flex justify-center bg-background p-5 rounded-[24px] shadow-sm">{icon}</div>
      <p className="text-sm font-black tracking-wide text-foreground px-4 text-center">{text}</p>
    </div>
  );
      }
