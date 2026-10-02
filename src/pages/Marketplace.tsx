import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2, Search, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/Marketplace/ListingCard";
import { PRODUTO_CATEGORIAS, type Listing } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

// Tabela "listings" ainda não está no types.ts gerado — cast temporário.
const db = supabase as any;

interface ListingRow extends Listing {
  coverUrl: string | null;
}

export default function Marketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = db
      .from("listings")
      .select("*, listing_photos(url, ordem)")
      .eq("tipo", "produto")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);

    if (categoria) query = query.eq("categoria", categoria);
    if (search.trim().length >= 2) query = query.ilike("titulo", `%${search.trim()}%`);

    const { data } = await query;
    setListings(
      (data ?? []).map((r: any) => {
        const firstPhoto = [...(r.listing_photos ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
        return { ...r, coverUrl: firstPhoto ? supabase.storage.from("marketplace-media").getPublicUrl(firstPhoto.url).data.publicUrl : null };
      }),
    );
    setLoading(false);
  }, [categoria, search]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!user) return;
    db.from("listing_favorites").select("listing_id").eq("user_id", user.id).then(({ data }: any) => {
      setFavorites(new Set((data ?? []).map((f: any) => f.listing_id)));
    });
  }, [user]);

  async function toggleFavorite(listingId: string) {
    if (!user) return;
    const isFav = favorites.has(listingId);
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(listingId) : next.add(listingId);
      return next;
    });
    if (isFav) {
      await db.from("listing_favorites").delete().eq("listing_id", listingId).eq("user_id", user.id);
    } else {
      await db.from("listing_favorites").insert({ listing_id: listingId, user_id: user.id });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-4 sm:py-6">
      {/* Seletor de ambiente — só "Produtos" ativo nesta fase */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <EnvButton icon={ShoppingBag} label="Produtos" active />
        <EnvButton icon={Briefcase} label="Serviços" comingSoon />
        <EnvButton icon={UtensilsCrossed} label="Comida" comingSoon />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="h-12 rounded-2xl bg-muted/20 pl-11" />
        </div>
        <Button onClick={() => navigate("/my-shop")} className="h-12 shrink-0 gap-1.5 rounded-2xl px-4 font-bold">
          <Store className="h-4 w-4" /> Minha loja
        </Button>
      </div>

      {/* Categorias */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill label="Todas" active={categoria === null} onClick={() => setCategoria(null)} />
        {PRODUTO_CATEGORIAS.map((c) => (
          <Pill key={c} label={c} active={categoria === c} onClick={() => setCategoria(c)} />
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/50 py-16 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado na sua universidade ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} coverUrl={l.coverUrl} favorited={favorites.has(l.id)} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvButton({ icon: Icon, label, active, comingSoon }: { icon: typeof ShoppingBag; label: string; active?: boolean; comingSoon?: boolean }) {
  return (
    <button
      type="button"
      disabled={comingSoon}
      title={comingSoon ? "Em breve" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground",
        comingSoon && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {comingSoon && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase">Em breve</span>}
    </button>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/50 text-muted-foreground hover:bg-muted/40",
      )}
    >
      {label}
    </button>
  );
}
