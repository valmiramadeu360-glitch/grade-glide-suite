// EduFlow — Leitura do Atestado de Matrícula (OCR + IA estruturada)
// Recebe a URL assinada (privada, de curta duração) do PDF já enviado ao
// bucket 'atestados' e devolve os dados extraídos, SEM aplicar nada ainda —
// a aplicação só acontece depois que o aluno confirma na tela (Fase 2 do
// módulo Comunidades exige essa confirmação explícita).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Você é o EduFlow AI. Você recebe o PDF de um atestado/histórico de matrícula universitária e deve extrair os dados em JSON estrito, sem nenhum texto fora do JSON.

Regras obrigatórias:
- Use APENAS o que está realmente escrito no documento. Nunca invente nomes, códigos ou disciplinas que não apareçam.
- Se um campo não existir no documento, use null (nunca invente um valor plausível).
- "shift" deve ser um destes valores quando identificável: "Matutino", "Vespertino", "Noturno", "EAD", ou null.
- Responda SOMENTE com um JSON no formato exato abaixo, nada antes ou depois:

{
  "student": {
    "full_name": string | null,
    "registration_number": string | null,
    "university_name": string | null,
    "campus_name": string | null,
    "course_name": string | null,
    "shift": string | null,
    "period_number": number | null,
    "semester_label": string | null,
    "status": string | null
  },
  "disciplines": [
    {
      "code": string | null,
      "name": string,
      "professor": string | null,
      "class_section": string | null,
      "shift": string | null,
      "schedule": string | null,
      "room": string | null,
      "block": string | null
    }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Não autenticado");
    const userId = userData.user.id;

    const { fileUrl, filePath } = await req.json();
    if (!fileUrl || !filePath) throw new Error("fileUrl e filePath são obrigatórios");

    // Confere que o arquivo pertence mesmo ao usuário logado (pasta = user_id).
    if (!filePath.startsWith(`${userId}/`)) throw new Error("Arquivo não pertence ao usuário atual");

    // Baixa o PDF (via URL assinada) e reenvia como base64 pro gateway de IA.
    const fileResp = await fetch(fileUrl);
    if (!fileResp.ok) throw new Error("Não foi possível ler o PDF enviado");
    const fileBuffer = await fileResp.arrayBuffer();
    const base64Pdf = btoa(new Uint8Array(fileBuffer).reduce((acc, b) => acc + String.fromCharCode(b), ""));
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste atestado de matrícula seguindo o formato JSON exigido." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite temporário atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`Gateway error ${aiResp.status}: ${t}`);
    }

    const aiData = await aiResp.json();
    const raw: string = (aiData.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/,"").trim();

    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch {
      throw new Error("Não consegui ler os dados desse documento. Tente uma foto/PDF mais nítido do atestado.");
    }

    if (!parsed?.disciplines || !Array.isArray(parsed.disciplines)) {
      throw new Error("O documento não parece ser um atestado de matrícula reconhecível.");
    }

    // Salva a extração como pendente — a aplicação de fato só acontece
    // quando o aluno confirmar (chamando apply_atestado_import).
    const { data: importRow, error: insertError } = await supabase
      .from("atestado_imports")
      .insert({ user_id: userId, file_path: filePath, extracted_data: parsed, status: "pending" })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ importId: importRow.id, extracted: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("atestado-ocr error:", err);
    return new Response(JSON.stringify({ error: String((err as any)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
