import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { BOTTOM_NAV_HEIGHT } from "@/components/BottomNavigation";
import { cn } from "@/lib/utils";

/* ============================================================
   EDU — assistente flutuante
   • Círculo arrastável (fica onde o aluno deixar; gruda na lateral).
   • Sabe em que tela o aluno está e ajusta ajuda e sugestões.
   ============================================================ */

type ScreenKey = "feed" | "market" | "news" | "utilities" | "communities" | "academic" | "profile" | "other";

const SCREENS: Record<ScreenKey, { label: string; greeting: string; suggestions: string[] }> = {
  feed: {
    label: "Feed",
    greeting: "Posso ajudar a escrever um post ou a resumir uma discussão.",
    suggestions: ["Me ajude a escrever um post sobre…", "Resuma esta discussão para mim:", "Ideias de post para a minha turma"],
  },
  market: {
    label: "Mercado",
    greeting: "Posso ajudar a precificar, descrever seu anúncio e negociar com segurança.",
    suggestions: ["Quanto devo cobrar pelo meu produto?", "Escreva a descrição do meu anúncio", "Dicas para negociar com segurança"],
  },
  news: {
    label: "Notícias",
    greeting: "Posso resumir uma notícia ou explicar um edital em poucas palavras.",
    suggestions: ["Resuma esta notícia para mim:", "Explique este edital de forma simples:", "Como criar um canal de notícias?"],
  },
  utilities: {
    label: "Utilitários",
    greeting: "Posso explicar como usar o RU, o circular, o mapa e a biblioteca.",
    suggestions: ["Como funciona a fila do RU?", "Onde vejo os horários do circular?", "Como reservar uma sala na biblioteca?"],
  },
  communities: {
    label: "Comunidades",
    greeting: "Posso ajudar a organizar um grupo de estudo ou uma república.",
    suggestions: ["Como criar um grupo de estudo?", "Escreva uma mensagem de boas-vindas para o grupo", "Ideias para organizar as contas da república"],
  },
  academic: {
    label: "Vida acadêmica",
    greeting: "Posso montar um plano de estudos, explicar um conceito ou criar flashcards.",
    suggestions: ["Monte um plano de estudos para esta semana", "Explique este conceito de forma simples:", "Crie flashcards deste resumo:"],
  },
  profile: {
    label: "Perfil",
    greeting: "Posso ajudar a escrever uma bio objetiva para o seu perfil.",
    suggestions: ["Escreva uma bio para o meu perfil", "O que colocar nos meus links?"],
  },
  other: {
    label: "EduConect",
    greeting: "Como posso ajudar?",
    suggestions: ["O que posso fazer no EduConect?", "Me ajude a organizar meus estudos"],
  },
};

function detectScreen(pathname: string, tab: string | null): ScreenKey {
  if (pathname.startsWith("/campus")) return "utilities";
  if (pathname.startsWith("/communit") || pathname.startsWith("/messages")) return "communities";
  if (pathname === "/connect" || pathname === "/") {
    if (tab === "market") return "market";
    if (tab === "news") return "news";
    return "feed";
  }
  if (["/academico", "/disciplines", "/reminders", "/assistant"].some((p) => pathname.startsWith(p))) return "academic";
  if (pathname.startsWith("/profile")) return "profile";
  return "other";
}

/* ---------------- posição do círculo ---------------- */

const SIZE = 56;
const MARGIN = 12;
const TOP_LIMIT = 76;
const STORAGE_KEY = "educonect:edu-anchor";

interface Anchor { side: "left" | "right"; ry: number }

function loadAnchor(): Anchor {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if ((parsed.side === "left" || parsed.side === "right") && typeof parsed.ry === "number") {
        return { side: parsed.side, ry: Math.min(1, Math.max(0, parsed.ry)) };
      }
    }
  } catch { /* storage indisponível: usa o padrão */ }
  return { side: "right", ry: 0.8 };
}

function getBounds(w: number, h: number) {
  const bottomReserve = w >= 1024 ? MARGIN : BOTTOM_NAV_HEIGHT + MARGIN + 28; // 28 ≈ área do indicador do iOS
  return {
    minX: MARGIN,
    maxX: Math.max(MARGIN, w - SIZE - MARGIN),
    minY: TOP_LIMIT,
    maxY: Math.max(TOP_LIMIT, h - SIZE - bottomReserve),
  };
}

/* ---------------- chat ---------------- */

interface ChatMessage { role: "user" | "assistant"; content: string }

async function readFunctionError(err: any): Promise<string> {
  try {
    const body = await err?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch { /* corpo ilegível */ }
  return "Não consegui responder agora. Tente de novo em instantes.";
}

export function EduAssistant() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { profile, university, campusName, courseName } = useTenant();
  const isMobile = useIsMobile();

  const screenKey = detectScreen(pathname, params.get("tab"));
  const screen = SCREENS[screenKey];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ----- arraste ----- */
  const [anchor, setAnchor] = useState<Anchor>(loadAnchor);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef({ pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, moved: false, suppressClick: false });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const bounds = getBounds(viewport.w, viewport.h);
  const base = {
    x: anchor.side === "left" ? bounds.minX : bounds.maxX,
    y: bounds.minY + anchor.ry * (bounds.maxY - bounds.minY),
  };
  const shown = dragPos ?? base;

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    d.pointerId = e.pointerId;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.originX = shown.x;
    d.originY = shown.y;
    d.moved = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setDragPos({
      x: clamp(d.originX + dx, bounds.minX, bounds.maxX),
      y: clamp(d.originY + dy, bounds.minY, bounds.maxY),
    });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (d.pointerId !== e.pointerId) return;
    d.pointerId = -1;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    if (d.moved && dragPos) {
      d.suppressClick = true; // o "click" que vem logo depois do arraste não deve abrir o chat
      const side: Anchor["side"] = dragPos.x + SIZE / 2 < viewport.w / 2 ? "left" : "right";
      const span = Math.max(1, bounds.maxY - bounds.minY);
      const next: Anchor = { side, ry: clamp((dragPos.y - bounds.minY) / span, 0, 1) };
      setAnchor(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      setDragPos(null);
    }
  }

  function onClick() {
    if (drag.current.suppressClick) {
      drag.current.suppressClick = false;
      return;
    }
    setOpen(true);
  }

  /* ----- conversa ----- */
  const context = useMemo(() => {
    const parts = [`Tela atual: ${screen.label}.`];
    if (university) parts.push(`Universidade: ${university.name} (${university.acronym}).`);
    if (campusName) parts.push(`Campus: ${campusName}.`);
    if (courseName) parts.push(`Curso: ${courseName}.`);
    if (profile?.current_period) parts.push(`Período: ${profile.current_period}º.`);
    return parts.join(" ");
  }, [screen.label, university, campusName, courseName, profile?.current_period]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "chat", message, history, context, screen: screenKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: String(data?.content ?? "").trim() || "Não consegui formular uma resposta. Pode reformular?" }]);
    } catch (err: any) {
      // Erros HTTP da função (limite, créditos) trazem o motivo no corpo da resposta.
      const friendly = err?.context ? await readFunctionError(err) : err?.message || "Não consegui responder agora. Tente de novo em instantes.";
      setMessages((prev) => [...prev, { role: "assistant", content: friendly }]);
    } finally {
      setSending(false);
    }
  }

  function pickSuggestion(text: string) {
    if (text.endsWith("…") || text.endsWith(":")) {
      setInput(text.endsWith("…") ? text.slice(0, -1) : `${text} `);
      inputRef.current?.focus();
    } else {
      send(text);
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <>
      {/* Círculo flutuante (some enquanto o chat está aberto) */}
      {!open && (
        <button
          type="button"
          aria-label="Falar com a Edu"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          style={{
            width: SIZE,
            height: SIZE,
            transform: `translate3d(${shown.x}px, ${shown.y}px, 0)`,
            touchAction: "none",
          }}
          className={cn(
            "fixed left-0 top-0 z-[45] flex select-none items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-[0_10px_30px_-6px_hsl(var(--primary)/0.55)]",
            "ring-4 ring-background/60 active:scale-95",
            dragPos ? "cursor-grabbing" : "cursor-grab transition-transform duration-300 ease-out",
          )}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 bg-background/95 p-0 backdrop-blur-2xl",
            isMobile ? "h-[88dvh] rounded-t-[28px]" : "w-[26rem] sm:max-w-[26rem]",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4 pr-14">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-extrabold leading-tight">Edu</SheetTitle>
              <SheetDescription className="truncate text-xs">Você está em: {screen.label}</SheetDescription>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                aria-label="Nova conversa"
                title="Nova conversa"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 text-sm leading-relaxed">{screen.greeting}</div>
                <div className="flex flex-wrap gap-2">
                  {screen.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="min-h-[40px] rounded-full border border-border/60 bg-background px-4 py-2 text-left text-sm font-semibold hover:bg-muted/50 active:scale-[0.98]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-tl-md bg-muted/60",
                    )}
                  >
                    <RichText text={m.content} />
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 border-t border-border/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
              onKeyDown={(e) => {
                // No computador, Enter envia e Shift+Enter quebra linha. No celular, Enter quebra linha.
                if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); send(input); }
              }}
              placeholder="Pergunte qualquer coisa"
              maxLength={2000}
              className="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-base leading-snug outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Enviar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40 active:scale-95"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* Renderização simples: **negrito** e listas com "-", "*" ou "•". */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 break-words">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bullet = /^\s*([-*•])\s+/.exec(line);
        const content = bullet ? line.slice(bullet[0].length) : line;
        return (
          <p key={i} className={cn(bullet && "flex gap-2")}>
            {bullet && <span aria-hidden>•</span>}
            <span>{renderInline(content)}</span>
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  );
}
