import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTheme } from "@/hooks/useTheme";
import { useSemester } from "@/hooks/useSemester";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode, primaryColor } = useTheme();
  const { currentLabel } = useSemester(); // Puxa o semestre atual da "Máquina do Tempo"
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [avatarUrl, setAvatarUrl] = useState("");

  // Sincroniza a cor da barra de sistema do celular com o tema do EduFlow
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      // No modo escuro usamos o fundo quase preto, no claro o fundo do background
      const color = mode === "dark" ? "#030712" : "#f8fafc";
      metaThemeColor.setAttribute("content", color);
    }
  }, [mode, primaryColor]);

  // Carrega a foto de perfil e escuta atualizações instantâneas
  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        });
    }

    // Escuta aquele "Grito" que o Profile.tsx dá quando a foto é trocada
    const handleAvatarUpdate = (e: any) => setAvatarUrl(e.detail);
    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    
    return () => window.removeEventListener("avatarUpdated", handleAvatarUpdate);
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background text-foreground selection:bg-primary/20 transition-colors duration-500">
        
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Header com efeito Glassmorphism, Semestre Dinâmico e Foto de Perfil */}
          <header className="h-16 sm:h-20 flex items-center border-b border-border/40 px-4 sm:px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-30 transition-all shadow-sm">
            <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
              
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger 
                  className="h-12 w-12 sm:h-11 sm:w-11 flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-90 rounded-xl transition-all bg-muted/30 border border-border/50 sm:border-transparent sm:bg-transparent" 
                />
                
                <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
                  <span className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-primary leading-none">
                    EduFlow
                  </span>
                  {/* Semestre Dinâmico */}
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground italic leading-tight mt-1">
                    Academy • {currentLabel || "Geral"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Notification Bell */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors" title="Notificações">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 rounded-2xl bg-card border-border shadow-2xl p-0 overflow-hidden">
                    <div className="p-4 border-b border-border/40">
                      <p className="text-sm font-black text-foreground">Notificações</p>
                    </div>
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-bold text-muted-foreground">Nenhuma notificação no momento.</p>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Avatar */}
                <button 
                  onClick={() => navigate("/profile")}
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                  title="Meu Perfil"
                >
                  <Avatar className="h-full w-full bg-card">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </div>

            </div>
          </header>

          {/* Área principal com scroll suave e preenchimento seguro (pb-24 no mobile) */}
          <main className="flex-1 overflow-x-hidden">
            <div className={cn(
              "p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full animate-in fade-in duration-500",
              "pb-24 sm:pb-8" // pb-24 garante que nada fique escondido atrás do menu inferior do iPhone!
            )}>
              {children}
            </div>
          </main>
          
        </div>
      </div>
    </SidebarProvider>
  );
}
