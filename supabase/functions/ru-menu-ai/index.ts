// EduFlow — RU (Restaurante Universitário): OCR do cardápio + estimativa nutricional + assistente
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(messages: unknown[]) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY!,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
  if (!res.ok) throw new Error(`Falha na IA (${res.status}): ${await res.text()}`);

  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta da IA fora do formato esperado.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    const action = String(body.action ?? "ocr_menu");

    if (action === "ocr_menu") {
      const imageUrl = String(body.imageUrl ?? "");
      if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("https://")) {
        return new Response(JSON.stringify({ error: "Imagem inválida." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const content = await callGateway([
        {
          role: "system",
          content:
            'Você extrai o cardápio de um monitor de Restaurante Universitário a partir de uma foto. Transcreva EXATAMENTE o texto visível, sem inventar itens. Depois estime valores nutricionais por porção padrão. Responda APENAS JSON: {"raw_text":"texto transcrito","items":["item 1","item 2"],"nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0},"vegetarian_option":"texto ou null","allergens":["..."],"tip":"sugestão nutricional curta"}. Se a foto não mostrar um cardápio, retorne items vazio.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva o cardápio desta foto e estime as informações nutricionais." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ]);

      return new Response(JSON.stringify(parseJson(content)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ask") {
      const question = String(body.question ?? "").slice(0, 1000);
      if (!question.trim()) throw new Error("Pergunta vazia.");

      const content = await callGateway([
        {
          role: "system",
          content:
            "Você é o assistente do módulo Restaurante Universitário do EduFlow (UFAL – Campus A. C. Simões). Responda em português, curto e prático, usando SOMENTE os dados de contexto fornecidos (fila atual, histórico de horários de pico, cardápio do dia, horários de funcionamento e avisos). Sempre trate estimativas nutricionais e de fila como aproximadas. Se o dado não existir no contexto, diga que ainda não há informação colaborativa suficiente.",
        },
        { role: "system", content: `Contexto do RU:\n${String(body.context ?? "sem dados")}` },
        { role: "user", content: question },
      ]);

      return new Response(JSON.stringify({ answer: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});