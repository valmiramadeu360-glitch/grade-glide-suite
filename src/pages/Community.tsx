import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Megaphone, MessagesSquare, HelpCircle, FolderOpen, FileText,
  ClipboardList, CalendarDays, Users, Sparkles, Send, Loader2, Plus, Trash2,
} from "lucide-react";

type TabKey =
  | "avisos" | "conversas" | "duvidas" | "materiais" | "resumos"
  | "trabalhos" | "calendario" | "integrantes" | "assistente";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "avisos", label: "Avisos", icon: Megaphone },
  { key: "conversas", label: "Conversas", icon: MessagesSquare },
  { key: "duvidas", label: "Dúvidas", icon: HelpCircle },
  { key: "materiais", label: "Materiais", icon: FolderOpen },
  { key: "resumos", label: "Resumos", icon: FileText },
  { key: "trabalhos", label: "Trabalhos", icon: ClipboardList },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "integrantes", label: "Integrantes", icon: Users },
  { key: "assistente", label: "Assistente IA", icon: Sparkles },
];

// Cada aba de conteúdo é alimentada pela tabela `posts` usando a tag como seção.
const POST_TAG: Partial<Record<TabKey, string>> = {
  avisos: "Aviso",
  duvidas: "Dúvida",
  materiais: "Material",
  resumos: "Resumo",
  trabalhos: "Trabalho",
  calendario: "Evento",
};

interface CommunityRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  member_count: number;
  semester_label: string | null;
  class_section: string | null;
}

interface PostRow {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  tag: string | null;
  link_url: string | null;
  event_at: string | null;
  event_location: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface MemberRow {
  user_id: string;
  role: string;
  joined_at: string;
}

type ProfileMap = Record<string, { name: string; avatar_url: string | null }>;

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export default function Community() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("avisos");

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});

  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [draftEventAt, setDraftEventAt] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const [chatDraft, setChatDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiThread, setAiThread] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const loadProfiles = useCallback(async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter((uid) => uid && !profiles[uid]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, display_name, codename, is_anonymous, hide_name, avatar_url")
      .in("user_id", missing);
    const next: ProfileMap = {};
    for (const p of data ?? []) {
      const anon = (p as any).is_anonymous || (p as any).hide_name;
      next[(p as any).user_id] = {
        name: anon
          ? (p as any).codename || "Anônimo"
          : (p as any).display_name || (p as any).full_name || "Estudante",
        avatar_url: anon ? null : (p as any).avatar_url,
      };
    }
    setProfiles((prev) => ({ ...prev, ...next }));
  }, [profiles]);

  // Carrega a comunidade e verifica se o usuário atual participa dela.
  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: m }] = await Promise.all([
        supabase.from("communities").select("id,name,description,type,member_count,semester_label,class_section").eq("id", id).maybeSingle(),
        supabase.from("community_members").select("user_id").eq("community_id", id).eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setCommunity((c as any) ?? null);
      setIsMember(!!m);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, user]);

  const loadPosts = useCallback(async (key: TabKey) => {
    const tag = POST_TAG[key];
    if (!id || !tag) return;
    setPostsLoading(true);
    let query = supabase
      .from("posts")
      .select("id,user_id,title,content,tag,link_url,event_at,event_location,created_at")
      .eq("community_id", id)
      .eq("tag", tag);
    query = key === "calendario"
      ? query.order("event_at", { ascending: true })
      : query.order("created_at", { ascending: false });
    const { data, error } = await query.limit(60);
    if (error) toast({ title: "Não foi possível carregar", description: error.message, variant: "destructive" });
    const list = (data ?? []) as PostRow[];
    setPosts(list);
    setPostsLoading(false);
    loadProfiles(list.map((p) => p.user_id));
  }, [id, toast, loadProfiles]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("community_messages")
      .select("id,user_id,content,created_at")
      .eq("community_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (data ?? []) as MessageRow[];
    setMessages(list);
    loadProfiles(list.map((m) => m.user_id));
  }, [id, loadProfiles]);

  const loadMembers = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("community_members")
      .select("user_id,role,joined_at")
      .eq("community_id", id)
      .order("joined_at", { ascending: true })
      .limit(200);
    const list = (data ?? []) as MemberRow[];
    setMembers(list);
    loadProfiles(list.map((m) => m.user_id));
  }, [id, loadProfiles]);

  useEffect(() => {
    if (!id || loading) return;
    if (POST_TAG[tab]) loadPosts(tab);
    else if (tab === "conversas") loadMessages();
    else if (tab === "integrantes") loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id, loading]);

  // Conversas em tempo real, com limpeza do canal ao sair da aba.
  useEffect(() => {
    if (tab !== "conversas" || !id || !isMember) return;
    const channel = supabase
      .channel(`community_messages:${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          loadProfiles([msg.user_id]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id, isMember]);

  useEffect(() => {
    if (tab === "conversas") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  const join = async () => {
    if (!id || !user) return;
    const { error } = await supabase.from("community_members").insert({ community_id: id, user_id: user.id });
    if (error) return toast({ title: "Não foi possível entrar", description: error.message, variant: "destructive" });
    setIsMember(true);
    toast({ title: "Você entrou na comunidade" });
  };

  const resetDraft = () => {
    setDraftTitle(""); setDraftContent(""); setDraftLink(""); setDraftEventAt(""); setDraftLocation("");
  };

  const publish = async () => {
    const tag = POST_TAG[tab];
    if (!id || !user || !tag) return;
    if (!draftContent.trim()) return toast({ title: "Escreva um conteúdo", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      community_id: id,
      content: draftContent.trim(),
      title: draftTitle.trim() || null,
      tag,
      category: tag,
      media_type: "text",
      link_url: draftLink.trim() || null,
      event_at: tab === "calendario" && draftEventAt ? new Date(draftEventAt).toISOString() : null,
      event_location: tab === "calendario" ? (draftLocation.trim() || null) : null,
    });
    setSaving(false);
    if (error) return toast({ title: "Falha ao publicar", description: error.message, variant: "destructive" });
    resetDraft(); setComposerOpen(false);
    toast({ title: "Publicado na comunidade" });
    loadPosts(tab);
  };

  const removePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return toast({ title: "Falha ao excluir", description: error.message, variant: "destructive" });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const sendMessage = async () => {
    if (!id || !user || !chatDraft.trim()) return;
    setSending(true);
    const { error } = await supabase.from("community_messages").insert({
      community_id: id, user_id: user.id, content: chatDraft.trim(),
    });
    setSending(false);
    if (error) return toast({ title: "Falha ao enviar", description: error.message, variant: "destructive" });
    setChatDraft("");
  };

  const askAi = async () => {
    if (!aiInput.trim() || !community) return;
    const question = aiInput.trim();
    setAiInput("");
    setAiThread((prev) => [...prev, { role: "user", content: question }]);
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-assistant", {
      body: {
        action: "chat",
        message: question,
        context: `O aluno está na comunidade "${community.name}" (${community.type}${community.semester_label ? `, ${community.semester_label}` : ""}) do EduFlow, com ${community.member_count} integrantes.`,
        history: aiThread.slice(-8),
      },
    });
    setAiLoading(false);
    if (error || (data as any)?.error) {
      toast({ title: "Assistente indisponível", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    setAiThread((prev) => [...prev, { role: "assistant", content: (data as any).content ?? "" }]);
  };

  const activeTabMeta = useMemo(() => TABS.find((t) => t.key === tab)!, [tab]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-sm text-muted-foreground">Comunidade não encontrada ou você não tem acesso a ela.</p>
        <Button variant="outline" onClick={() => navigate("/connect?tab=communities")}>Voltar para Comunidades</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" className="h-9 -ml-2 gap-2" onClick={() => navigate("/connect?tab=communities")}>
          <ArrowLeft className="h-4 w-4" /> Comunidades
        </Button>
        <Card className="glass-card border-border/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight truncate">{community.name}</h1>
                {community.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
                )}
              </div>
              {!isMember && <Button size="sm" onClick={join}>Entrar</Button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{community.type}</Badge>
              {community.class_section && <Badge variant="outline" className="text-[10px]">Turma {community.class_section}</Badge>}
              {community.semester_label && <Badge variant="outline" className="text-[10px]">{community.semester_label}</Badge>}
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {community.member_count} integrantes
              </span>
            </div>
          </CardContent>
        </Card>
      </header>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabKey); setComposerOpen(false); }}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max gap-1 bg-muted/60 p-1 rounded-xl">
            {TABS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="gap-1.5 rounded-lg text-xs px-3 whitespace-nowrap">
                <Icon className="h-3.5 w-3.5" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {/* Abas alimentadas por publicações da comunidade */}
        {TABS.filter((t) => POST_TAG[t.key]).map(({ key, label, icon: Icon }) => (
          <TabsContent key={key} value={key} className="mt-4 space-y-3">
            {isMember && (
              composerOpen ? (
                <Card className="border-border/40">
                  <CardContent className="p-3 space-y-2">
                    <Input placeholder="Título (opcional)" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="h-10" />
                    <Textarea placeholder={`Escreva em ${label}...`} value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={4} />
                    <Input placeholder="Link (opcional)" value={draftLink} onChange={(e) => setDraftLink(e.target.value)} className="h-10" />
                    {key === "calendario" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input type="datetime-local" value={draftEventAt} onChange={(e) => setDraftEventAt(e.target.value)} className="h-10" />
                        <Input placeholder="Local" value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} className="h-10" />
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setComposerOpen(false); resetDraft(); }}>Cancelar</Button>
                      <Button size="sm" onClick={publish} disabled={saving}>
                        {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Publicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="outline" className="w-full h-11 gap-2 rounded-xl" onClick={() => setComposerOpen(true)}>
                  <Plus className="h-4 w-4" /> Nova publicação em {label}
                </Button>
              )
            )}

            {postsLoading ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : posts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Icon className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nada em {label} ainda.</p>
              </div>
            ) : (
              posts.map((p) => {
                const author = profiles[p.user_id];
                return (
                  <Card key={p.id} className="border-border/40">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={author.name} />}
                          <AvatarFallback className="text-[10px]">{initials(author?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{author?.name ?? "Estudante"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(p.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                        {p.user_id === user?.id && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePost(p.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      {p.title && <h3 className="text-sm font-bold leading-snug">{p.title}</h3>}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{p.content}</p>
                      {p.event_at && (
                        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                          <CalendarDays className="h-3.5 w-3.5 inline mr-1.5 align-[-2px]" />
                          {new Date(p.event_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          {p.event_location && ` · ${p.event_location}`}
                        </div>
                      )}
                      {p.link_url && (
                        <a href={p.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">
                          {p.link_url}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}

        <TabsContent value="conversas" className="mt-4">
          <Card className="border-border/40">
            <CardContent className="p-3 flex flex-col h-[60vh]">
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-10">Comece a conversa da turma.</p>
                  )}
                  {messages.map((m) => {
                    const mine = m.user_id === user?.id;
                    const author = profiles[m.user_id];
                    return (
                      <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                        <Avatar className="h-7 w-7 shrink-0">
                          {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={author.name} />}
                          <AvatarFallback className="text-[10px]">{initials(author?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {!mine && <p className="text-[10px] font-semibold opacity-80">{author?.name ?? "Estudante"}</p>}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-3">
                <Input
                  placeholder={isMember ? "Mensagem..." : "Entre na comunidade para conversar"}
                  value={chatDraft}
                  disabled={!isMember}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="h-11 rounded-xl"
                />
                <Button size="icon" className="h-11 w-11 rounded-xl" onClick={sendMessage} disabled={!isMember || sending || !chatDraft.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrantes" className="mt-4 space-y-2">
          {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum integrante visível.</p>}
          {members.map((m) => {
            const p = profiles[m.user_id];
            return (
              <Card key={m.user_id} className="border-border/40">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {p?.avatar_url && <AvatarImage src={p.avatar_url} alt={p.name} />}
                    <AvatarFallback className="text-xs">{initials(p?.name ?? "?")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p?.name ?? "Estudante"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Desde {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {m.role !== "member" && <Badge variant="secondary" className="text-[10px] uppercase">{m.role}</Badge>}
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate(`/profile/${m.user_id}`)}>Perfil</Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="assistente" className="mt-4">
          <Card className="border-border/40">
            <CardContent className="p-3 flex flex-col h-[60vh]">
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-3">
                  {aiThread.length === 0 && (
                    <div className="py-10 text-center space-y-2">
                      <Sparkles className="h-8 w-8 mx-auto text-primary/60" />
                      <p className="text-sm text-muted-foreground">
                        Pergunte sobre os conteúdos, prazos e materiais desta comunidade.
                      </p>
                    </div>
                  )}
                  {aiThread.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-3">
                <Input
                  placeholder="Pergunte ao EduFlow AI..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAi(); } }}
                  className="h-11 rounded-xl"
                />
                <Button size="icon" className="h-11 w-11 rounded-xl" onClick={askAi} disabled={aiLoading || !aiInput.trim()}>
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="sr-only">{activeTabMeta.label}</p>
    </div>
  );
}