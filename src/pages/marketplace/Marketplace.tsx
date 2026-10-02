import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Store, Heart, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ListingCard } from "@/components/marketplace/ListingCard";
import {
  CONDICOES, SECTIONS, fetchListings, fetchMyFavoriteIds, toggleFavorite, type Listing, type ShopTipo,
} from "@/lib/marketplace";

type Sort = "recent" | "price_asc" | "price_desc" | "popular";

export default function Marketplace() {
  const { user } = useAuth();
  const { university } = useTenant();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const sectionId = (params.get("s") as ShopTipo) || "produto";
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condicao, setCondicao] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCategory(null);
    setCondicao(null);
    fetchListings({ tipo: section.listingTipo })
      .then((d) => alive && setListings(d))
      .catch(() => alive && setListings([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [section.listingTipo]);

  useEffect(() => {
    if (user) fetchMyFavoriteIds(user.id).then(setFavs);
  }, [user]);

  async function onFav(id: string) {
    if (!user) return;
    const isFav = favs.has(id);
    setFavs((prev) => { const n = new Set(prev); if (isFav) n.delete(id); else n.add(id); return n; });
    await toggleFavorite(user.id, id, isFav);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const list = listings.filter((l) => {
      if (onlyFavs && !favs.has(l.id)) return false;
      if (category && l.categoria !== category) return false;
      if (condicao && l.condicao !== condicao) return false;
      if (min !== null && (l.preco ?? 0) < min) return false;
      if (max !== null && (l.preco ?? 0) > max) return false;
      if (q && !`${l.titulo} ${l.descricao ?? ""} ${l.shop?.nome ?? ""} ${l.categoria ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const s = [...list];
    if (sort === "price_asc") s.sort((a, b) => (a.preco ?? 0) - (b.preco ?? 0));
    if (sort === "price_desc") s.sort((a, b) => (b.preco ?? 0) - (a.preco ?? 0));
    if (sort === "popular") s.sort((a, b) => b.view_count - a.view_count);
    return s;
  }, [listings, search, category, condicao, minPrice, maxPrice, sort, onlyFavs, favs]);

  const activeFilters = [minPrice, maxPrice, condicao].filter(Boolean).length + (sort !== "recent" ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 animate-in fade-in duration-300">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight">Marketplace</h1>
          <p className="truncate text-xs font-semibold text-muted-foreground">
            Compre, contrate e peça comida no {university?.acronym ?? "seu campus"}
          </p>
        </div>
        <Button onClick={() => navigate("/marketplace/minha-loja")} className="h-11 shrink-0 rounded-2xl font-bold">
          <Store className="mr-2 h-4 w-4" /> Minha loja
        </Button>
      </header>

      {/* Seções */}
      <div className="grid grid-cols-3 gap-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = s.id === section.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setParams({ s: s.id }, { replace: true })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all active:scale-95",
                active ? "border-primary bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-bold">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar em ${section.label.toLowerCase()}...`}
            className="h-12 rounded-2xl bg-card pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => setFiltersOpen(true)} className="relative h-12 w-12 rounded-2xl" aria-label="Filtros">
          <SlidersHorizontal className="h-5 w-5" />
          {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilters}</span>}
        </Button>
        <Button variant={onlyFavs ? "default" : "outline"} size="icon" onClick={() => setOnlyFavs((v) => !v)} className="h-12 w-12 rounded-2xl" aria-label="Favoritos">
          <Heart className={cn("h-5 w-5", onlyFavs && "fill-current")} />
        </Button>
      </div>

      {/* Categorias */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        <Chip active={!category} onClick={() => setCategory(null)}>Tudo</Chip>
        {section.categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>{c}</Chip>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 py-14 text-center">
          <section.icon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-bold">Nada por aqui ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a anunciar em {section.label.toLowerCase()}.</p>
          <Button className="mt-4 rounded-2xl" onClick={() => navigate(`/marketplace/minha-loja?s=${section.id}`)}>Começar a vender</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} isFav={favs.has(l.id)} onToggleFav={() => onFav(l.id)} />
          ))}
        </div>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <div className="flex items-center gap-2">
                <Input inputMode="decimal" placeholder="Mín." value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="h-11 rounded-xl" />
                <span className="text-muted-foreground">–</span>
                <Input inputMode="decimal" placeholder="Máx." value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="h-11 rounded-xl" />
              </div>
            </div>
            {section.id === "produto" && (
              <div className="space-y-2">
                <Label>Condição</Label>
                <div className="flex flex-wrap gap-2">
                  {CONDICOES.map((c) => <Chip key={c.id} active={condicao === c.id} onClick={() => setCondicao(condicao === c.id ? null : c.id)}>{c.label}</Chip>)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <div className="flex flex-wrap gap-2">
                {([["recent", "Mais recentes"], ["price_asc", "Menor preço"], ["price_desc", "Maior preço"], ["popular", "Mais vistos"]] as const).map(([id, label]) => (
                  <Chip key={id} active={sort === id} onClick={() => setSort(id)}>{label}</Chip>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={() => { setMinPrice(""); setMaxPrice(""); setCondicao(null); setSort("recent"); }}>
                <X className="mr-1 h-4 w-4" /> Limpar
              </Button>
              <Button className="h-12 flex-1 rounded-2xl" onClick={() => setFiltersOpen(false)}>Ver {filtered.length} resultados</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/50 bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
