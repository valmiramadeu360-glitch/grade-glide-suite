import { Link } from "react-router-dom";
import { Heart, ImageOff, BadgeCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDICAO_LABEL, formatPreco, type Listing } from "@/lib/marketplace";

interface Props {
  listing: Listing;
  isFav?: boolean;
  onToggleFav?: () => void;
  showStats?: boolean;
}

export function ListingCard({ listing, isFav, onToggleFav, showStats }: Props) {
  const cover = listing.photos[0];
  return (
    <Link
      to={`/marketplace/item/${listing.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg",
        !listing.is_active && "opacity-60",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {cover ? (
          <img src={cover} alt={listing.titulo} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><ImageOff className="h-8 w-8" /></div>
        )}
        {!listing.is_active ? (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase">Pausado</span>
        ) : listing.condicao ? (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold">{CONDICAO_LABEL[listing.condicao]}</span>
        ) : null}
        {onToggleFav && (
          <button
            type="button"
            aria-label={isFav ? "Remover dos favoritos" : "Favoritar"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-sm active:scale-90"
          >
            <Heart className={cn("h-4 w-4", isFav ? "fill-destructive text-destructive" : "text-muted-foreground")} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-base font-extrabold leading-none text-foreground">{formatPreco(listing.preco)}</p>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground/90">{listing.titulo}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {listing.shop && (
            <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <span className="truncate">{listing.shop.nome}</span>
              {listing.shop.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </span>
          )}
          {showStats && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><Eye className="h-3 w-3" />{listing.view_count}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
