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

import {
  ShieldCheck, Users, MessageSquare, AlertTriangle, Loader2, ArrowLeft, CheckCircle2,
  Trash2, Ban, Megaphone, Send, Search, Sparkles, Plus, Power, X, Crown, LayoutDashboard,
  MapPin, ImagePlus, Building2, BadgeCheck, GraduationCap, Briefcase, FileText, UtensilsCrossed,
  FlaskConical, ClipboardList, Archive, ArchiveRestore, UserMinus, ChevronDown, ChevronRight, Flag
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

  const [loading, setLoading] = useState(true);

  // Dados Gerais
  const [usersCount, setUsersCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState("");

  // Megafone
  const [promoTitle, setPromoTitle] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [sendingPromo, setSendingPromo] = useState(false);

  // Banners
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annType, setAnnType] = useState<"notice" | "news" | "poll">("notice");
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaUrl, setAnnCtaUrl] = useState("");
  const [annOptions, setAnnOptions] = useState<string[]>(["", ""]);
  const [savingAnn, setSavingAnn] = useState(false);

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

  // Selos de Verificação Institucional
  const [badgeMap, setBadgeMap] = useState<Map<string, string[]>>(new Map());
  const [badgeSearch, setBadgeSearch] = useState("");
  const [badgeRoleToGrant, setBadgeRoleToGrant] = useState<string>("student_verified");

  // Denúncias Ampliadas e Auditoria
  const [contentReports, setContentReports] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  // Moderação de Comunidades
  const [communitiesList, setCommunitiesList] = useState<any[]>([]);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);
  const [communityMembers, setCommunityMembers] = useState<Record<string, any[]>>({});

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId) || null;

  // Função de Auditoria
  async function audit(action: string, targetType?: string, targetId?: string, details?: Record<string, any>) {
    try {
      await supabase.rpc("log_admin_action", {
        _action: action,
        _target_type: targetType ?? null,
        _target_id: targetId ?? null,
        _details: details ?? null,
      } as any);
    } catch (e) {
      console.error("Falha ao registrar log de auditoria:", e);
    }
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: isAdmin, error } = await supabase.rpc("is_admin");
      if (error || !isAdmin) {
        toast({
          title: "Acesso Negado 🚫",
          description: "Área restrita a administradores.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      loadAdminData();
    })();
  }, [user]);

  async function loadAdminData() {
    setLoading(true);
    try {
      const { count, error: countError } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      if (countError) throw countError;
      setUsersCount(count || 0);

      const { data: feedData } = await supabase.from("feedbacks").select("*").order("created_at", { ascending: false });
      setFeedbacks(feedData || []);

      const { data: repData } = await supabase.from("post_reports").select("*, posts(*)").eq("status", "pending");
      setReports(repData || []);

      const { data: profilesData } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
      setUsersList(profilesData || []);

      const { data: annData } = await supabase.from("admin_announcements").select("*").order("created_at", { ascending: false });
      setAnnouncements(annData || []);

      const { data: rolesData } = await supabase.from("user_roles").select("user_id,role");
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

      const { data: campusesData } = await supabase.from("campuses").select("*").order("name", { ascending: true });
      setCampuses(campusesData || []);
      if (campusesData && campusesData.length > 0 && !selectedCampusId) {
        setSelectedCampusId(campusesData[0].id);
      }

      await loadContentReports();
      await loadAuditLog();
      await loadCommunities();

    } catch (error) {
      console.error("Erro Adm:", error);
      toast({ title: "Erro ao carregar painel", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Mapa do Campus (Lógica URL assinada mantida do seu código)
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

  // Denúncias Ampliadas
  async function loadContentReports() {
    const { data, error } = await supabase.from("content_reports").select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (error) return;
    const list = data || [];
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
  }

  async function resolveContentReport(id: string, resolution: "resolved" | "dismissed") {
    try {
      await supabase.from("content_reports").update({ status: resolution }).eq("id", id);
      setContentReports((prev) => prev.filter((r) => r.id !== id));
      await audit(resolution === "resolved" ? "content_report_resolved" : "content_report_dismissed", "content_report", id);
      toast({ title: resolution === "resolved" ? "Denúncia marcada como resolvida" : "Denúncia ignorada" });
    } catch { toast({ title: "Erro ao atualizar denúncia", variant: "destructive" }); }
  }

  // Log de Auditoria
  async function loadAuditLog() {
    const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    setAuditLog(data || []);
    const ids = Array.from(new Set((data || []).map((l: any) => l.admin_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || "Admin"; });
      setAdminNames(map);
    }
  }

  // Selos
  async function grantBadge(userId: string, role: string) {
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
      setBadgeMap((prev) => { const next = new Map(prev); next.set(userId, [...(next.get(userId) ?? []), role]); return next; });
      await audit("badge_granted", "user", userId, { role });
      toast({ title: `Selo "${BADGE_ROLES[role]?.label}" concedido! ✅` });
    } catch (e: any) { toast({ title: "Erro ao conceder selo", variant: "destructive" }); }
  }

  async function revokeBadge(userId: string, role: string) {
    try {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) throw error;
      setBadgeMap((prev) => { const next = new Map(prev); next.set(userId, (next.get(userId) ?? []).filter((r) => r !== role)); return next; });
      await audit("badge_revoked", "user", userId, { role });
      toast({ title: "Selo removido." });
    } catch (e: any) { toast({ title: "Erro ao remover selo", variant: "destructive" }); }
  }

  // Comunidades
  async function loadCommunities() {
    const { data } = await supabase.from("communities").select("*").order("member_count", { ascending: false });
    setCommunitiesList(data || []);
  }

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
      toast({ title: next === "archived" ? "Comunidade arquivada." : "Comunidade reativada." });
    } catch (e: any) { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  }

  async function removeCommunityMember(communityId: string, membershipId: string, memberUserId: string) {
    if (!window.confirm("Remover este integrante da comunidade?")) return;
    try {
      await supabase.from("community_members").delete().eq("id", membershipId);
      setCommunityMembers((prev) => ({ ...prev, [communityId]: (prev[communityId] || []).filter((m) => m.id !== membershipId) }));
      setCommunitiesList((prev) => prev.map((c) => c.id === communityId ? { ...c, member_count: Math.max(0, (c.member_count || 1) - 1) } : c));
      await audit("community_member_removed", "community", communityId, { removed_user_id: memberUserId });
      toast({ title: "Integrante removido." });
    } catch (e: any) { toast({ title: "Erro ao remover", variant: "destructive" }); }
  }

  // Ações do Mapa
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
      toast({ title: "Mapa do campus atualizado! 🗺️" });
    } catch { toast({ title: "Erro ao subir o mapa", variant: "destructive" }); } 
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
      setPendingPin(null); setBlockName(""); setBlockDescription("");
      await audit("campus_block_created", "campus_block", data.id, { name: blockName.trim() });
      toast({ title: "Bloco cadastrado no mapa!" });
    } catch { toast({ title: "Erro ao cadastrar bloco", variant: "destructive" }); } 
    finally { setSavingBlock(false); }
  }

  async function handleDeleteBlock(id: string) {
    if (!window.confirm("Remover este bloco do mapa do campus?")) return;
    try {
      await supabase.from("campus_blocks").delete().eq("id", id);
      setCampusBlocks((prev) => prev.filter((b) => b.id !== id));
      await audit("campus_block_deleted", "campus_block", id);
    } catch { toast({ title: "Erro ao remover bloco", variant: "destructive" }); }
  }

  // Demais Ações (Posts, Bans, etc)
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
      toast({ title: "Feedback arquivado com sucesso." });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  }

  async function handleBanUser(userId: string, currentStatus: boolean) {
    if (userId === user?.id) { toast({ title: "Ação bloqueada", variant: "destructive" }); return; }
    const action = currentStatus ? "Desbanir" : "Banir";
    if (!window.confirm(`Deseja realmente ${action} este usuário?`)) return;
    try {
      await supabase.from("profiles").update({ is_banned: !currentStatus }).eq("user_id", userId);
      setUsersList(usersList.map(u => u.user_id === userId ? { ...u, is_banned: !currentStatus } : u));
      await audit(currentStatus ? "user_unbanned" : "user_banned", "user", userId);
      toast({ title: currentStatus ? "Acesso Restaurado" : "Usuário Banido", variant: currentStatus ? "default" : "destructive" });
    } catch { toast({ title: "Erro ao atualizar usuário", variant: "destructive" }); }
  }

  async function sendGlobalNotification() {
    if (!promoTitle.trim() || !promoMessage.trim()) return;
    setSendingPromo(true);
    try {
      const { data: users } = await supabase.from("profiles").select("user_id");
      if (!users || users.length === 0) throw new Error("Nenhum usuário encontrado");
      const notifications = users.map(u => ({
        user_id: u.user_id, title: `📢 AVISO OFICIAL: ${promoTitle}`, content: promoMessage, type: "system", is_read: false
      }));
      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        await supabase.from("notifications").insert(notifications.slice(i, i + chunkSize));
      }
      await audit("global_broadcast_sent", undefined, undefined, { title: promoTitle, recipients: users.length });
      toast({ title: "Megafone Disparado 🚀" });
      setPromoTitle(""); setPromoMessage("");
    } catch { toast({ title: "Erro ao enviar", variant: "destructive" }); } 
    finally { setSendingPromo(false); }
  }

  async function createAnnouncement() {
    if (!annTitle.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSavingAnn(true);
    try {
      let formattedUrl = annCtaUrl.trim();
      if (formattedUrl && !formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = `https://${formattedUrl}`;
      }
      const payload: any = {
        title: annTitle.trim(), body: annBody.trim() || null, type: annType,
        cta_label: annCtaLabel.trim() || null, cta_url: formattedUrl || null, created_by: user?.id, active: true,
      };
      if (annType === "poll") {
        const opts = annOptions.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) { toast({ title: "Enquete precisa de 2 opções", variant: "destructive" }); setSavingAnn(false); return; }
        payload.poll_options = opts;
      }
      const { data, error } = await supabase.from("admin_announcements").insert(payload).select().single();
      if (error) throw error;
      setAnnouncements([data, ...announcements]);
      setAnnTitle(""); setAnnBody(""); setAnnCtaLabel(""); setAnnCtaUrl(""); setAnnOptions(["", ""]);
      toast({ title: "Publicado no Dashboard ✨" });
    } catch { toast({ title: "Erro ao publicar", variant: "destructive" }); } 
    finally { setSavingAnn(false); }
  }

  async function toggleAnnouncement(id: string, current: boolean) {
    try {
      await supabase.from("admin_announcements").update({ active: !current }).eq("id", id);
      setAnnouncements(announcements.map((a) => (a.id === id ? { ...a, active: !current } : a)));
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm("Remover este anúncio do Dashboard permanentemente?")) return;
    try {
      await supabase.from("admin_announcements").delete().eq("id", id);
      setAnnouncements(announcements.filter((a) => a.id !== id));
      toast({ title: "Anúncio removido." });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
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

  const filteredUsers = usersList.filter((u) => !searchUser.trim() ? true : (u.full_name || "").toLowerCase().includes(searchUser.toLowerCase()));
  const filteredBadgeUsers = usersList.filter((u) => !badgeSearch.trim() ? true : (u.full_name || "").toLowerCase().includes(badgeSearch.toLowerCase()));
  const totalPendingReports = reports.length + contentReports.length;

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Acessando Centro de Comando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pb-28 animate-in fade-in duration-500">
      
      {/* HEADER DE COMANDO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/30">
        <div className="flex items-center gap-3">
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
          <Button
            onClick={() => navigate("/admin/institutions")}
            variant="outline"
            className="rounded-2xl font-black text-xs h-11 px-4 gap-2 ml-auto"
          >
            <LayoutDashboard className="h-4 w-4" /> Universidades / Campus / Cursos
          </Button>
        </div>
      </header>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-[24px] border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Users className="h-6 w-6" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total de Alunos</p><p className="text-3xl font-black leading-none">{usersCount}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><MessageSquare className="h-6 w-6" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Feedbacks</p><p className="text-3xl font-black leading-none">{feedbacks.length}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0"><AlertTriangle className="h-6 w-6" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Denúncias Ativas</p><p className="text-3xl font-black leading-none">{totalPendingReports}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        {/* NAVEGAÇÃO SUPERIOR (PILLS) */}
        <ScrollArea className="w-full mb-6">
          <TabsList className="w-full justify-start rounded-[24px] bg-transparent p-0 flex gap-2 h-auto">
            <TabsTrigger value="users" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="badges" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><BadgeCheck className="h-4 w-4" /> Selos</TabsTrigger>
            <TabsTrigger value="map" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><MapPin className="h-4 w-4" /> Mapa do Campus</TabsTrigger>
            <TabsTrigger value="communities" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><Users className="h-4 w-4" /> Comunidades</TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><LayoutDashboard className="h-4 w-4" /> Banners</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-destructive data-[state=active]:text-white bg-muted/40 text-muted-foreground transition-all"><AlertTriangle className="h-4 w-4" /> Denúncias {totalPendingReports > 0 && <span className="bg-white text-destructive rounded-full px-2 py-0.5 text-[10px] ml-1">{totalPendingReports}</span>}</TabsTrigger>
            <TabsTrigger value="audit" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><ClipboardList className="h-4 w-4" /> Auditoria</TabsTrigger>
            <TabsTrigger value="feedbacks" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><MessageSquare className="h-4 w-4" /> Avaliações</TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><Megaphone className="h-4 w-4" /> Megafone</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>

        {/* 1. GESTÃO DE USUÁRIOS */}
        <TabsContent value="users" className="space-y-4 animate-in fade-in">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Localizar aluno por nome..." className="pl-14 h-14 rounded-[24px] bg-card border-0 shadow-sm text-base font-medium focus-visible:ring-primary transition-all" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="md:col-span-2"><EmptyState icon={<Users className="h-10 w-10" />} text="Nenhum usuário localizado no banco de dados." /></div>
            ) : (
              filteredUsers.map((u) => (
                <Card key={u.user_id} className={cn("rounded-[28px] border-0 shadow-sm transition-all", u.is_banned ? "bg-destructive/5 opacity-80" : "bg-card")}>
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
        <TabsContent value="badges" className="space-y-4 animate-in fade-in">
          <Card className="rounded-[28px] border-0 bg-card shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><BadgeCheck className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-black text-lg">Verificação Institucional</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Conceda os selos que aparecem no Connect</p></div>
              </div>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input value={badgeSearch} onChange={(e) => setBadgeSearch(e.target.value)} placeholder="Localizar aluno por nome..." className="pl-14 h-14 rounded-[24px] bg-muted/30 border-0 shadow-sm text-base font-medium focus-visible:ring-primary transition-all" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBadgeUsers.length === 0 ? (
              <div className="md:col-span-2"><EmptyState icon={<Users className="h-10 w-10" />} text="Nenhum usuário encontrado." /></div>
            ) : (
              filteredBadgeUsers.map((u) => {
                const userBadges = badgeMap.get(u.user_id) ?? [];
                return (
                  <Card key={u.user_id} className="rounded-[28px] border-0 bg-card shadow-sm">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border border-border/30 shrink-0">
                          <AvatarImage src={u.avatar_url} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary font-black">{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-sm truncate">{u.full_name || "Perfil Pendente"}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
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
                      <div className="flex gap-2">
                        <Select value={badgeRoleToGrant} onValueChange={setBadgeRoleToGrant}>
                          <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-0 text-xs font-bold flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(BADGE_ROLES).map(([role, meta]) => (
                              <SelectItem key={role} value={role}>{meta.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-10 rounded-xl font-black text-xs shrink-0"
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

        {/* 1.5 MAPA DO CAMPUS — foto + blocos (RU, biblioteca, institutos...) */}
        <TabsContent value="map" className="space-y-5 animate-in fade-in">
          <Card className="rounded-[32px] border-0 bg-card shadow-md">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-black text-lg">Mapa do Campus</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Suba a foto do mapa e clique nela para cadastrar cada bloco</p></div>
              </div>

              {campuses.length === 0 ? (
                <EmptyState icon={<Building2 className="h-10 w-10" />} text="Nenhum campus cadastrado ainda. Cadastre um campus antes de configurar o mapa." />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campus</p>
                    <Select value={selectedCampusId} onValueChange={setSelectedCampusId}>
                      <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-0 font-bold"><SelectValue placeholder="Selecione um campus" /></SelectTrigger>
                      <SelectContent>
                        {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCampus && (
                    <>
                      {!selectedCampus.map_image_url ? (
                        <label className="flex flex-col items-center justify-center gap-3 h-56 rounded-[24px] border-2 border-dashed border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-all">
                          {uploadingMap ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImagePlus className="h-8 w-8 text-muted-foreground/50" />}
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{uploadingMap ? "Enviando..." : "Enviar foto do mapa do campus"}</p>
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingMap} onChange={(e) => e.target.files?.[0] && handleMapUpload(e.target.files[0])} />
                        </label>
                      ) : (
                        <div className="space-y-3">
                          <div
                            onClick={handleMapClick}
                            className="relative w-full rounded-[24px] overflow-hidden border border-border/40 shadow-inner cursor-crosshair select-none"
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
                            {uploadingMap ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Trocar foto do mapa
                            <input type="file" accept="image/*" className="hidden" disabled={uploadingMap} onChange={(e) => e.target.files?.[0] && handleMapUpload(e.target.files[0])} />
                          </label>

                          {/* Formulário do bloco pendente (aparece após clicar no mapa) */}
                          {pendingPin && (
                            <Card className="rounded-[20px] border border-amber-500/30 bg-amber-500/5">
                              <CardContent className="p-5 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Novo bloco na posição marcada</p>
                                <Input placeholder="Nome do bloco (ex: Bloco de Engenharia, RU, Biblioteca Central)" value={blockName} onChange={(e) => setBlockName(e.target.value)} className="h-12 rounded-xl bg-background border-0 shadow-sm font-bold" />
                                <Select value={blockCategory} onValueChange={setBlockCategory}>
                                  <SelectTrigger className="h-12 rounded-xl bg-background border-0 shadow-sm"><SelectValue /></SelectTrigger>
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
                                <Textarea placeholder="Descrição opcional (cursos ali alocados, observações...)" value={blockDescription} onChange={(e) => setBlockDescription(e.target.value)} rows={2} className="rounded-xl bg-background border-0 shadow-sm resize-none text-sm" />
                                <div className="flex gap-2">
                                  <Button onClick={handleCreateBlock} disabled={savingBlock || !blockName.trim()} className="flex-1 h-11 rounded-xl font-black">
                                    {savingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Salvar Bloco
                                  </Button>
                                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => setPendingPin(null)}><X className="h-4 w-4" /></Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Lista dos blocos já cadastrados */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Blocos cadastrados ({campusBlocks.length})</p>
                        {campusBlocks.length === 0 ? (
                          <p className="text-xs text-muted-foreground font-medium">Nenhum bloco marcado no mapa ainda.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {campusBlocks.map((b) => (
                              <div key={b.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-xl px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">{b.name}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{b.category}</p>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shrink-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 1.7 MODERAÇÃO DE COMUNIDADES */}
        <TabsContent value="communities" className="space-y-3 animate-in fade-in">
          {communitiesList.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} text="Nenhuma comunidade criada ainda." />
          ) : (
            communitiesList.map((c) => (
              <Card key={c.id} className="rounded-[24px] border-0 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <button onClick={() => toggleCommunityExpand(c.id)} className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {expandedCommunityId === c.id ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-black text-sm truncate flex items-center gap-2">
                          {c.name}
                          {c.status === "archived" && <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[9px]">Arquivada</Badge>}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{c.type} · {c.member_count ?? 0} integrantes</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-xl font-black text-[11px] gap-1.5 shrink-0"
                      onClick={(e) => { e.stopPropagation(); toggleCommunityStatus(c.id, c.status); }}
                    >
                      {c.status === "archived" ? <><ArchiveRestore className="h-3.5 w-3.5" /> Reativar</> : <><Archive className="h-3.5 w-3.5" /> Arquivar</>}
                    </Button>
                  </button>

                  {expandedCommunityId === c.id && (
                    <div className="border-t border-border/30 p-4 sm:p-5 space-y-2 bg-muted/10">
                      {!communityMembers[c.id] ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : communityMembers[c.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground font-medium text-center py-2">Nenhum integrante.</p>
                      ) : communityMembers[c.id].map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 bg-card rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={m.profiles?.avatar_url} /><AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">{m.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                            <span className="text-xs font-bold truncate">{m.profiles?.full_name || "Estudante"}</span>
                            {m.role === "admin" && <Badge variant="secondary" className="text-[8px] bg-amber-500/10 text-amber-600 border-0">Mod</Badge>}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full shrink-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => removeCommunityMember(c.id, m.id, m.user_id)}>
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* 2. DASHBOARD ANNOUNCEMENTS (BANNERS) */}
        <TabsContent value="announcements" className="space-y-6 animate-in fade-in">
          <Card className="rounded-[32px] border-0 bg-card shadow-md">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-black text-lg">Criar Banner Destacado</h3><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Visível na Home de todos os alunos</p></div>
              </div>

              <div className="flex gap-2 bg-muted/40 p-1.5 rounded-2xl w-fit">
                {(["notice", "news", "poll"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setAnnType(t)} className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all", annType === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {t === "notice" ? "Aviso Curto" : t === "news" ? "Notícia Completa" : "Enquete Interativa"}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <Input placeholder="Manchete principal..." value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="h-14 rounded-2xl bg-muted/30 border-0 font-bold text-base focus-visible:ring-primary" />
                <Textarea placeholder="Texto explicativo ou descrição detalhada..." value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} className="rounded-2xl resize-none bg-muted/30 border-0 font-medium focus-visible:ring-primary p-4 text-sm" />

                {annType !== "poll" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input placeholder="Texto do Botão (Ex: Acessar Link)" value={annCtaLabel} onChange={(e) => setAnnCtaLabel(e.target.value)} className="h-12 rounded-xl bg-muted/30 border-0 focus-visible:ring-primary" />
                    <Input placeholder="URL de Destino (https://...)" value={annCtaUrl} onChange={(e) => setAnnCtaUrl(e.target.value)} className="h-12 rounded-xl bg-muted/30 border-0 focus-visible:ring-primary" />
                  </div>
                ) : (
                  <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alternativas da Enquete</p>
                    {annOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder={`Opção ${i + 1}`} value={opt} onChange={(e) => { const next = [...annOptions]; next[i] = e.target.value; setAnnOptions(next); }} className="h-12 rounded-xl bg-background border-0 focus-visible:ring-primary shadow-sm" />
                        {annOptions.length > 2 && <Button type="button" size="icon" variant="ghost" onClick={() => setAnnOptions(annOptions.filter((_, j) => j !== i))} className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setAnnOptions([...annOptions, ""])} className="rounded-full font-bold border-dashed border-border/60 bg-transparent hover:bg-muted"><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Linha</Button>
                  </div>
                )}
              </div>

              <Button onClick={createAnnouncement} disabled={savingAnn} className="w-full h-14 rounded-2xl font-black text-base shadow-lg">
                {savingAnn ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />} Publicar Agora
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Gerenciar Banners Ativos</h3>
            {announcements.length === 0 ? (
              <EmptyState icon={<LayoutDashboard className="h-10 w-10" />} text="Nenhum banner ativo no momento." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((a) => (
                  <Card key={a.id} className={cn("rounded-[24px] border-0 transition-all", a.active ? "bg-card shadow-sm" : "bg-muted/30 border border-dashed border-border/40 opacity-70")}>
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-lg text-[9px] font-black uppercase tracking-widest">{a.type === "poll" ? "Enquete" : a.type === "news" ? "Notícia" : "Aviso"}</Badge>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => toggleAnnouncement(a.id, a.active)} title={a.active ? "Pausar Banner" : "Reativar Banner"}><Power className={cn("h-4 w-4", a.active ? "text-primary" : "text-muted-foreground")} /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteAnnouncement(a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <p className="font-black text-base text-foreground leading-tight">{a.title}</p>
                      {a.body && <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{a.body}</p>}
                      <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                        {Array.isArray(a.poll_options) && a.poll_options.map((opt: string, i: number) => <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border/30">{opt}</span>)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 3. DENÚNCIAS (posts + comentários/usuários/mensagens) */}
        <TabsContent value="reports" className="space-y-4 animate-in fade-in">
          {totalPendingReports === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />} text="O ecossistema está limpo e seguro." />
          ) : (
            <>
              {reports.map((r) => (
                <Card key={`post-${r.id}`} className="rounded-[28px] border border-destructive/30 bg-destructive/5 shadow-sm">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-destructive/20 pb-3">
                      <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="font-black uppercase tracking-widest text-[11px]">Post · {r.reason || "Violação de Termos"}</span></div>
                      <span className="text-[10px] font-bold text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {r.posts && (
                      <div className="bg-background rounded-[20px] p-4 border border-border/40">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Conteúdo Denunciado:</p>
                        <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{r.posts.content || <em className="opacity-50">(Conteúdo removido pelo autor)</em>}</p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="destructive" className="rounded-xl font-black h-12 flex-1 shadow-md" onClick={() => handleDeletePost(r.id, r.post_id)}><Trash2 className="h-4 w-4 mr-2" /> Deletar Publicação</Button>
                      <Button variant="outline" className="rounded-xl font-bold h-12 flex-1 bg-background" onClick={() => handleIgnoreReport(r.id)}>Ignorar Alerta</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {contentReports.map((r) => (
                <Card key={`content-${r.id}`} className="rounded-[28px] border border-destructive/30 bg-destructive/5 shadow-sm">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-destructive/20 pb-3">
                      <div className="flex items-center gap-2 text-destructive"><Flag className="h-5 w-5" /><span className="font-black uppercase tracking-widest text-[11px]">{REPORT_TARGET_LABEL[r.target_type]} · {r.reason}</span></div>
                      <span className="text-[10px] font-bold text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="bg-background rounded-[20px] p-4 border border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        {r.target_type === "user" ? "Perfil denunciado:" : "Conteúdo denunciado:"}
                      </p>
                      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{r._preview || <em className="opacity-50">(Conteúdo indisponível)</em>}</p>
                      {r.context && <p className="text-xs text-muted-foreground mt-2 italic">"{r.context}"</p>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="destructive" className="rounded-xl font-black h-12 flex-1 shadow-md" onClick={() => resolveContentReport(r.id, "resolved")}><CheckCircle2 className="h-4 w-4 mr-2" /> Marcar Resolvida</Button>
                      <Button variant="outline" className="rounded-xl font-bold h-12 flex-1 bg-background" onClick={() => resolveContentReport(r.id, "dismissed")}>Ignorar Alerta</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* 3.5 LOG DE AUDITORIA */}
        <TabsContent value="audit" className="space-y-2 animate-in fade-in">
          {auditLog.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-10 w-10" />} text="Nenhuma ação administrativa registrada ainda." />
          ) : (
            auditLog.map((l) => (
              <Card key={l.id} className="rounded-2xl border-0 bg-card shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground">{adminNames[l.admin_id] || "Admin"} <span className="font-medium text-muted-foreground">· {l.action}</span></p>
                    {l.target_type && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{l.target_type}{l.target_id ? ` · ${l.target_id.slice(0, 8)}` : ""}</p>}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* 4. FEEDBACKS */}
        <TabsContent value="feedbacks" className="space-y-4 animate-in fade-in">
          {feedbacks.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-10 w-10" />} text="Caixa de entrada limpa." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedbacks.map((f) => (
                <Card key={f.id} className="rounded-[24px] border-0 bg-card shadow-sm">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5">{f.category || "Geral"}</Badge>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1.5">{f.is_anonymous ? "Usuário Anônimo" : f.email || "Sem e-mail cadastrado"}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteFeedback(f.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">{f.message}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-auto pt-4">{new Date(f.created_at).toLocaleDateString("pt-BR")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 5. MEGAFONE (BROADCAST) */}
        <TabsContent value="broadcast" className="space-y-4 animate-in fade-in">
          <Card className="rounded-[32px] border border-amber-500/20 bg-amber-500/5 shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
                <div className="h-12 w-12 bg-amber-500/20 rounded-2xl flex items-center justify-center"><Megaphone className="h-6 w-6 text-amber-600" /></div>
                <div><h3 className="font-black text-xl text-amber-700">Aviso Global Extremo</h3><p className="text-[10px] uppercase tracking-widest text-amber-600/80 font-bold">Esta ação notificará {usersCount} alunos instantaneamente</p></div>
              </div>
              <div className="space-y-4">
                <Input placeholder="Título do Alerta Oficial..." value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="h-14 rounded-2xl bg-background border-amber-500/30 font-black text-base focus-visible:ring-amber-500 shadow-inner" />
                <Textarea placeholder="Escreva a mensagem completa..." value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} rows={5} className="rounded-2xl resize-none bg-background border-amber-500/30 font-medium p-4 focus-visible:ring-amber-500 shadow-inner text-sm leading-relaxed" />
              </div>
              <Button onClick={sendGlobalNotification} disabled={sendingPromo || !promoTitle.trim() || !promoMessage.trim()} className="w-full h-14 rounded-2xl font-black text-base shadow-lg bg-amber-500 hover:bg-amber-600 text-white">
                {sendingPromo ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Megaphone className="h-5 w-5 mr-2" />} Disparar Megafone
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// Componente Interno de Empty State Premium
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm mt-4">
      <div className="text-muted-foreground/30 flex justify-center bg-card p-4 rounded-3xl shadow-sm">{icon}</div>
      <p className="text-sm font-black tracking-wide text-foreground px-4 text-center">{text}</p>
    </div>
  );
}
