import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { UtensilsCrossed, Clock, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONFIDENCE_LABEL, LEVEL_META, MEAL_LABEL, currentMeal, useRu } from "@/hooks/useRu";
import { useTenant } from "@/hooks/useTenant";

/**
 * Prévia do módulo RU exibida na Home.
 * Reflete exatamente o status oficial da página do RU (mesmo hook/RPC) e,
 * ao ser tocada, leva o aluno direto para a página completa.
 */
export function RuWidget() {
  const navigate = useNavigate();
  const { profile } = useTenant();
  const { restaurant, status, menus, loading } = useRu(profile?.campus_id);

  const level = status?.level ?? null;
  const meta = level ? LEVEL_META[level] : null;
  const meal = currentMeal(restaurant);
  const todayMenu = menus.find((m) => m.meal === meal) ?? menus[0] ?? null;

  const items = Array.isArray(todayMenu?.items)
    ? (todayMenu?.items as unknown[]).map((i) => (typeof i === "string" ? i : (i as any)?.name)).filter(Boolean)
    : [];

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate("/campus/ru")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/campus/ru"); }}
      className="rounded-[24px] border border-border/30 bg-card shadow-sm overflow-hidden p-5 space-y-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
              {restaurant?.name ?? "Restaurante Universitário"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Prévia • {MEAL_LABEL[meal]} {restaurant ? (restaurant.is_open ? "• Aberto" : "• Fechado") : ""}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-sm shrink-0",
            meta ? meta.classes : "bg-muted text-muted-foreground border-border/40",
          )}
        >
          <div className={cn("h-2 w-2 rounded-full animate-pulse", meta ? meta.dot : "bg-muted-foreground")} />
          {loading ? "..." : meta ? meta.minutes : "s/ dados"}
        </div>
      </div>

      <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {meta ? `${meta.emoji} ${meta.label}` : "Sem relatos recentes"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {CONFIDENCE_LABEL[status?.confidence ?? "none"]}
            {status?.sample_size ? ` • ${status.sample_size} relatos` : ""}
          </p>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Cardápio de hoje • {MEAL_LABEL[(todayMenu?.meal as "lunch" | "dinner") ?? meal]}
          </p>
          <p className="text-xs text-foreground/90 line-clamp-2 font-medium">{items.slice(0, 5).join(" • ")}</p>
          {!!todayMenu?.confirmations && todayMenu.confirmations > 1 && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> confirmado por {todayMenu.confirmations} estudantes
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className="text-[11px] font-bold text-primary">Abrir módulo do RU</span>
        <ChevronRight className="h-4 w-4 text-primary" />
      </div>
    </Card>
  );
}
