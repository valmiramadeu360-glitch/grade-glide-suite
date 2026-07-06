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
  Crown
} from "lucide-react";

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
          title: "Acesso Negado",
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

      const { count, error: countError } =
        await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      setUsersCount(count || 0);

      const { data: feedData, error: feedError } =
        await supabase
          .from("feedbacks")
          .select("*")
          .order("created_at", { ascending: false });

      if (feedError) throw feedError;

      setFeedbacks(feedData || []);

      const { data: repData, error: repError } =
        await supabase
          .from("post_reports")
          .select("*, posts(*)")
          .eq("status", "pending");

      if (repError) throw repError;

      setReports(repData || []);

      const { data: profilesData, error: usersError } =
        await supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true });

      if (usersError) throw usersError;

      setUsersList(profilesData || []);

      const { data: annData } = await supabase
        .from("admin_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      setAnnouncements(annData || []);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      setAdminIds(new Set((rolesData || []).map((r: any) => r.user_id)));

    } catch (error) {

      console.error("Erro Adm:", error);

      toast({
        title: "Erro ao carregar painel",
        description: "Não foi possível buscar os dados.",
        variant: "destructive"
      });

    } finally {

      setLoading(false);

    }

  }

async function handleDeletePost(reportId: string, postId: string) {

    if (!window.confirm("Isso apagará a publicação da rede. Confirmar?"))
      return;

    try {

      const { error } =
        await supabase
          .from("posts")
          .delete()
          .eq("id", postId);

      if (error) throw error;

      await supabase
        .from("post_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);

      setReports(reports.filter(r => r.id !== reportId));

      toast({
        title: "Publicação Excluída",
        description: "A rede foi higienizada."
      });

    } catch (error) {

      toast({
        title: "Erro",
        description: "Não foi possível deletar o post.",
        variant: "destructive"
      });

    }

  }

  async function handleIgnoreReport(reportId: string) {

    try {

      await supabase
        .from("post_reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);

      setReports(reports.filter(r => r.id !== reportId));

      toast({
        title: "Denúncia Ignorada"
      });

    } catch {

      toast({
        title: "Erro ao ignorar denúncia",
        variant: "destructive"
      });

    }

  }

  async function deleteFeedback(id: string) {

    try {

      await supabase
        .from("feedbacks")
        .delete()
        .eq("id", id);

      setFeedbacks(feedbacks.filter(f => f.id !== id));

      toast({
        title: "Feedback arquivado."
      });

    } catch {

      toast({
        title: "Erro ao remover feedback",
        variant: "destructive"
      });

    }

  }

  async function handleBanUser(userId: string, currentStatus: boolean) {

    if (userId === user?.id) {

      toast({
        title: "Ação bloqueada",
        description: "Você não pode banir sua própria conta.",
        variant: "destructive"
      });

      return;

    }

    const action = currentStatus ? "Desbanir" : "Banir";

    if (!window.confirm(`Deseja realmente ${action} este usuário?`))
      return;

    try {

      await supabase
        .from("profiles")
        .update({ is_banned: !currentStatus })
        .eq("user_id", userId);

      setUsersList(
        usersList.map(u =>
          u.user_id === userId
            ? { ...u, is_banned: !currentStatus }
            : u
        )
      );

      toast({
        title: currentStatus
          ? "Usuário Restaurado"
          : "Usuário Banido",
        variant: currentStatus ? "default" : "destructive"
      });

    } catch {

      toast({
        title: "Erro ao atualizar usuário",
        variant: "destructive"
      });

    }

  }

async function sendGlobalNotification() {

    if (!promoTitle.trim() || !promoMessage.trim())
      return;

    setSendingPromo(true);

    try {

      const { data: users, error } =
        await supabase
          .from("profiles")
          .select("user_id");

      if (error) throw error;

      if (!users || users.length === 0)
        throw new Error("Nenhum usuário encontrado");

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

        const { error } =
          await supabase
            .from("notifications")
            .insert(chunk);

        if (error) throw error;

      }

      toast({
        title: "Megafone Disparado 🚀",
        description: "Aviso enviado para todos os alunos."
      });

      setPromoTitle("");
      setPromoMessage("");

    } catch (e: any) {

      toast({
        title: "Erro ao enviar",
        description: e.message,
        variant: "destructive"
      });

    } finally {

      setSendingPromo(false);

    }

  }

  async function createAnnouncement() {
    if (!annTitle.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSavingAnn(true);
    try {
      const payload: any = {
        title: annTitle.trim(),
        body: annBody.trim() || null,
        type: annType,
        cta_label: annCtaLabel.trim() || null,
        cta_url: annCtaUrl.trim() || null,
        created_by: user?.id,
        active: true,
      };
      if (annType === "poll") {
        const opts = annOptions.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) {
          toast({ title: "Enquete precisa de ao menos 2 opções", variant: "destructive" });
          setSavingAnn(false);
          return;
        }
        payload.poll_options = opts;
      }
      const { data, error } = await supabase
        .from("admin_announcements")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setAnnouncements([data, ...announcements]);
      setAnnTitle("");
      setAnnBody("");
      setAnnCtaLabel("");
      setAnnCtaUrl("");
      setAnnOptions(["", ""]);
      toast({ title: "Publicado no Dashboard ✨" });
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setSavingAnn(false);
    }
  }

  async function toggleAnnouncement(id: string, current: boolean) {
    try {
      await supabase.from("admin_announcements").update({ active: !current }).eq("id", id);
      setAnnouncements(announcements.map((a) => (a.id === id ? { ...a, active: !current } : a)));
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm("Remover este anúncio do Dashboard?")) return;
    try {
      await supabase.from("admin_announcements").delete().eq("id", id);
      setAnnouncements(announcements.filter((a) => a.id !== id));
      toast({ title: "Anúncio removido" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    if (userId === user?.id && isAdmin) {
      toast({ title: "Ação bloqueada", description: "Você não pode remover seu próprio acesso admin.", variant: "destructive" });
      return;
    }
    if (!window.confirm(isAdmin ? "Remover acesso de administrador?" : "Conceder acesso de administrador a este usuário?")) return;
    try {
      if (isAdmin) {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        const next = new Set(adminIds); next.delete(userId); setAdminIds(next);
        toast({ title: "Admin removido" });
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
        const next = new Set(adminIds); next.add(userId); setAdminIds(next);
        toast({ title: "Admin promovido 👑" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao atualizar papel", description: e.message, variant: "destructive" });
    }
  }

  const filteredUsers = usersList.filter((u) =>
    !searchUser.trim()
      ? true
      : (u.full_name || "").toLowerCase().includes(searchUser.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Painel Admin</h1>
            <p className="text-xs text-muted-foreground font-semibold">
              EduFlow Academy · Área restrita
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xl font-black">{usersCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Alunos</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xl font-black">{feedbacks.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Feedbacks</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-black">{reports.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Denúncias</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="announcements">
        <TabsList className="w-full rounded-full bg-muted/40 p-1 grid grid-cols-5 h-auto">
          <TabsTrigger value="announcements" className="rounded-full font-bold text-[11px] py-2">Dashboard</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full font-bold text-[11px] py-2">Denúncias</TabsTrigger>
          <TabsTrigger value="feedbacks" className="rounded-full font-bold text-[11px] py-2">Feedbacks</TabsTrigger>
          <TabsTrigger value="users" className="rounded-full font-bold text-[11px] py-2">Usuários</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-full font-bold text-[11px] py-2">Avisos</TabsTrigger>
        </TabsList>

        {/* Anúncios do Dashboard */}
        <TabsContent value="announcements" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-black">Novo anúncio no Dashboard</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Aparece no carrossel principal para todos os alunos.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {(["notice", "news", "poll"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={annType === t ? "default" : "outline"}
                    size="sm"
                    className="rounded-full font-bold text-xs"
                    onClick={() => setAnnType(t)}
                  >
                    {t === "notice" ? "Aviso" : t === "news" ? "Notícia" : "Enquete"}
                  </Button>
                ))}
              </div>

              <Input
                placeholder="Título"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="rounded-xl"
              />
              <Textarea
                placeholder="Mensagem (opcional)"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
              />

              {annType !== "poll" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Rótulo do botão"
                    value={annCtaLabel}
                    onChange={(e) => setAnnCtaLabel(e.target.value)}
                    className="rounded-xl"
                  />
                  <Input
                    placeholder="Link (https://…)"
                    value={annCtaUrl}
                    onChange={(e) => setAnnCtaUrl(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Opções da enquete
                  </p>
                  {annOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={`Opção ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...annOptions];
                          next[i] = e.target.value;
                          setAnnOptions(next);
                        }}
                        className="rounded-xl"
                      />
                      {annOptions.length > 2 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setAnnOptions(annOptions.filter((_, j) => j !== i))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1 font-bold"
                    onClick={() => setAnnOptions([...annOptions, ""])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Opção
                  </Button>
                </div>
              )}

              <Button
                onClick={createAnnouncement}
                disabled={savingAnn}
                className="w-full rounded-full font-bold gap-2"
              >
                {savingAnn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar no Dashboard
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">
              Publicados ({announcements.length})
            </p>
            {announcements.length === 0 ? (
              <EmptyState icon={<Sparkles className="h-10 w-10" />} text="Nenhum anúncio publicado." />
            ) : (
              announcements.map((a) => (
                <Card key={a.id} className={`rounded-2xl ${a.active ? "" : "opacity-60"}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            {a.type === "poll" ? "Enquete" : a.type === "news" ? "Notícia" : "Aviso"}
                          </span>
                          {!a.active && (
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">
                              · pausado
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-sm truncate">{a.title}</p>
                        {a.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {a.body}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => toggleAnnouncement(a.id, a.active)}
                          title={a.active ? "Pausar" : "Ativar"}
                        >
                          <Power className={`h-4 w-4 ${a.active ? "text-primary" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => deleteAnnouncement(a.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {Array.isArray(a.poll_options) && a.poll_options.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {a.poll_options.map((opt: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Denúncias */}
        <TabsContent value="reports" className="space-y-3 mt-4">
          {reports.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} text="Nenhuma denúncia pendente." />
          ) : (
            reports.map((r) => (
              <Card key={r.id} className="rounded-2xl border-destructive/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wider font-black text-destructive">
                        {r.reason || "Sem motivo"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  {r.posts && (
                    <div className="bg-muted/40 rounded-xl p-3 text-sm">
                      <p className="line-clamp-3 whitespace-pre-wrap">
                        {r.posts.content || <em className="text-muted-foreground">(sem texto)</em>}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-full font-bold gap-1 flex-1"
                      onClick={() => handleDeletePost(r.id, r.post_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir Post
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full font-bold flex-1"
                      onClick={() => handleIgnoreReport(r.id)}
                    >
                      Ignorar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Feedbacks */}
        <TabsContent value="feedbacks" className="space-y-3 mt-4">
          {feedbacks.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-10 w-10" />} text="Nenhum feedback recebido." />
          ) : (
            feedbacks.map((f) => (
              <Card key={f.id} className="rounded-2xl">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-black text-primary">
                        {f.category || "Geral"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {f.is_anonymous ? "Anônimo" : f.email || "Sem e-mail"} ·{" "}
                        {new Date(f.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteFeedback(f.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Usuários */}
        <TabsContent value="users" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Buscar usuário..."
              className="pl-9 rounded-full bg-muted/40 border-0"
            />
          </div>
          {filteredUsers.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} text="Nenhum usuário encontrado." />
          ) : (
            filteredUsers.map((u) => (
              <Card key={u.user_id} className="rounded-2xl">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>
                      {u.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">
                      {u.full_name || "Sem nome"}
                      {adminIds.has(u.user_id) && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-500">
                          <Crown className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.course || "—"} · {u.current_semester_label || "—"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={adminIds.has(u.user_id) ? "Remover admin" : "Promover a admin"}
                    onClick={() => toggleAdmin(u.user_id, adminIds.has(u.user_id))}
                  >
                    <Crown className={`h-4 w-4 ${adminIds.has(u.user_id) ? "text-amber-500" : "text-muted-foreground"}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant={u.is_banned ? "outline" : "destructive"}
                    className="rounded-full font-bold gap-1 h-8"
                    onClick={() => handleBanUser(u.user_id, !!u.is_banned)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {u.is_banned ? "Desbanir" : "Banir"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Broadcast */}
        <TabsContent value="broadcast" className="space-y-3 mt-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <h3 className="font-black">Aviso Global</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Notificação enviada a <strong>{usersCount}</strong> alunos.
              </p>
              <Input
                placeholder="Título do aviso"
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                className="rounded-xl"
              />
              <Textarea
                placeholder="Mensagem completa..."
                value={promoMessage}
                onChange={(e) => setPromoMessage(e.target.value)}
                rows={5}
                className="rounded-xl resize-none"
              />
              <Button
                onClick={sendGlobalNotification}
                disabled={sendingPromo || !promoTitle.trim() || !promoMessage.trim()}
                className="w-full rounded-full font-bold gap-2"
              >
                {sendingPromo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Disparar Megafone
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Card className="rounded-3xl border-dashed">
      <CardContent className="p-10 text-center text-muted-foreground space-y-2">
        <div className="opacity-30 flex justify-center">{icon}</div>
        <p className="text-sm font-semibold">{text}</p>
      </CardContent>
    </Card>
  );
}
