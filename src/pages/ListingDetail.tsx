import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Heart, ImageOff, Loader2, MessageCircle, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { CONDICAO_LABEL, formatPreco, type Listing, type Shop } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

// listings/shops ainda não estão no types.ts gerado — cast temporário.
const db = supabase as any;

const MOTIVOS_DENUNCIA = ["Produto proibido", "Anúncio enganoso", "Preço abusivo", "Suspeita de fraude", "Outro"];

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMotivo, setReportMotivo] = useState<string | null>(null);
  const [reportDetalhe, setReportDetalhe] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: listingRow } = await db.from("listings").select("*").eq("id", id).maybeSingle();
      if (!listingRow) { setLoading(false); return; }
      setListing(listingRow);

      const [{ data: shopRow }, { data: photoRows }, { data: fav }] = await Promise.all([
        db.from("shops").select("*").eq("id", listingRow.shop_id).maybeSingle(),
        db.from("listing_photos").select("url, ordem").eq("listing_id", id).order("ordem"),
        db.from("listing_favorites").select("listing_id").eq("listing_id", id).eq("user_id", user.id).maybeSingle(),
      ]);

      setShop(shopRow ?? null);
      setPhotos((photoRows ?? []).map((p: any) => supabase.storage.from("marketplace-media").getPublicUrl(p.url).data.publicUrl));
      setFavorited(!!fav);
      setLoading(false);

      // Conta 1 visualização por pessoa por dia (ver migração — RPC já trata o limite).
      db.rpc("register_listing_view", { _listing_id: id });
    })();
  }, [id, user]);

  async function toggleFavorite() {
    if (!user || !listing) return;
    if (favorited) {
      await db.from("listing_favorites").delete().eq("listing_id", listing.id).eq("user_id", user.id);
    } else {
      await db.from("listing_favorites").insert({ listing_id: listing.id, user_id: user.id });
    }
    setFavorited(!favorited);
  }

  async function sendReport() {
    if (!listing || !user || !reportMotivo) return;
    setSendingReport(true);
    const { error } = await db.from("listing_reports").insert({
      listing_id: listing.id,
      reporter_id: user.id,
      motivo: reportDetalhe.trim() ? `${reportMotivo}: ${reportDetalhe.trim()}` : reportMotivo,
    });
    setSendingReport(false);
    setReportOpen(false);
    setReportMotivo(null);
    setReportDetalhe("");
    if (error) toast({ title: "Não foi possível enviar a denúncia", variant: "destructive" });
    else toast({ title: "Denúncia enviada", description: "Nossa equipe vai analisar." });
  }

  function falarComVendedor() {
    if (!shop || !listing) return;
    navigate(`/messages?to=${shop.owner_user_id}&listing=${encodeURIComponent(listing.titulo)}`);
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!listing || !shop) return <p className="py-16 text-center text-sm text-muted-foreground">Este anúncio não existe ou não está mais disponível para você.</p>;

  const isOwner = user?.id === shop.owner_user_id;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 sm:py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      {/* Galeria */}
      <div className="overflow-hidden rounded-[28px] border border-border/40 bg-muted/30">
        <div className="aspect-square w-full">
          {photos.length > 0 ? (
            <img src={photos[activePhoto]} alt={listing.titulo} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/40"><ImageOff className="h-10 w-10" /></div>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 p-2">
            {photos.map((p, i) => (
              <button key={i} onClick={() => setActivePhoto(i)} className={cn("h-14 w-14 overflow-hidden rounded-xl border-2", i === activePhoto ? "border-primary" : "border-transparent")}>
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight">{listing.titulo}</h1>
          <p className="mt-1 text-2xl font-extrabold text-primary">{formatPreco(listing.preco)}</p>
        </div>
        {!isOwner && (
          <button onClick={toggleFavorite} aria-label="Favoritar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/50">
            <Heart className={cn("h-5 w-5", favorited ? "fill-destructive text-destructive" : "")} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {listing.condicao && <Tag label={CONDICAO_LABEL[listing.condicao]} />}
        {listing.categoria && <Tag label={listing.categoria} />}
      </div>

      {listing.descricao && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{listing.descricao}</p>}

      {/* Vendedor */}
      <button onClick={() => navigate(`/shop/${shop.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card p-3 text-left">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{shop.nome}</span>
          <span className="text-xs text-muted-foreground">Ver loja</span>
        </span>
      </button>

      {!isOwner && (
        <div className="flex gap-2">
          <Button onClick={falarComVendedor} className="h-12 flex-1 gap-2 rounded-2xl font-bold">
            <MessageCircle className="h-4 w-4" /> Falar com o vendedor
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl text-muted-foreground" onClick={() => setReportOpen(true)} aria-label="Denunciar anúncio">
            <AlertTriangle className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Denunciar anúncio</AlertDialogTitle>
            <AlertDialogDescription>Conte o que está errado — nossa moderação vai revisar.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_DENUNCIA.map((m) => (
                <button key={m} onClick={() => setReportMotivo(m)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", reportMotivo === m ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground")}>
                  {m}
                </button>
              ))}
            </div>
            <Textarea value={reportDetalhe} onChange={(e) => setReportDetalhe(e.target.value)} placeholder="Detalhes (opcional)" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!reportMotivo || sendingReport} onClick={sendReport}>
              {sendingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar denúncia"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-full bg-muted/50 px-3 py-1 text-xs font-bold text-muted-foreground">{label}</span>;
}
