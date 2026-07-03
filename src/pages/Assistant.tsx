import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, FileText, Layers, CalendarClock, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Flashcard = { front: string; back: string };
type PlanBlock = { time: string; topic: string; goal: string };
type PlanDay = { day: string; blocks: PlanBlock[] };

async function invokeAI(body: Record<string, unknown>, userId?: string) {
  const context = userId ? await buildUserContext(userId) : "";
  const { data, error } = await supabase.functions.invoke("ai-assistant", {
    body: { ...body, context },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { content: string; parsed: any };
}

async function buildUserContext(userId: string): Promise<string> {
  try {
    const [{ data: profile }, { data: disciplines }, { data: reminders }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, university_id, campus_id, course_id, current_period, current_semester_label, bio, career_goals, universities(name), campuses(name), courses(name)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("disciplines")
        .select("name, professor, current_grade")
        .eq("user_id", userId)
        .eq("archived", false)
        .limit(15),
      supabase
        .from("reminders")
        .select("title, due_date, type")
        .eq("user_id", userId)
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(10),
    ]);
    const parts: string[] = [];
    if (profile) {
      parts.push(`Nome: ${profile.full_name ?? "-"}`);
      const uni = (profile as any).universities?.name;
      const camp = (profile as any).campuses?.name;
      const course = (profile as any).courses?.name;
      if (uni) parts.push(`Universidade: ${uni}`);
      if (camp) parts.push(`Campus: ${camp}`);
      if (course) parts.push(`Curso: ${course}`);
      if (profile.current_period) parts.push(`Período: ${profile.current_period}`);
      if (profile.current_semester_label) parts.push(`Semestre: ${profile.current_semester_label}`);
      if (profile.career_goals) parts.push(`Objetivos: ${profile.career_goals}`);
    }
    if (disciplines?.length) {
      parts.push(
        `Disciplinas em curso: ${disciplines
          .map((d: any) => `${d.name}${d.professor ? ` (Prof. ${d.professor})` : ""}${d.current_grade != null ? ` [nota ${d.current_grade}]` : ""}`)
          .join("; ")}`,
      );
    }
    if (reminders?.length) {
      parts.push(
        `Próximos prazos: ${reminders
          .map((r: any) => `${r.title} — ${new Date(r.due_date).toLocaleDateString("pt-BR")}`)
          .join("; ")}`,
      );
    }
    return parts.join("\n");
  } catch {
    return "";
  }
}

export default function Assistant() {
  const { user } = useAuth();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistente IA</h1>
          <Badge variant="secondary" className="ml-2">Gemini</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Tire dúvidas, gere resumos, flashcards e planos de estudo personalizados.
        </p>
      </header>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat"><Sparkles className="h-4 w-4 mr-1.5" />Chat</TabsTrigger>
          <TabsTrigger value="summary"><FileText className="h-4 w-4 mr-1.5" />Resumo</TabsTrigger>
          <TabsTrigger value="flashcards"><Layers className="h-4 w-4 mr-1.5" />Flashcards</TabsTrigger>
          <TabsTrigger value="plan"><CalendarClock className="h-4 w-4 mr-1.5" />Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="chat"><ChatTab userId={user?.id} /></TabsContent>
        <TabsContent value="summary"><SummaryTab userId={user?.id} /></TabsContent>
        <TabsContent value="flashcards"><FlashcardsTab userId={user?.id} /></TabsContent>
        <TabsContent value="plan"><StudyPlanTab userId={user?.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- CHAT --------------------------- */
function ChatTab({ userId }: { userId?: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { content } = await invokeAI(
        { action: "chat", message: text, history: messages },
        userId,
      );
      setMessages((m) => [...m, { role: "assistant", content }]);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar a IA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Conversa com o tutor</CardTitle>
        <CardDescription>Pergunte qualquer coisa sobre suas disciplinas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-[420px] rounded-lg border bg-muted/20 p-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-16">
              Faça uma pergunta para começar. Ex.: "Explique o teorema de Bayes com um exemplo."
            </p>
          )}
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border bg-card px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escreva sua pergunta..."
            rows={2}
            className="resize-none"
          />
          <Button onClick={send} disabled={loading || !input.trim()} className="self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- SUMMARY --------------------------- */
function SummaryTab({ userId }: { userId?: string }) {
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const { content: out } = await invokeAI({ action: "summarize", content }, userId);
      setResult(out);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumo inteligente</CardTitle>
        <CardDescription>Cole textos, anotações ou trechos de livros.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Cole aqui o conteúdo a resumir..."
          rows={8}
        />
        <Button onClick={run} disabled={loading || !content.trim()}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Gerar resumo
        </Button>
        {result && (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap">{result}</div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- FLASHCARDS --------------------------- */
function FlashcardsTab({ userId }: { userId?: string }) {
  const [content, setContent] = useState("");
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const { parsed, content: raw } = await invokeAI({ action: "flashcards", content, count }, userId);
      if (parsed?.cards?.length) {
        setCards(parsed.cards);
        setFlipped({});
      } else {
        toast.error("Não foi possível interpretar os flashcards.");
        console.log(raw);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar flashcards");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Flashcards</CardTitle>
        <CardDescription>Estude por repetição espaçada com cartões gerados por IA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Assunto ou texto de referência..."
          rows={5}
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={3}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">cartões</span>
          <Button onClick={run} disabled={loading || !content.trim()} className="ml-auto">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
            Gerar
          </Button>
        </div>

        {cards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((c, i) => (
              <button
                key={i}
                onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
                className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 transition min-h-[110px]"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {flipped[i] ? "Resposta" : "Pergunta"} <RotateCw className="h-3 w-3" />
                </div>
                <p className="text-sm">{flipped[i] ? c.back : c.front}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- STUDY PLAN --------------------------- */
function StudyPlanTab({ userId }: { userId?: string }) {
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
      const { parsed, content: raw } = await invokeAI(
        { action: "study_plan", topic, goal, days, hoursPerDay },
        userId,
      );
      if (parsed?.plan?.length) setPlan(parsed.plan);
      else {
        toast.error("Não foi possível interpretar o plano.");
        console.log(raw);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar plano");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Plano de estudos</CardTitle>
        <CardDescription>Uma rotina realista, dividida por dia e bloco.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema (ex.: Direito Constitucional)" />
        <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Objetivo (ex.: prova em 2 semanas)" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Dias</label>
            <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Horas/dia</label>
            <Input type="number" min={1} max={12} value={hoursPerDay} onChange={(e) => setHoursPerDay(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={run} disabled={loading || !topic.trim()}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
          Montar plano
        </Button>

        {plan.length > 0 && (
          <div className="space-y-3 pt-2">
            {plan.map((d, i) => (
              <div key={i} className="rounded-lg border bg-card">
                <div className="border-b px-4 py-2 text-sm font-semibold">{d.day}</div>
                <div className="divide-y">
                  {d.blocks.map((b, j) => (
                    <div key={j} className="grid grid-cols-[80px_1fr] gap-3 px-4 py-2 text-sm">
                      <span className="text-xs font-medium text-primary">{b.time}</span>
                      <div>
                        <p className="font-medium">{b.topic}</p>
                        <p className="text-xs text-muted-foreground">{b.goal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}