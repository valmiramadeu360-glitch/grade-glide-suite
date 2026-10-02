import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Briefcase, UtensilsCrossed, type LucideIcon } from "lucide-react";

export type ShopTipo = "produto" | "servico" | "restaurante";
export type ListingTipo = "produto" | "servico" | "prato";

export interface Shop {
  id: string;
  owner_user_id: string;
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
  tipo: ListingTipo;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  categoria: string | null;
  condicao: "novo" | "usado" | "seminovo" | null;
  prazo_entrega: string | null;
  modalidade: "presencial" | "remoto" | null;
  is_active: boolean;
  view_count: number;
  created_at: string;
  photos: string[];
  shop?: Pick<Shop, "id" | "nome" | "logo_url" | "is_verified" | "owner_user_id" | "tipo" | "is_open">;
}

export interface Section {
  id: ShopTipo;
  listingTipo: ListingTipo;
  label: string;
  short: string;
  icon: LucideIcon;
  categories: string[];
}

export const SECTIONS: Section[] = [
  {
    id: "produto", listingTipo: "produto", label: "Produtos", short: "Produtos", icon: ShoppingBag,
    categories: ["Livros", "Apostilas", "Eletrônicos", "Celulares", "Roupas", "Móveis", "Material de laboratório", "Transporte e fretes", "Outros"],
  },
  {
    id: "servico", listingTipo: "servico", label: "Serviços", short: "Serviços", icon: Briefcase,
    categories: ["Aulas e monitoria", "Revisão de textos", "Formatação ABNT", "Design", "Programação", "Tradução", "Fotografia", "Fretes e mudanças", "Outros"],
  },
  {
    id: "restaurante", listingTipo: "prato", label: "Comida", short: "Comida", icon: UtensilsCrossed,
    categories: ["Marmitas", "Lanches", "Doces", "Salgados", "Bebidas", "Fit", "Vegano", "Outros"],
  },
];

export const sectionOf = (tipo: ShopTipo | ListingTipo) =>
  SECTIONS.find((s) => s.id === tipo || s.listingTipo === tipo) ?? SECTIONS[0];

export const CONDICOES = [
  { id: "novo", label: "Novo" },
  { id: "seminovo", label: "Seminovo" },
  { id: "usado", label: "Usado" },
] as const;

export const formatPrice = (v: number | null) =>
  v === null || v === undefined
    ? "A combinar"
    : v === 0
      ? "Grátis"
      : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LISTING_SELECT = "*, listing_photos(url, ordem), shop:shops(id, nome, logo_url, is_verified, owner_user_id, tipo, is_open)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListing(row: any): Listing {
  const photos = [...(row.listing_photos ?? [])]
    .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
    .map((p: { url: string }) => p.url);
  return { ...row, preco: row.preco === null ? null : Number(row.preco), photos, shop: row.shop ?? undefined };
}

export async function fetchListings(opts: { tipo?: ListingTipo; shopId?: string; ids?: string[]; includeInactive?: boolean; limit?: number }) {
  let q = supabase.from("listings").select(LISTING_SELECT).order("created_at", { ascending: false }).limit(opts.limit ?? 120);
  if (opts.tipo) q = q.eq("tipo", opts.tipo);
  if (opts.shopId) q = q.eq("shop_id", opts.shopId);
  if (opts.ids) q = q.in("id", opts.ids);
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

export async function uploadMarketImage(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/market_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("post-media").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
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
    ? `Olá! Tenho interesse em "${listing.titulo}" (${formatPrice(listing.preco)}). Ainda está disponível?\n${window.location.origin}/marketplace/item/${listing.id}`
    : "Olá! Vi sua loja no Marketplace do EduConect.";
  return `/messages?to=${sellerId}&text=${encodeURIComponent(text)}`;
}
