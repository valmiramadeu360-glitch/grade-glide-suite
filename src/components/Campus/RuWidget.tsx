import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { UtensilsCrossed, Clock, ChevronRight, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONFIDENCE_LABEL, LEVEL_META, MEAL_LABEL, useRu } from "@/hooks/useRu";
import { useTenant } from "@/hooks/useTenant";

export function RuWidget() {
  const navigate = useNavigate();
  const { profile } = useTenant();
  
  // Passamos o campus_id e injetamos a verificação de residente (assumindo que exista no seu profile)
  // Caso a coluna no seu banco se chame diferente (ex: resident_status), ajuste aqui.
  const isResident = Boolean(profile?.is_resident); 
  
  const { restaurant, status, menus, loading, activeException } = useRu(profile?.campus_id, isResident);

  const level = status?.level ?? null;
  const meta = level ? LEVEL_META[level] : null;
  
  // Como o currentMeal agora precisa dos schedules, pegamos o menu mais recente do dia para exibir
  const todayMenu = menus[0] ?? null; 
  const meal = todayMenu?.meal ?? "lunch";

  const items = Array.isArray(todayMenu?.items)
    ? (todayMenu?.items as unknown[]).map((i) => (typeof i === "string" ? i : (i as any)?.name)).filter(Boolean)
    : [];

  const isOpen = restaurant?.is_open;

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
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
            isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
              {restaurant?.name ?? "Restaurante Universitário"}
            </h2>
            <p className="text-[11px] font-medium mt-0.5 truncate flex items-center gap-1">
              {loading ? (
                "Carregando status..."
              ) : isOpen ? (
                <span className="text-emerald-600 dark:text-emerald-400">Aberto agora • {MEAL_LABEL[meal]}</span>
              ) : (
                <span className="text-rose-500">Fechado</span>
              )}
            </p>
          </div>
        </div>

        {isOpen && (
          <div
            className={cn(
              "px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-sm shrink-0",
              meta ? meta.classes : "bg-muted text-muted-foreground border-border/40",
            )}
          >
            <div className={cn("h-2 w-2 rounded-full animate-pulse", meta ? meta.dot : "bg-muted-foreground")} />
            {loading ? "..." : meta ? meta.minutes : "s/ dados"}
          </div>
        )}
      </div>

      {/* Alerta do Administrador ou Motivo de Fechamento */}
      {(!isOpen && restaurant?.closed_reason) && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
            {restaurant.closed_reason}
          </p>
        </div>
      )}

      {/* Fila atual (só exibe se não houver alerta crítico e estiver aberto) */}
      {isOpen && (
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
      )}

      {/* Cardápio */}
      {items.length > 0 && isOpen && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Cardápio de hoje • {MEAL_LABEL[meal as "lunch" | "dinner"]}
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
