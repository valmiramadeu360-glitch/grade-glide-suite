import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, Loader2, Store, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListingCard } from "@/components/marketplace/ListingCard";
import type { Listing, Shop as ShopType } from "@/lib/marketplace";

// shops/listings/shop_followers ainda não estão no types.ts gerado — cast temporário.
const db = supabase as any;

interface ListingRow extends Listing {
  coverUrl: string | null;
}

export default function Shop() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopType | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: shopRow } = await db.from("shops").select("*").eq("id", id).maybeSingle();
    setShop(shopRow ?? null);

    if (shopRow) {
      const [{ data: rows }, { count }, { data: myFollow }] = await Promise.all([
        db.from("listings").select("*, listing_photos(url, ordem)").eq("shop_id", id).eq("is_active", true).order("created_at", { ascending: false }),
        db.from("shop_followers").select("*", { count: "exact", head: true }).eq("shop_id", id),
        user ? db.from("shop_followers").select("shop_id").eq("shop_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setListings(
        (rows ?? []).map((r: any) => {
          const firstPhoto = [...(r.listing_photos ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
          return { ...r, coverUrl: firstPhoto ? supabase.storage.from("marketplace-media").getPublicUrl(firstPhoto.url).data.publicUrl : null };
        }),
      );
      setFollowerCount(count ?? 0);
      setFollowing(!!myFollow);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  async function toggleFollow() {
    if (!user || !shop) return;
    if (following) {
      await db.from("shop_followers").delete().eq("shop_id", shop.id).eq("user_id", user.id);
      setFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await db.from("shop_followers").insert({ shop_id: shop.id, user_id: user.id });
      if (error) return toast({ title: "Não foi possível seguir", variant: "destructive" });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!shop) return <p className="py-16 text-center text-sm text-muted-foreground">Esta loja não existe ou não está disponível para você.</p>;

  const isOwner = user?.id === shop.owner_user_id;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 sm:py-6">
      <div className="flex items-center gap-4 rounded-[28px] border border-border/40 bg-card p-4">
        <Avatar className="h-16 w-16 border border-border/40">
          <AvatarImage src={shop.logo_url ? supabase.storage.from("marketplace-media").getPublicUrl(shop.logo_url).data.publicUrl : undefined} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary"><Store className="h-6 w-6" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-lg font-extrabold leading-tight">
            {shop.nome}
            {shop.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Loja verificada" />}
          </p>
          {shop.bio && <p className="mt-0.5 truncate text-sm text-muted-foreground">{shop.bio}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{followerCount} seguidor{followerCount !== 1 ? "es" : ""} · {listings.length} anúncio{listings.length !== 1 ? "s" : ""}</p>
        </div>
        {!isOwner && (
          <Button variant={following ? "outline" : "default"} size="sm" className="gap-1.5 rounded-xl font-bold" onClick={toggleFollow}>
            {following ? <><UserCheck className="h-4 w-4" /> Seguindo</> : <><UserPlus className="h-4 w-4" /> Seguir</>}
          </Button>
        )}
      </div>

      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/50 py-16 text-center text-sm text-muted-foreground">Esta loja ainda não tem anúncios.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listings.map((l) => <ListingCard key={l.id} listing={l} coverUrl={l.coverUrl} />)}
        </div>
      )}
    </div>
  );
}
