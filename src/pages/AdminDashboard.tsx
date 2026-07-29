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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ShieldCheck,
  Users,
  MessageSquare,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Ban,
  Megaphone,
  Send,
  Search,
  Sparkles,
  BarChart3,
  Plus,
  Power,
  X,
  Crown,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  const [usersCount, setUsersCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  const [promoTitle, setPromoTitle] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [sendingPromo, setSendingPromo] = useState(false);

  const [searchUser, setSearchUser] = useState("");

  // Anúncios do dashboard
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annType, setAnnType] = useState<"notice" | "news" | "poll">("notice");
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaUrl, setAnnCtaUrl] = useState("");
  const [annOptions, setAnnOptions] = useState<string[]>(["", ""]);
  const [savingAnn, setSavingAnn] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: isAdmin, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
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

      const { data: feedData, error: feedError } = await supabase.from("feedbacks").select("*").order("created_at", { ascending: false });
      if (feedError) throw feedError;
      setFeedbacks(feedData || []);

      const { data: repData, error: repError } = await supabase.from("post_reports").select("*, posts(*)").eq("status", "pending");
      if (repError) throw repError;
      setReports(repData || []);

      const { data: profilesData, error: usersError } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
      if (usersError) throw usersError;
      setUsersList(profilesData || []);

      const { data: annData } = await supabase.from("admin_announcements").select("*").order("created_at", { ascending: false });
      setAnnouncements(annData || []);

      const { data: rolesData } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      setAdminIds(new Set((rolesData || []).map((r: any) => r.user_id)));

    } catch (error) {
      console.error("Erro Adm:", error);
      toast({ title: "Erro ao carregar painel", description: "Não foi possível buscar os dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePost(reportId: string, postId: string) {
    if (!window.confirm("Isso apagará a publicação da rede permanentemente. Confirmar?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      await supabase.from("post_reports").update({ status: "resolved" }).eq("id", reportId);
      setReports(reports.filter(r => r.id !== reportId));
      toast({ title: "Publicação Excluída", description: "A rede foi higienizada." });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível deletar o post.", variant: "destructive" });
    }
  }

  async function handleIgnoreReport(reportId: string) {
    try {
      await supabase.from("post_reports").update({ status: "dismissed" }).eq("id", reportId);
      setReports(reports.filter(r => r.id !== reportId));
      toast({ title: "Denúncia Ignorada" });
    } catch {
      toast({ title: "Erro ao ignorar denúncia", variant: "destructive" });
    }
  }

  async function deleteFeedback(id: string) {
    try {
      await supabase.from("feedbacks").delete().eq("id", id);
      setFeedbacks(feedbacks.filter(f => f.id !== id));
      toast({ title: "Feedback arquivado com sucesso." });
    } catch {
      toast({ title: "Erro ao remover feedback", variant: "destructive" });
    }
  }

  async function handleBanUser(userId: string, currentStatus: boolean) {
    if (userId === user?.id) {
      toast({ title: "Ação bloqueada", description: "Você não pode banir sua própria conta.", variant: "destructive" });
      return;
    }
    const action = currentStatus ? "Desbanir" : "Banir";
    if (!window.confirm(`Deseja realmente ${action} este usuário da plataforma?`)) return;
    try {
      await supabase.from("profiles").update({ is_banned: !currentStatus }).eq("user_id", userId);
      setUsersList(usersList.map(u => u.user_id === userId ? { ...u, is_banned: !currentStatus } : u));
      toast({ title: currentStatus ? "Acesso Restaurado" : "Usuário Banido", variant: currentStatus ? "default" : "destructive" });
    } catch {
      toast({ title: "Erro ao atualizar usuário", variant: "destructive" });
    }
  }

  async function sendGlobalNotification() {
    if (!promoTitle.trim() || !promoMessage.trim()) return;
    setSendingPromo(true);
    try {
      const { data: users, error } = await supabase.from("profiles").select("user_id");
      if (error) throw error;
      if (!users || users.length === 0) throw new Error("Nenhum usuário encontrado");

      const notifications = users.map(u => ({
        user_id: u.user_id,
        title: `📢 AVISO OFICIAL: ${promoTitle}`,
        content: promoMessage,
        type: "system",
        is_read: false
      }));

      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error } = await supabase.from("notifications").insert(chunk);
        if (error) throw error;
      }
      toast({ title: "Megafone Disparado 🚀", description: "Aviso enviado para toda a rede." });
      setPromoTitle("");
      setPromoMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingPromo(false);
    }
  }

  async function createAnnouncement() {
    if (!annTitle.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSavingAnn(true);
    try {
      const payload: any = {
        title: annTitle.trim(), body: annBody.trim() || null, type: annType, cta_label: annCtaLabel.trim() || null, cta_url: annCtaUrl.trim() || null, created_by: user?.id, active: true,
      };
      if (annType === "poll") {
        const opts = annOptions.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) {
          toast({ title: "Enquete precisa de ao menos 2 opções", variant: "destructive" });
          setSavingAnn(false); return;
        }
        payload.poll_options = opts;
      }
      const { data, error } = await supabase.from("admin_announcements").insert(payload).select().single();
      if (error) throw error;
      setAnnouncements([data, ...announcements]);
      setAnnTitle(""); setAnnBody(""); setAnnCtaLabel(""); setAnnCtaUrl(""); setAnnOptions(["", ""]);
      toast({ title: "Publicado no Dashboard ✨" });
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally { setSavingAnn(false); }
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
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    if (userId === user?.id && isAdmin) {
      toast({ title: "Ação bloqueada", description: "Você não pode remover seu próprio acesso admin.", variant: "destructive" });
      return;
    }
    if (!window.confirm(isAdmin ? "Remover acesso de administrador?" : "Conceder acesso de administrador a este usuário? Isso dará a ele controle total do painel.")) return;
    try {
      if (isAdmin) {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        const next = new Set(adminIds); next.delete(userId); setAdminIds(next);
        toast({ title: "Privilégios de Admin removidos." });
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
        const next = new Set(adminIds); next.add(userId); setAdminIds(next);
        toast({ title: "Usuário promovido a Admin 👑" });
      }
    } catch (e: any) { toast({ title: "Erro ao atualizar permissão", description: e.message, variant: "destructive" }); }
  }

  const filteredUsers = usersList.filter((u) => !searchUser.trim() ? true : (u.full_name || "").toLowerCase().includes(searchUser.toLowerCase()));

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
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Denúncias Ativas</p><p className="text-3xl font-black leading-none">{reports.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        {/* NAVEGAÇÃO SUPERIOR (PILLS) */}
        <ScrollArea className="w-full mb-6">
          <TabsList className="w-full justify-start rounded-[24px] bg-transparent p-0 flex gap-2 h-auto">
            <TabsTrigger value="users" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted/40 text-muted-foreground transition-all"><LayoutDashboard className="h-4 w-4" /> Banners</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-full font-bold text-sm h-11 px-5 gap-2 data-[state=active]:bg-destructive data-[state=active]:text-white bg-muted/40 text-muted-foreground transition-all"><AlertTriangle className="h-4 w-4" /> Denúncias {reports.length > 0 && <span className="bg-white text-destructive rounded-full px-2 py-0.5 text-[10px] ml-1">{reports.length}</span>}</TabsTrigger>
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

        {/* 3. DENÚNCIAS */}
        <TabsContent value="reports" className="space-y-4 animate-in fade-in">
          {reports.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />} text="O ecossistema está limpo e seguro." />
          ) : (
            reports.map((r) => (
              <Card key={r.id} className="rounded-[28px] border border-destructive/30 bg-destructive/5 shadow-sm">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-destructive/20 pb-3">
                    <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="font-black uppercase tracking-widest text-[11px]">{r.reason || "Violação de Termos"}</span></div>
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
