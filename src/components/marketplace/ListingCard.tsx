import { useNavigate } from "react-router-dom";
import { Heart, ImageOff, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDICAO_LABEL, formatPreco, type Listing } from "@/lib/marketplace";

interface ListingCardProps {
  listing: Listing;
  coverUrl: string | null;
  favorited?: boolean;
  onToggleFavorite?: (listingId: string) => void;
  /** Mostra o selo de "pausado" (visão do próprio vendedor em "Minha Loja"). */
  showInactiveBadge?: boolean;
}

export function ListingCard({ listing, coverUrl, favorited, onToggleFavorite, showInactiveBadge }: ListingCardProps) {
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/listing/${listing.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/listing/${listing.id}`)}
      className="group cursor-pointer overflow-hidden rounded-[22px] border border-border/40 bg-card shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
        {coverUrl ? (
          <img src={coverUrl} alt={listing.titulo} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={favorited ? "Remover dos favoritos" : "Favoritar"}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(listing.id); }}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur active:scale-90"
          >
            <Heart className={cn("h-[18px] w-[18px]", favorited ? "fill-destructive text-destructive" : "text-foreground")} />
          </button>
        )}

        {showInactiveBadge && !listing.is_active && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-3 py-1.5 text-xs font-bold text-background">
              <PauseCircle className="h-3.5 w-3.5" /> Pausado
            </span>
          </div>
        )}

        {listing.condicao && (
          <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
            {CONDICAO_LABEL[listing.condicao]}
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-bold leading-tight">{listing.titulo}</p>
        <p className="mt-1 text-[15px] font-extrabold text-primary">{formatPreco(listing.preco)}</p>
      </div>
    </div>
  );
}
