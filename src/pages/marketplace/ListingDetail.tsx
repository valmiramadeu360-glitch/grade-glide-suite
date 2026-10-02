import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, BadgeCheck, Flag, Eye, Loader2, ImageOff, Store, MapPin, Clock, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchListing, fetchMyFavoriteIds, formatPrice, sectionOf, sellerChatLink, toggleFavorite, type Listing } from "@/lib/marketplace";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchListing(id).then((l) => { setListing(l); setPhoto(0); }).finally(() => setLoading(false));
    supabase.rpc("register_listing_view", { _listing_id: id }).then(() => {});
    if (user) fetchMyFavoriteIds(user.id).then((s) => setIsFav(s.has(id)));
  }, [id, user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!listing) {
    return (
      <div className="py-20 text-center">
        <p className="font-bold">Item não encontrado ou indisponível.</p>
        <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => navigate("/marketplace")}>Voltar ao Marketplace</Button>
      </div>
    );
  }

  const isOwner = listing.shop?.owner_user_id === user?.id;
  const section = sectionOf(listing.tipo);

  async function onFav() {
    if (!user || !listing) return;
    setIsFav(!isFav);
    await toggleFavorite(user.id, listing.id, isFav);
  }

  async function sendReport() {
    if (!user || !listing || reason.trim().length < 5) return;
    const { error } = await supabase.from("listing_reports").insert({ listing_id: listing.id, reporter_id: user.id, motivo: reason.trim() });
    if (error) { toast({ title: "Não foi possível enviar a denúncia", variant: "destructive" }); return; }
    toast({ title: "Denúncia enviada", description: "A moderação vai analisar." });
    setReportOpen(false);
    setReason("");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 animate-in fade-in duration-300">
      <Button variant="ghost" onClick={() => navigate(-1)} className="h-11 rounded-2xl px-3 font-bold">
        <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Galeria */}
        <div className="space-y-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
            {listing.photos[photo] ? (
              <img src={listing.photos[photo]} alt={listing.titulo} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/40"><ImageOff className="h-12 w-12" /></div>
            )}
            {!listing.is_active && <Badge className="absolute left-3 top-3">Pausado</Badge>}
          </div>
          {listing.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {listing.photos.map((p, i) => (
                <button key={p} type="button" onClick={() => setPhoto(i)} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2", i === photo ? "border-primary" : "border-transparent opacity-70")}>
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{section.label}</Badge>
            {listing.categoria && <Badge variant="outline">{listing.categoria}</Badge>}
            {listing.condicao && <Badge variant="outline" className="capitalize">{listing.condicao}</Badge>}
          </div>
          <h1 className="text-2xl font-black leading-tight">{listing.titulo}</h1>
          <p className="text-3xl font-black text-primary">{formatPrice(listing.preco)}</p>

          <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
            {listing.modalidade && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{listing.modalidade === "remoto" ? "Remoto" : "Presencial"}</span>}
            {listing.prazo_entrega && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{listing.prazo_entrega}</span>}
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{listing.view_count} visualizações</span>
          </div>

          {listing.descricao && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{listing.descricao}</p>}

          {listing.shop && (
            <Link to={`/marketplace/loja/${listing.shop.id}`} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3 hover:border-primary/40">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                {listing.shop.logo_url ? <img src={listing.shop.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="m-3 h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-bold">{listing.shop.nome}{listing.shop.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}</p>
                <p className="text-xs text-muted-foreground">Ver loja</p>
              </div>
            </Link>
          )}

          <div className="hidden gap-2 lg:flex">
            <Actions />
          </div>

          {!isOwner && (
            <button type="button" onClick={() => setReportOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
              <Flag className="h-3.5 w-3.5" /> Denunciar anúncio
            </button>
          )}
        </div>
      </div>

      {/* Barra fixa no celular */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-30 flex gap-2 border-t border-border/40 bg-background/90 p-3 backdrop-blur-xl lg:hidden">
        <Actions />
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Denunciar anúncio</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conte o que há de errado (golpe, item proibido, conteúdo ofensivo...)" rows={4} className="rounded-2xl" />
          <Button onClick={sendReport} disabled={reason.trim().length < 5} variant="destructive" className="h-12 rounded-2xl">Enviar denúncia</Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  function Actions() {
    if (!listing) return null;
    if (isOwner) {
      return (
        <Button className="h-12 flex-1 rounded-2xl font-bold" onClick={() => navigate(`/marketplace/minha-loja?edit=${listing.id}`)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar na minha loja
        </Button>
      );
    }
    return (
      <>
        <Button variant="outline" size="icon" onClick={onFav} className="h-12 w-12 shrink-0 rounded-2xl" aria-label="Favoritar">
          <Heart className={cn("h-5 w-5", isFav && "fill-destructive text-destructive")} />
        </Button>
        <Button
          className="h-12 flex-1 rounded-2xl font-bold"
          disabled={!listing.shop}
          onClick={() => listing.shop && navigate(sellerChatLink(listing.shop.owner_user_id, listing))}
        >
          <MessageCircle className="mr-2 h-5 w-5" /> Falar com o vendedor
        </Button>
      </>
    );
  }
}
