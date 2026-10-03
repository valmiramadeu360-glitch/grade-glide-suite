/**
 * Marketplace do EduConect — tipos, constantes e consultas compartilhadas.
 * Fotos e logos ficam no bucket público "post-media", na pasta do próprio usuário.
 * O banco guarda o caminho do arquivo; `mediaUrl` converte para URL pública.
 */
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Briefcase, UtensilsCrossed, type LucideIcon } from "lucide-react";

export const MEDIA_BUCKET = "post-media";

export type ShopTipo = "produto" | "servico" | "restaurante";
export type ListingTipo = "produto" | "servico" | "prato";
export type Condicao = "novo" | "usado" | "seminovo";

export interface Section {
  id: ShopTipo;
  listingTipo: ListingTipo;
  label: string;
  icon: LucideIcon;
  categories: string[];
}

export const SECTIONS: Section[] = [
  {
    id: "produto", listingTipo: "produto", label: "Produtos", icon: ShoppingBag,
    categories: ["Livros e Apostilas", "Eletrônicos", "Celulares", "Vestuário", "Moradia/Kitnet", "Fretes", "Material de laboratório", "Outros"],
  },
  {
    id: "servico", listingTipo: "servico", label: "Serviços", icon: Briefcase,
    categories: ["Aulas e monitoria", "Revisão de textos", "Formatação ABNT", "Design", "Programação", "Tradução", "Fotografia", "Fretes e mudanças", "Outros"],
  },
  {
    id: "restaurante", listingTipo: "prato", label: "Comida", icon: UtensilsCrossed,
    categories: ["Marmitas", "Lanches", "Doces", "Salgados", "Bebidas", "Fit", "Vegano", "Outros"],
  },
];

export const PRODUTO_CATEGORIAS = SECTIONS[0].categories;

export const sectionOf = (tipo: ShopTipo | ListingTipo) =>
  SECTIONS.find((s) => s.id === tipo || s.listingTipo === tipo) ?? SECTIONS[0];

export const CONDICOES = [
  { id: "novo", label: "Novo" },
  { id: "seminovo", label: "Seminovo" },
  { id: "usado", label: "Usado" },
] as const;

export const CONDICAO_LABEL: Record<Condicao, string> = { novo: "Novo", usado: "Usado", seminovo: "Seminovo" };

export interface Shop {
  id: string;
  owner_user_id: string;
  university_id: string | null;
  tipo: ShopTipo;
  nome: string;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_open: boolean;
  forma_pagamento: string[];
  created_at: string;
}

export interface Listing {
  id: string;
  shop_id: string;
  university_id: string | null;
  tipo: ListingTipo;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  categoria: string | null;
  condicao: Condicao | null;
  prazo_entrega?: string | null;
  modalidade?: "presencial" | "remoto" | null;
  is_active: boolean;
  view_count: number;
  created_at: string;
  photos: string[];
  shop?: Pick<Shop, "id" | "nome" | "logo_url" | "is_verified" | "owner_user_id" | "tipo" | "is_open">;
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  url: string;
  ordem: number;
}

/** Caminho no bucket (ou URL completa) → URL pública. */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function formatPreco(preco: number | null) {
  if (preco == null) return "A combinar";
  if (preco === 0) return "Grátis";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export const formatPrice = formatPreco;

const LISTING_SELECT = "*, listing_photos(url, ordem), shop:shops(id, nome, logo_url, is_verified, owner_user_id, tipo, is_open)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListing(row: any): Listing {
  const photos = [...(row.listing_photos ?? [])]
    .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
    .map((p: { url: string }) => mediaUrl(p.url) as string);
  const shop = row.shop ? { ...row.shop, logo_url: mediaUrl(row.shop.logo_url) } : undefined;
  return { ...row, preco: row.preco == null ? null : Number(row.preco), photos, shop };
}

export async function fetchListings(opts: { tipo?: ListingTipo; shopId?: string; includeInactive?: boolean; limit?: number }) {
  let q = supabase.from("listings").select(LISTING_SELECT).order("created_at", { ascending: false }).limit(opts.limit ?? 120);
  if (opts.tipo) q = q.eq("tipo", opts.tipo);
  if (opts.shopId) q = q.eq("shop_id", opts.shopId);
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapListing);
}

export async function fetchListing(id: string) {
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapListing(data) : null;
}

export async function fetchMyFavoriteIds(userId: string) {
  const { data } = await supabase.from("listing_favorites").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.listing_id));
}

export async function toggleFavorite(userId: string, listingId: string, isFav: boolean) {
  if (isFav) await supabase.from("listing_favorites").delete().eq("user_id", userId).eq("listing_id", listingId);
  else await supabase.from("listing_favorites").insert({ user_id: userId, listing_id: listingId });
}

export function sellerChatLink(sellerId: string, listing?: Pick<Listing, "id" | "titulo" | "preco">) {
  const text = listing
    ? `Olá! Tenho interesse em "${listing.titulo}" (${formatPreco(listing.preco)}). Ainda está disponível?\n${window.location.origin}/marketplace/item/${listing.id}`
    : "Olá! Vi sua loja no Marketplace do EduConect.";
  return `/messages?to=${sellerId}&text=${encodeURIComponent(text)}`;
}
