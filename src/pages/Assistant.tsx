import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Sparkles, Send, FileText, Layers, CalendarClock, Loader2, 
  RotateCw, Plus, MessageSquare, Trash2, PanelLeft, ArrowLeft, BrainCircuit, Paperclip, ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };
type ChatThread = { id: string; title: string; messages: ChatMsg[]; updatedAt: number };

// Chave antiga do localStorage — usada só para migrar o histórico existente
// do aluno para o Supabase na primeira vez que ele abre o assistente depois
// desta atualização. Depois da migração, essa chave é limpa.
const LEGACY_THREADS_KEY = "eduflow.ai.threads.v1";

function loadLegacyThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_THREADS_KEY);
    return raw ? (JSON.parse(raw) as ChatThread[]) : [];
  } catch {
    return [];
  }
}
function clearLegacyThreads() {
  try { window.localStorage.removeItem(LEGACY_THREADS_KEY); } catch {}
}

type Flashcard = { front: string; back: string };
type PlanBlock = { time: string; topic: string; goal: string };
type PlanDay = { day: string; blocks: PlanBlock[] };

async function invokeAI(body: Record<string, unknown>, userId?: string) {
  const context = userId ? await buildUserContext(userId) : "";
  const { data, error } = await supabase.functions.invoke("ai-assistant", { body: { ...body, context } });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { content: string; parsed: any };
}

async function buildUserContext(userId: string): Promise<string> {
  try {
    const [{ data: profile }, { data: disciplines }, { data: reminders }] = await Promise.all([
      supabase.from("profiles").select("full_name, university_id, campus_id, course_id, current_period, current_semester_label, bio, career_goal, universities(name), campuses(name), courses(name)").eq("user_id", userId).maybeSingle(),
      supabase.from("disciplines").select("name, professor, current_grade").eq("user_id", userId).eq("archived", false).limit(15),
      supabase.from("reminders").select("title, due_date, type").eq("user_id", userId).gte("due_date", new Date().toISOString()).order("due_date", { ascending: true }).limit(10),
    ]);
    const parts: string[] = [];
    if (profile) {
      parts.push(`Nome: ${profile.full_name ?? "-"}`);
      if ((profile as any).universities?.name) parts.push(`Universidade: ${(profile as any).universities.name}`);
      if (profile.current_semester_label) parts.push(`Semestre: ${profile.current_semester_label}`);
      if (profile.career_goal) parts.push(`Objetivos: ${profile.career_goal}`);
    }
    if (disciplines?.length) parts.push(`Disciplinas em curso: ${disciplines.map((d: any) => `${d.name}`).join("; ")}`);
    if (reminders?.length) parts.push(`Próximos prazos: ${reminders.map((r: any) => `${r.title}`).join("; ")}`);
    return parts.join("\n");
  } catch { return ""; }
}

export default function Assistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Capítulo 6, seção 8 — botões de IA em um post do Connect chegam aqui via
  // navigate("/assistant", { state }). Três formatos de state são aceitos:
  //  - { initialPrompt }              -> abre o Chat e já envia a pergunta
  //  - { initialTool: "summary"|"flashcards", initialContent } -> abre a
  //    ferramenta certa com o conteúdo do post pré-preenchido
  const navState = (location.state as any) || {};
  const initialPrompt = navState.initialPrompt as string | undefined;
  const initialTool = navState.initialTool as "summary" | "flashcards" | undefined;
  const initialContent = navState.initialContent as string | undefined;

  const [activeTool, setActiveTool] = useState<"chat" | "summary" | "flashcards" | "plan">(initialTool ?? "chat");

  // Limpa o state da rota depois de consumir, para não reabrir a mesma
  // ferramenta em caso de refresh/voltar.
  useEffect(() => {
    if (initialTool) navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-8">
      
      {/* HEADER DE COMANDO (Premium) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-muted/40 hover:bg-muted border border-border/40 shrink-0 transition-all" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                EduFlow AI
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[9px] font-black uppercase tracking-widest mt-1">Gemini</Badge>
              </h1>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                Seu Assistente Universitário Pessoal
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* RENDERIZAÇÃO DINÂMICA DA FERRAMENTA */}
      <div className="mt-4">
        {activeTool === "chat" && <ChatTab userId={user?.id} onToolSelect={setActiveTool} initialPrompt={initialPrompt} />}
        {activeTool === "summary" && <SummaryTab userId={user?.id} onBack={() => setActiveTool("chat")} initialContent={initialTool === "summary" ? initialContent : undefined} />}
        {activeTool === "flashcards" && <FlashcardsTab userId={user?.id} onBack={() => setActiveTool("chat")} initialContent={initialTool === "flashcards" ? initialContent : undefined} />}
        {activeTool === "plan" && <StudyPlanTab userId={user?.id} onBack={() => setActiveTool("chat")} />}
      </div>
    </div>
  );
}

/* --------------------------- 1. CHAT (Supabase, sincronizado) --------------------------- */
function ChatTab({ userId, onToolSelect, initialPrompt }: { userId?: string; onToolSelect: (tool: any) => void; initialPrompt?: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const firedInitialPrompt = useRef(false);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);
  const messages = activeThread?.messages ?? [];

  // Carrega o histórico do Supabase e, se for a primeira vez, migra o que
  // estava salvo no navegador (localStorage) do aluno.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setThreadsLoading(true);
      const { data } = await supabase
        .from("ai_chat_threads")
        .select("id,title,messages,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);

      let loaded: ChatThread[] = (data ?? []).map((t: any) => ({
        id: t.id, title: t.title, messages: (t.messages as ChatMsg[]) ?? [], updatedAt: new Date(t.updated_at).getTime(),
      }));

      const legacy = loadLegacyThreads();
      if (legacy.length > 0 && loaded.length === 0) {
        const migrated: ChatThread[] = [];
        for (const t of legacy) {
          const { data: row } = await supabase
            .from("ai_chat_threads")
            .insert({ user_id: userId, title: t.title, messages: t.messages as any })
            .select("id,title,messages,updated_at")
            .single();
          if (row) migrated.push({ id: row.id, title: row.title, messages: (row.messages as ChatMsg[]) ?? [], updatedAt: new Date(row.updated_at).getTime() });
        }
        loaded = migrated.sort((a, b) => b.updatedAt - a.updatedAt);
        clearLegacyThreads();
      }

      setThreads(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setThreadsLoading(false);
    })();
  }, [userId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Capítulo 6, seção 8 — chegada vinda de um post do Connect ("Explique isso").
  useEffect(() => {
    if (!initialPrompt || firedInitialPrompt.current || threadsLoading) return;
    firedInitialPrompt.current = true;
    send(initialPrompt);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, threadsLoading]);

  async function newThread(): Promise<string | null> {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("ai_chat_threads")
      .insert({ user_id: userId, title: "Nova conversa", messages: [] })
      .select("id,title,messages,updated_at")
      .single();
    if (error || !data) { toast.error("Não foi possível criar a conversa"); return null; }
    const t: ChatThread = { id: data.id, title: data.title, messages: [], updatedAt: new Date(data.updated_at).getTime() };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    return t.id;
  }

  async function deleteThread(id: string) {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    await supabase.from("ai_chat_threads").delete().eq("id", id);
  }

  async function send(customText?: string) {
    const text = customText || input.trim();
    if (!text || loading || !userId) return;
    let currentId = activeId;
    if (!currentId) currentId = await newThread();
    if (!currentId) return;
    if (!customText) setInput("");

    const userMsg: ChatMsg = { role: "user", content: text };
    setThreads((prev) => prev.map((t) => t.id === currentId
      ? { ...t, title: t.messages.length === 0 ? text.slice(0, 40) : t.title, messages: [...t.messages, userMsg], updatedAt: Date.now() }
      : t
    ));
    setLoading(true);
    try {
      const { content } = await invokeAI({ action: "chat", message: text, history: messages }, userId);
      setThreads((prev) => {
        const next = prev.map((t) => t.id === currentId
          ? { ...t, messages: [...t.messages, { role: "assistant", content } as ChatMsg], updatedAt: Date.now() }
          : t
        );
        const updated = next.find((t) => t.id === currentId);
        if (updated) {
          supabase.from("ai_chat_threads").update({ title: updated.title, messages: updated.messages as any }).eq("id", currentId);
        }
        return next;
      });
    } catch (e: any) { toast.error(e.message ?? "Falha ao consultar a IA"); } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100dvh-12rem)] min-h-[500px]">
      
      {/* Sidebar Histórico */}
      <aside className={cn("md:block", sidebarOpen ? "block" : "hidden")}>
        <Card className="h-full flex flex-col rounded-[32px] border-0 bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Histórico</h3>
            <Button size="icon" variant="ghost" onClick={newThread} className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"><Plus className="h-4 w-4" /></Button>
          </CardHeader>
          <ScrollArea className="flex-1 px-3 py-2">
            {threadsLoading ? (
              <div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-50 mt-10">
                <BrainCircuit className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sem histórico</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {threads.map((t) => (
                  <div key={t.id} className={cn("group flex items-center justify-between rounded-[20px] px-4 py-3 cursor-pointer text-sm transition-all border border-transparent", activeId === t.id ? "bg-primary/10 border-primary/20 text-foreground shadow-sm" : "hover:bg-muted/50 text-muted-foreground")} onClick={() => { setActiveId(t.id); setSidebarOpen(false); }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className={cn("h-4 w-4 shrink-0", activeId === t.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate font-bold text-xs">{t.title || "Novo assunto"}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </aside>

      {/* Janela de Chat Principal */}
      <Card className="flex flex-col h-full rounded-[32px] border-0 bg-card shadow-sm overflow-hidden relative">
        <CardHeader className="p-4 sm:px-6 bg-card/90 backdrop-blur-2xl border-b border-border/40 z-20 flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button size="icon" variant="ghost" className="md:hidden h-10 w-10 rounded-full bg-muted/40 shrink-0" onClick={() => setSidebarOpen((v) => !v)}>
              <PanelLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-base font-black truncate">{activeThread?.title || "Tutor Especializado"}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary truncate mt-0.5">Lê suas matérias ativas</p>
            </div>
          </div>
          <Button size="icon" variant="secondary" onClick={newThread} className="rounded-full h-10 w-10 shrink-0 hidden sm:flex"><Plus className="h-4 w-4" /></Button>
        </CardHeader>
        
        <ScrollArea className="flex-1 bg-muted/10 px-4 sm:px-6 py-6" id="chat-container">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 absolute inset-0 pt-10 px-6">
              <div className="h-16 w-16 bg-card border border-border/50 rounded-full flex items-center justify-center shadow-sm"><Sparkles className="h-8 w-8 text-primary" /></div>
              <div className="text-center max-w-sm mb-4">
                <p className="text-lg font-black text-foreground">Como posso ajudar hoje?</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Converse comigo ou use o botão (+) abaixo para ferramentas avançadas.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                <Button variant="outline" className="rounded-full bg-card shadow-sm text-xs font-bold" onClick={() => send("Me ajude a organizar meus estudos para esta semana.")}>📅 Organizar estudos</Button>
                <Button variant="outline" className="rounded-full bg-card shadow-sm text-xs font-bold" onClick={() => send("Me explique um conceito complexo da minha área de forma simples.")}>💡 Explicar conceito</Button>
                <Button variant="outline" className="rounded-full bg-card shadow-sm text-xs font-bold" onClick={() => send("Quais são as melhores dicas para memorizar conteúdo rápido?")}>🧠 Dicas de memória</Button>
              </div>
            </div>
          )}
          
          <div className="space-y-4 pb-4 flex flex-col justify-end min-h-full relative z-10">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col animate-in slide-in-from-bottom-2", m.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("max-w-[85%] sm:max-w-[75%] px-5 py-3.5 text-[15px] font-medium leading-relaxed shadow-sm", m.role === "user" ? "bg-primary text-primary-foreground rounded-[24px] rounded-br-[8px]" : "bg-card border border-border/40 text-foreground rounded-[24px] rounded-bl-[8px]")}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-in fade-in">
                <div className="rounded-[24px] rounded-bl-[8px] border border-border/40 bg-card px-5 py-3.5 text-sm font-bold text-muted-foreground flex items-center gap-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Lendo seu contexto acadêmico...
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        </ScrollArea>
        
        {/* INPUT COM O BOTÃO (+) MENU */}
        <div className="p-3 sm:p-5 bg-card/90 backdrop-blur-2xl border-t border-border/40 shrink-0">
          <div className="flex items-end gap-2 bg-muted/40 p-1.5 rounded-[28px] border border-border/50 focus-within:border-primary/40 focus-within:bg-background transition-all shadow-sm">
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="h-11 w-11 rounded-full shrink-0 mb-0.5 ml-0.5 text-foreground shadow-sm hover:scale-105 transition-transform" title="Ferramentas Avançadas">
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={10} className="w-56 rounded-[24px] p-2 bg-background/95 backdrop-blur-2xl border-border/40 shadow-2xl">
                <div className="px-3 py-2 border-b border-border/30 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ferramentas de IA</p>
                </div>
                <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-xl cursor-pointer font-bold focus:bg-primary/10 focus:text-primary transition-colors" onClick={() => onToolSelect("summary")}>
                  <FileText className="h-4 w-4" /> Resumir Material
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-xl cursor-pointer font-bold focus:bg-indigo-500/10 focus:text-indigo-500 transition-colors" onClick={() => onToolSelect("flashcards")}>
                  <Layers className="h-4 w-4" /> Gerar Flashcards
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-xl cursor-pointer font-bold focus:bg-amber-500/10 focus:text-amber-600 transition-colors" onClick={() => onToolSelect("plan")}>
                  <CalendarClock className="h-4 w-4" /> Plano de Estudos
                </DropdownMenuItem>
                <div className="px-3 py-2 border-t border-border/30 mt-1 opacity-50 cursor-not-allowed flex items-center gap-3" title="Em breve">
                  <Paperclip className="h-4 w-4" /> <span className="text-xs font-bold">Ler PDF (Em breve)</span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="O que vamos estudar?"
              className="min-h-[48px] max-h-[120px] bg-transparent border-none shadow-none focus-visible:ring-0 text-base resize-none py-3.5 px-3 font-medium"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className={cn("h-12 w-12 rounded-full shrink-0 mb-0.5 mr-0.5 transition-all duration-300 shadow-md", input.trim() ? "bg-primary text-primary-foreground hover:scale-105" : "bg-muted text-muted-foreground opacity-50")}>
              <Send className="h-5 w-5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------- 2. RESUMO --------------------------- */
function SummaryTab({ userId, onBack, initialContent }: { userId?: string; onBack: () => void; initialContent?: string }) {
  const [content, setContent] = useState(initialContent ?? "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const autoRan = useRef(false);

  async function run() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const { content: out } = await invokeAI({ action: "summarize", content }, userId);
      setResult(out);
    } catch (e: any) { toast.error(e.message ?? "Erro ao gerar resumo"); } finally { setLoading(false); }
  }

  // Veio de um post do Connect ("Faça um resumo") — gera automaticamente
  useEffect(() => {
    if (initialContent && !autoRan.current) { autoRan.current = true; run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right-8 duration-300">
      <Card className="rounded-[32px] border-0 bg-card shadow-sm">
        <CardHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></Button>
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-black text-lg">Resumo Inteligente</h3></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole aqui o texto ou artigo longo..." className="min-h-[250px] rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary font-medium p-5 text-base shadow-inner resize-none" />
          <Button onClick={run} disabled={loading || !content.trim()} className="w-full h-14 rounded-2xl font-black text-base shadow-lg hover:scale-[1.01] transition-transform">
            {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />} Extrair Pontos Chave
          </Button>
        </CardContent>
      </Card>
       {result ? (
        <Card className="rounded-[32px] border border-primary/20 bg-primary/5 shadow-sm animate-in slide-in-from-bottom-4">
          <CardContent className="p-6 sm:p-8">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Síntese Gerada</h4>
            <div className="prose prose-sm dark:prose-invert max-w-none font-medium leading-relaxed whitespace-pre-wrap text-foreground/90">
              {result}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="hidden lg:flex flex-col items-center justify-center p-10 opacity-40 border-2 border-dashed border-border/50 rounded-[32px]">
          {loading ? <Loader2 className="h-16 w-16 mb-4 text-muted-foreground animate-spin" /> : <FileText className="h-16 w-16 mb-4 text-muted-foreground" />}
          <p className="font-black text-lg text-center">{loading ? "Gerando..." : "Aguardando Texto"}</p>
        </div>
      )}
    </div>
  );
}

/* --------------------------- 3. FLASHCARDS --------------------------- */
function FlashcardsTab({ userId, onBack, initialContent }: { userId?: string; onBack: () => void; initialContent?: string }) {
  const [content, setContent] = useState(initialContent ?? "");
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const autoRan = useRef(false);

  async function run() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const { parsed, content: raw } = await invokeAI({ action: "flashcards", content, count }, userId);
      if (parsed?.cards?.length) { setCards(parsed.cards); setFlipped({}); } 
      else { toast.error("Falha ao criar as cartas."); console.log(raw); }
    } catch (e: any) { toast.error(e.message ?? "Erro ao gerar flashcards"); } finally { setLoading(false); }
  }

  // Veio de um post do Connect ("Gere flashcards") — gera automaticamente
  useEffect(() => {
    if (initialContent && !autoRan.current) { autoRan.current = true; run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
      <Card className="rounded-[32px] border-0 bg-card shadow-sm">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full hover:bg-muted shrink-0"><ChevronLeft className="h-5 w-5" /></Button>
              <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center"><Layers className="h-5 w-5 text-indigo-500" /></div>
              <div><h3 className="font-black text-lg">Flashcards Dinâmicos</h3></div>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-2xl w-fit border border-border/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Qtd:</span>
              <Input type="number" min={3} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(3, Number(e.target.value) || 3)))} className="w-16 h-9 rounded-xl bg-background border-0 text-center font-bold" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole o texto base para a geração das cartas..." rows={2} className="flex-1 rounded-2xl bg-muted/40 border-0 focus-visible:ring-indigo-500 font-medium text-base shadow-inner resize-none p-4" />
            <Button onClick={run} disabled={loading || !content.trim()} className="h-auto min-h-[60px] px-8 rounded-2xl font-black text-base shadow-md bg-indigo-500 hover:bg-indigo-600 text-white transition-transform hover:scale-[1.02] shrink-0">
              {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Layers className="h-5 w-5 mr-2" />} Gerar
            </Button>
          </div>
        </CardContent>
      </Card>
      
       {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 pt-2">
          {cards.map((c, i) => (
            <div key={i} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} className="relative cursor-pointer min-h-[160px] perspective-1000 group">
              <div className={cn("w-full h-full transition-all duration-500 transform-style-3d", flipped[i] ? "rotate-y-180" : "")}>
                <Card className={cn("absolute inset-0 backface-hidden rounded-[24px] border-border/40 shadow-sm flex flex-col items-center justify-center p-6 text-center hover:border-indigo-500/50 transition-colors", flipped[i] && "invisible")}>
                  <Badge variant="secondary" className="absolute top-4 left-4 bg-indigo-500/10 text-indigo-500 border-0 text-[9px] uppercase tracking-widest font-black">Pergunta {i+1}</Badge>
                  <RotateCw className="absolute top-4 right-4 h-4 w-4 text-muted-foreground/30 group-hover:text-indigo-500/50 transition-colors" />
                  <p className="font-bold text-foreground mt-4">{c.front}</p>
                </Card>
                <Card className={cn("absolute inset-0 backface-hidden rotate-y-180 rounded-[24px] border-emerald-500/30 bg-emerald-500/5 shadow-sm flex flex-col items-center justify-center p-6 text-center", !flipped[i] && "invisible")}>
                  <Badge variant="secondary" className="absolute top-4 left-4 bg-emerald-500/20 text-emerald-600 border-0 text-[9px] uppercase tracking-widest font-black">Resposta</Badge>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100 mt-4 leading-relaxed">{c.back}</p>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- 4. PLANO DE ESTUDOS --------------------------- */
function StudyPlanTab({ userId, onBack }: { userId?: string; onBack: () => void }) {
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState(7);
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const { parsed, content: raw } = await invokeAI({ action: "study_plan", topic, goal, days, hoursPerDay }, userId);
      if (parsed?.plan?.length) setPlan(parsed.plan);
      else { toast.error("Falha ao criar plano."); console.log(raw); }
    } catch (e: any) { toast.error(e.message ?? "Erro ao gerar plano"); } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 animate-in slide-in-from-right-8 duration-300">
      <Card className="rounded-[32px] border-0 bg-card shadow-sm h-fit">
        <CardHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></Button>
            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center"><CalendarClock className="h-5 w-5 text-amber-500" /></div>
            <div><h3 className="font-black text-lg">Plano Estratégico</h3></div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tema Principal</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Direito Constitucional" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-amber-500 font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objetivo da Rotina</label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Preparação para prova final" className="h-14 rounded-2xl bg-muted/40 border-0 focus-visible:ring-amber-500 font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 bg-muted/20 p-3 rounded-2xl border border-border/40">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center block">Dias</label>
              <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className="h-10 rounded-xl bg-background border-0 text-center font-black" />
            </div>
            <div className="space-y-2 bg-muted/20 p-3 rounded-2xl border border-border/40">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center block">Horas/Dia</label>
              <Input type="number" min={1} max={12} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="h-10 rounded-xl bg-background border-0 text-center font-black" />
            </div>
          </div>
          <Button onClick={run} disabled={loading || !topic.trim()} className="w-full h-14 rounded-2xl font-black text-base shadow-lg bg-amber-500 hover:bg-amber-600 text-white mt-2 transition-transform hover:scale-[1.02]">
            {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <BrainCircuit className="h-5 w-5 mr-2" />} Estruturar Cronograma
          </Button>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        {plan.length > 0 ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Cronograma</h4>
            {plan.map((d, i) => (
              <Card key={i} className="rounded-[28px] border border-border/30 bg-card shadow-sm overflow-hidden">
                <div className="bg-amber-500/10 px-5 py-3 border-b border-border/30">
                  <span className="text-sm font-black text-amber-600 uppercase tracking-widest">{d.day}</span>
                </div>
                <div className="p-3 space-y-2">
                  {d.blocks.map((b, j) => (
                    <div key={j} className="flex gap-4 p-3 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="bg-background border border-border/50 rounded-xl px-3 py-2 h-fit shrink-0 shadow-sm">
                        <span className="text-xs font-black text-foreground">{b.time}</span>
                      </div>
                      <div className="min-w-0 py-1">
                        <p className="font-bold text-sm text-foreground leading-tight">{b.topic}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground mt-1 leading-relaxed">{b.goal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-full opacity-40 border-2 border-dashed border-border/50 rounded-[32px] p-10">
            <CalendarClock className="h-16 w-16 mb-4 text-muted-foreground" />
            <p className="font-black text-lg text-center">Cronograma Vazio</p>
          </div>
        )}
      </div>
    </div>
  );
}
