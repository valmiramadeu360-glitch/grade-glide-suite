import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Sparkles, User, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: "Feed", path: "/", icon: Home },
    { name: "Mercado", path: "/connect?tab=market", icon: ShoppingBag },
    { name: "IA", path: "/assistant", icon: Sparkles },
    { name: "Perfil", path: "/profile", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path.startsWith("/connect") && location.pathname === "/connect");
          
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-6 w-6", isActive && "fill-current")} />
              <span className="text-[10px] font-black uppercase mt-1 tracking-wider">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
