import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Home, ShoppingBag, Newspaper, LayoutGrid, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Altura da barra inferior (px) — usada pela Edu para não flutuar por cima dela. */
export const BOTTOM_NAV_HEIGHT = 64;

type TabId = "feed" | "market" | "news" | "utilities" | "communities";

const TABS: { id: TabId; label: string; icon: LucideIcon; to: string }[] = [
  { id: "feed", label: "Feed", icon: Home, to: "/connect" },
  { id: "market", label: "Mercado", icon: ShoppingBag, to: "/connect?tab=market" },
  { id: "news", label: "Notícias", icon: Newspaper, to: "/connect?tab=news" },
  { id: "utilities", label: "Utilitários", icon: LayoutGrid, to: "/campus" },
  { id: "communities", label: "Comunidades", icon: Users, to: "/communities" },
];

/** Descobre qual das 5 abas está ativa. Telas fora das 5 (perfil, disciplinas…) não marcam nenhuma. */
function useActiveTab(): TabId | null {
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  if (pathname.startsWith("/campus")) return "utilities";
  if (pathname.startsWith("/communit") || pathname.startsWith("/messages")) return "communities";
  if (pathname === "/connect" || pathname === "/") {
    const tab = params.get("tab");
    if (tab === "market") return "market";
    if (tab === "news") return "news";
    return "feed";
  }
  return null;
}

export function BottomNavigation() {
  const navigate = useNavigate();
  const active = useActiveTab();

  return (
    <>
      {/* Celular e tablet: barra inferior. No tablet vira uma cápsula centralizada. */}
      <nav
        aria-label="Navegação principal"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden"
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto w-full border-t border-border/40 bg-background/80 backdrop-blur-2xl",
            "md:mb-3 md:max-w-xl md:rounded-[28px] md:border md:shadow-lg",
            "pb-[env(safe-area-inset-bottom,0px)] md:pb-0",
          )}
        >
          <ul className="grid h-16 grid-cols-5 px-1">
            {TABS.map(({ id, label, icon: Icon, to }) => {
              const isActive = active === id;
              return (
                <li key={id} className="flex">
                  <button
                    type="button"
                    onClick={() => navigate(to)}
                    aria-current={isActive ? "page" : undefined}
                    className="group flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl active:scale-95"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-[22px] w-[22px]", isActive && "stroke-[2.4]")} />
                    </span>
                    <span
                      className={cn(
                        "text-[10.5px] font-semibold leading-none",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Computador: coluna lateral fixa com as mesmas 5 abas. */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-2 border-r border-border/40 bg-background/70 pt-24 backdrop-blur-2xl lg:flex"
      >
        {TABS.map(({ id, label, icon: Icon, to }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(to)}
              aria-current={isActive ? "page" : undefined}
              title={label}
              className={cn(
                "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl transition-colors",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
