// EduFlow AI Assistant — Powered by Lovable AI Gateway (Gemini)
// Actions: chat | summarize | flashcards | study_plan

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Action = "chat" | "summarize" | "flashcards" | "study_plan";

function buildMessages(action: Action, payload: any) {
  const sys = {
    chat:
      "Você é o EduFlow AI, um tutor acadêmico brasileiro integrado ao app EduFlow. Você conhece o contexto do aluno (universidade, curso, período, disciplinas, próximos prazos e ações recentes no app) e usa essas informações para dar respostas personalizadas, práticas e didáticas em português. Use markdown quando ajudar.",
    summarize:
      "Você é um assistente que gera resumos acadêmicos concisos, estruturados em tópicos e subtópicos, em português. Destaque conceitos-chave em negrito.",
    flashcards:
      "Você gera flashcards de estudo. Responda APENAS com JSON válido no formato: {\"cards\":[{\"front\":\"pergunta\",\"back\":\"resposta\"}]}. Sem texto extra, sem markdown.",
    study_plan:
      "Você monta planos de estudo semanais realistas. Responda APENAS com JSON: {\"plan\":[{\"day\":\"Segunda\",\"blocks\":[{\"time\":\"08:00-09:00\",\"topic\":\"...\",\"goal\":\"...\"}]}]}. Sem texto extra.",
  }[action];

  const user =
    action === "chat"
      ? payload.message
      : action === "summarize"
      ? `Resuma o seguinte conteúdo:\n\n${payload.content}`
      : action === "flashcards"
      ? `Gere ${payload.count ?? 8} flashcards sobre:\n\n${payload.content}`
      : `Monte um plano de estudos para ${payload.days ?? 7} dias, ${payload.hoursPerDay ?? 2}h/dia, sobre: ${payload.topic}. Objetivo: ${payload.goal ?? "revisão geral"}.`;

  const messages: any[] = [{ role: "system", content: sys }];
  if (payload.context && typeof payload.context === "string" && payload.context.trim()) {
    messages.push({
      role: "system",
      content: `Contexto do usuário no EduFlow (use para personalizar respostas):\n${payload.context}`,
    });
  }
  if (Array.isArray(payload.history)) {
    for (const m of payload.history.slice(-10)) {
      if (m?.role && m?.content) messages.push({ role: m.role, content: String(m.content) });
    }
  }
  messages.push({ role: "user", content: user });
  return messages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    const action = (body.action ?? "chat") as Action;
    const messages = buildMessages(action, body);

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: body.model ?? DEFAULT_MODEL, messages }),
    });

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite temporário atingido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Gateway error ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Para actions estruturadas, tenta parsear JSON
    let parsed: any = null;
    if (action === "flashcards" || action === "study_plan") {
      try {
        const clean = content.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = null;
      }
    }

    return new Response(JSON.stringify({ content, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-assistant error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});