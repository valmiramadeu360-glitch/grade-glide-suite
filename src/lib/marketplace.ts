/**
 * Constantes e tipos compartilhados do Marketplace.
 *
 * Nesta fase só o ambiente "produto" está ativo na interface — "servico" e
 * "restaurante" já existem no banco (ver migração 20260921010000) mas ficam
 * escondidos até os ambientes deles serem construídos (Fases 2 e 3).
 */

export type ShopTipo = "produto" | "servico" | "restaurante";
export type ListingTipo = "produto" | "servico" | "prato";
export type Condicao = "novo" | "usado" | "seminovo";

export const PRODUTO_CATEGORIAS = [
  "Livros e Apostilas",
  "Eletrônicos",
  "Celulares",
  "Vestuário",
  "Moradia/Kitnet",
  "Fretes",
  "Outros",
] as const;

export const CONDICAO_LABEL: Record<Condicao, string> = {
  novo: "Novo",
  usado: "Usado",
  seminovo: "Seminovo",
};

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
  is_active: boolean;
  view_count: number;
  created_at: string;
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  url: string;
  ordem: number;
}

export function formatPreco(preco: number | null) {
  if (preco == null) return "A combinar";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
