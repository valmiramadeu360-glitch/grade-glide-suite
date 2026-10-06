import { supabase } from "@/integrations/supabase/client";

export const NEWS_BUCKET = "post-media";

export const JOURNAL_CATEGORIES = [
  { value: "institucional", label: "Oficial / Institucional" },
  { value: "centro_academico", label: "Centro Acadêmico / D.A." },
  { value: "curso", label: "Curso & Liga Acadêmica" },
  { value: "cultura", label: "Cultura & Eventos" },
  { value: "opiniao", label: "Opinião & Debate" },
  { value: "ciencia", label: "Ciência & Pesquisa" },
  { value: "radio", label: "Rádio / Podcast" },
] as const;

export const ARTICLE_CATEGORIES = [
  "Campus", "Editais & Bolsas", "Ciência", "Cultura", "Opinião", "Esportes", "Política Estudantil", "Entrevista",
] as const;

export const JOURNAL_STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
};

export const EDITORIAL_TERMS = [
  "Não publicarei informações falsas, boatos ou conteúdo manipulado (fake news).",
  "Checarei fontes e corrigirei publicamente erros quando identificados.",
  "Não publicarei difamação, discurso de ódio, assédio ou exposição de dados pessoais.",
  "Respeitarei direitos autorais de textos, fotos e marcas.",
  "Entendo que o EduConect pode suspender ou remover o perfil do jornal em caso de descumprimento.",
];

export function categoryLabel(v?: string | null) {
  return JOURNAL_CATEGORIES.find((c) => c.value === v)?.label ?? "Jornal";
}

export function normalizeHandle(raw: string) {
  return raw
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
}

/** Estimativa de leitura: ~200 palavras por minuto, mínimo 1. */
export function readMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Comprime no dispositivo (JPEG/WebP, lado máx. 1600px) antes de enviar. */
async function compress(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/webp", 0.85));
}

export async function uploadNewsImage(userId: string, file: File) {
  const blob = await compress(file);
  const path = `${userId}/news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from(NEWS_BUCKET).upload(path, blob, { contentType: "image/webp" });
  if (error) throw error;
  return supabase.storage.from(NEWS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type ArticleBlock =
  | { type: "h"; text: string }
  | { type: "quote"; text: string }
  | { type: "img"; url: string }
  | { type: "list"; items: string[] }
  | { type: "p"; text: string };

/** Formato leve: "## " intertítulo, "> " citação, "- " lista, "![](url)" imagem. */
export function parseArticle(content: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const chunk of content.split(/\n{2,}/)) {
    const t = chunk.trim();
    if (!t) continue;
    const img = t.match(/^!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/);
    if (img) blocks.push({ type: "img", url: img[1] });
    else if (t.startsWith("## ")) blocks.push({ type: "h", text: t.slice(3) });
    else if (t.startsWith("> ")) blocks.push({ type: "quote", text: t.replace(/^> ?/gm, "") });
    else if (t.split("\n").every((l) => l.trim().startsWith("- ")))
      blocks.push({ type: "list", items: t.split("\n").map((l) => l.trim().slice(2)) });
    else blocks.push({ type: "p", text: t });
  }
  return blocks;
}

export function plainExcerpt(content: string, len = 180) {
  const txt = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/^(## |> |- )/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ").trim();
  return txt.length > len ? txt.slice(0, len).trimEnd() + "…" : txt;
}

export interface Journal {
  id: string;
  name: string;
  handle: string | null;
  description: string | null;
  category: string | null;
  editorial_line: string | null;
  purpose: string | null;
  team_note: string | null;
  logo_url: string | null;
  banner_url: string | null;
  accent_color: string | null;
  status: string;
  scope: string;
  member_count: number;
  created_by: string | null;
  review_note: string | null;
  created_at: string;
}

export interface Article {
  id: string;
  channel_id: string;
  author_id: string;
  title: string;
  subtitle: string | null;
  content: string;
  cover_url: string | null;
  category: string | null;
  status: string;
  read_minutes: number;
  like_count: number;
  pinned: boolean;
  published_at: string;
  news_channels?: Pick<Journal, "id" | "name" | "handle" | "logo_url" | "scope"> | null;
}

export const ARTICLE_SELECT = "*, news_channels(id, name, handle, logo_url, scope)";
