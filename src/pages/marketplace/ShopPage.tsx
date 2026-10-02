import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Loader2, MessageCircle, Store, UserPlus, UserCheck, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { fetchListings, fetchMyFavoriteIds, sectionOf, sellerChatLink, toggleFavorite, type Listing, type Shop } from "@/lib/marketplace";

export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("shops").select("*").eq("id", id).maybeSingle();
      setShop(data as Shop | null);
      if (data) {
        const [items, cnt] = await Promise.all([
          fetchListings({ shopId: id }),
          supabase.rpc("shop_follower_count", { _shop_id: id }),
        ]);
        setListings(items);
        setFollowers(cnt.data ?? 0);
      }
      if (user) {
        const { data: f } = await supabase.from("shop_followers").select("shop_id").eq("shop_id", id).eq("user_id", user.id).maybeSingle();
        setFollowing(!!f);
        setFavs(await fetchMyFavoriteIds(user.id));
      }
      setLoading(false);
    })();
  }, [id, user]);

  async function toggleFollow() {
    if (!user || !shop) return;
    if (following) {
      setFollowing(false); setFollowers((n) => n - 1);
      await supabase.from("shop_followers").delete().eq("shop_id", shop.id).eq("user_id", user.id);
    } else {
      setFollowing(true); setFollowers((n) => n + 1);
      await supabase.from("shop_followers").insert({ shop_id: shop.id, user_id: user.id });
    }
  }

  async function onFav(lid: string) {
    if (!user) return;
    const isFav = favs.has(lid);
    setFavs((p) => { const n = new Set(p); if (isFav) n.delete(lid); else n.add(lid); return n; });
    await toggleFavorite(user.id, lid, isFav);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!shop) return <div className="py-20 text-center font-bold">Loja não encontrada.</div>;

  const isOwner = shop.owner_user_id === user?.id;
  const section = sectionOf(shop.tipo);

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-in fade-in duration-300">
      <Button variant="ghost" onClick={() => navigate(-1)} className="h-11 rounded-2xl px-3 font-bold">
        <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
      </Button>

      <div className="overflow-hidden rounded-3xl border border-border/40 bg-card">
        <div className="h-32 w-full bg-gradient-to-br from-primary/30 to-primary/5 sm:h-44">
          {shop.banner_url && <img src={shop.banner_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="space-y-3 p-4 pt-0">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted">
              {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="m-5 h-8 w-8 text-muted-foreground" />}
            </div>
            <div className="flex gap-2 pb-1">
              {isOwner ? (
                <Button className="h-11 rounded-2xl font-bold" onClick={() => navigate(`/marketplace/minha-loja?s=${shop.tipo}`)}>
                  <Settings2 className="mr-2 h-4 w-4" /> Gerenciar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl" aria-label="Mensagem" onClick={() => navigate(sellerChatLink(shop.owner_user_id))}>
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  <Button variant={following ? "outline" : "default"} className="h-11 rounded-2xl font-bold" onClick={toggleFollow}>
                    {following ? <><UserCheck className="mr-2 h-4 w-4" />Seguindo</> : <><UserPlus className="mr-2 h-4 w-4" />Seguir</>}
                  </Button>
                </>
              )}
            </div>
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 text-xl font-black">{shop.nome}{shop.is_verified && <BadgeCheck className="h-5 w-5 text-primary" />}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Badge variant="secondary">{section.label}</Badge>
              {shop.tipo === "restaurante" && <Badge variant={shop.is_open ? "default" : "outline"}>{shop.is_open ? "Aberto agora" : "Fechado"}</Badge>}
              <span>{followers} seguidores</span>
              <span>· {listings.length} itens</span>
            </div>
          </div>
          {shop.bio && <p className="whitespace-pre-wrap text-sm text-foreground/90">{shop.bio}</p>}
          <p className="text-xs text-muted-foreground">Pagamento: {shop.forma_pagamento.map((f) => (f === "pelo_app" ? "pelo app" : "na entrega")).join(" ou ")}</p>
        </div>
      </div>

      {listings.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Esta loja ainda não tem itens à venda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} isFav={favs.has(l.id)} onToggleFav={isOwner ? undefined : () => onFav(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
