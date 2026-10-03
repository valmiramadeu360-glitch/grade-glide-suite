import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Eye, Heart, Loader2, Pencil, PlusCircle, Store, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShopFormDialog } from "@/components/marketplace/ShopFormDialog";
import { ListingFormDialog } from "@/components/marketplace/ListingFormDialog";
import { MEDIA_BUCKET, SECTIONS, formatPreco, type Listing, type Shop, type ShopTipo } from "@/lib/marketplace";

// shops/listings ainda não estão no types.ts gerado — cast temporário.
const db = supabase as any;

interface ListingRow extends Listing {
  coverUrl: string | null;
  favoriteCount: number;
}

export default function MyShop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tipo = ((params.get("s") as ShopTipo) || "produto");
  const section = SECTIONS.find((x) => x.id === tipo) ?? SECTIONS[0];

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [listingDialogOpen, setListingDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: shopRow } = await db.from("shops").select("*").eq("owner_user_id", user.id).eq("tipo", tipo).maybeSingle();
    setShop(shopRow ?? null);

    if (shopRow) {
      const { data: rows } = await db
        .from("listings")
        .select("*, listing_photos(url, ordem), listing_favorites(count)")
        .eq("shop_id", shopRow.id)
        .order("created_at", { ascending: false });

      setListings(
        (rows ?? []).map((r: any) => {
          const firstPhoto = [...(r.listing_photos ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
          return {
            ...r,
            coverUrl: firstPhoto ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(firstPhoto.url).data.publicUrl : null,
            favoriteCount: r.listing_favorites?.[0]?.count ?? 0,
          };
        }),
      );
    } else {
      setListings([]);
    }
    setLoading(false);
  }, [user, tipo]);

  useEffect(() => { load(); }, [load]);

  // Abre direto a edição: /marketplace/minha-loja?edit=<id>
  useEffect(() => {
    const editId = params.get("edit");
    if (!editId || listings.length === 0) return;
    const l = listings.find((x) => x.id === editId);
    if (l) { setEditingListing(l); setListingDialogOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  const switcher = (
    <div className="grid grid-cols-3 gap-2">
      {SECTIONS.map((x) => (
        <button key={x.id} type="button" onClick={() => setParams({ s: x.id }, { replace: true })}
          className={cn("flex items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold", x.id === tipo ? "border-primary bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground")}>
          <x.icon className="h-4 w-4" />{x.label}
        </button>
      ))}
    </div>
  );

  async function togglePause(listing: Listing) {
    const { error } = await db.from("listings").update({ is_active: !listing.is_active }).eq("id", listing.id);
    if (error) return toast({ title: "Não foi possível atualizar", variant: "destructive" });
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, is_active: !l.is_active } : l)));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await db.from("listings").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
    } else {
      setListings((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast({ title: "Anúncio excluído" });
    }
    setDeleteTarget(null);
  }

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  // ---------- sem loja ainda ----------
  if (!shop) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">{switcher}<div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-7 w-7" /></div>
        <h1 className="text-xl font-extrabold">Crie sua loja de {section.label.toLowerCase()}</h1>
        <p className="text-sm text-muted-foreground">Qualquer estudante pode vender. Sua loja aparece só para quem é da sua universidade.</p>
        <Button onClick={() => setShopDialogOpen(true)} className="mt-2 h-12 rounded-2xl px-6 font-bold">Criar minha loja</Button>
        <ShopFormDialog open={shopDialogOpen} onOpenChange={setShopDialogOpen} shop={null} onSaved={setShop} tipo={tipo} />
      </div></div>
    );
  }

  const totalViews = listings.reduce((sum, l) => sum + l.view_count, 0);
  const totalFavorites = listings.reduce((sum, l) => sum + l.favoriteCount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:py-8">
      {switcher}
      {/* Cabeçalho da loja */}
      <div className="flex items-center gap-4 rounded-[28px] border border-border/40 bg-card p-4">
        <Avatar className="h-16 w-16 border border-border/40">
          <AvatarImage src={shop.logo_url ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(shop.logo_url).data.publicUrl : undefined} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary"><Store className="h-6 w-6" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold leading-tight">{shop.nome}</p>
          {shop.bio && <p className="mt-0.5 truncate text-sm text-muted-foreground">{shop.bio}</p>}
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShopDialogOpen(true)}>Editar</Button>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate(`/marketplace/loja/${shop.id}`)}>Ver</Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Store} label="Anúncios" value={listings.length} />
        <StatCard icon={Eye} label="Visualizações" value={totalViews} />
        <StatCard icon={Heart} label="Favoritos" value={totalFavorites} />
      </div>

      {/* Anúncios */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">Meus anúncios</h2>
        <Button size="sm" className="gap-1.5 rounded-xl font-bold" onClick={() => { setEditingListing(null); setListingDialogOpen(true); }}>
          <PlusCircle className="h-4 w-4" /> Novo
        </Button>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground">
          Nenhum anúncio ainda — publique o primeiro.
        </p>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3">
              <div onClick={() => navigate(`/marketplace/item/${l.id}`)} className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-muted/40">
                {l.coverUrl && <img src={l.coverUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{l.titulo}</p>
                <p className="text-sm font-extrabold text-primary">{formatPreco(l.preco)}</p>
                <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {l.view_count}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {l.favoriteCount}</span>
                  {!l.is_active && <span className="font-bold text-amber-600">Pausado</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => { setEditingListing(l); setListingDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 rounded-xl px-2 text-xs font-bold" onClick={() => togglePause(l)}>
                  {l.is_active ? "Pausar" : "Reativar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShopFormDialog open={shopDialogOpen} onOpenChange={setShopDialogOpen} shop={shop} onSaved={setShop} tipo={tipo} />
      <ListingFormDialog open={listingDialogOpen} onOpenChange={setListingDialogOpen} shopId={shop.id} listing={editingListing} onSaved={load} shopTipo={tipo} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anúncio?</AlertDialogTitle>
            <AlertDialogDescription>Isso remove "{deleteTarget?.titulo}" e suas fotos. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border/40 bg-card py-3">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-lg font-extrabold leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
