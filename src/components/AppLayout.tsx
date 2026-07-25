import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTheme } from "@/hooks/useTheme";
import { useSemester } from "@/hooks/useSemester";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bell, MessageSquare, Inbox, Home, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode, primaryColor } = useTheme();
  const { currentLabel } = useSemester();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = mode === "dark" ? "#030712" : "#f8fafc";
      metaThemeColor.setAttribute("content", color);
    }
  }, [mode, primaryColor]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      });

    const checkMessages = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('id')
        .eq('receiver_id', user.id)
        .is('read_at', null)
        .limit(1);
      setHasUnreadMessages((data?.length || 0) > 0);
    };

    const checkNotifications = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setHasUnreadNotifications((count || 0) > 0);
    };

    checkMessages();
    checkNotifications();

    const channel = supabase.channel('realtime_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => setHasUnreadMessages(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setHasUnreadNotifications(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      setAvatarUrl(e.detail);
    };
    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    return () => {
      window.removeEventListener("avatarUpdated", handleAvatarUpdate);
    };
  }, []);

  // Helpers para o menu inferior
  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background text-foreground selection:bg-primary/20 transition-colors duration-500">
        
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* HEADER PREMIUM COM GLASSMORPHISM AVANÇADO */}
          <header className="h-16 sm:h-20 flex items-center border-b border-border/20 px-4 sm:px-6 bg-background/60 backdrop-blur-2xl sticky top-0 z-30 transition-all shadow-sm">
            <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
              
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger 
                  className="h-12 w-12 sm:h-11 sm:w-11 flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-90 rounded-2xl transition-all bg-muted/30 border border-border/30 sm:border-transparent sm:bg-transparent"
                />

                <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-primary leading-none">
                    EduFlow
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground italic leading-tight mt-1">
                    Academy • {currentLabel || "Geral"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Oculto no mobile, movido para a barra inferior */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/messages")}
                  className={cn(
                    "hidden sm:flex relative h-11 w-11 rounded-2xl transition-all active:scale-95",
                    isActive("/messages") ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                  )}
                  title="Mensagens Diretas"
                >
                  <MessageSquare className="h-5 w-5" />
                  {hasUnreadMessages && (
                    <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background animate-bounce" />
                  )}
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center hover:bg-muted/50 text-muted-foreground transition-all active:scale-95"
                      title="Notificações"
                    >
                      <Bell className="h-5 w-5" />
                      {hasUnreadNotifications && (
                        <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[85vw] sm:w-80 rounded-3xl bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl p-0 overflow-hidden mt-2"
                  >
                    <div className="p-4 border-b border-border/40 bg-muted/30">
                      <p className="text-xs font-black uppercase tracking-widest text-foreground">
                        Alertas do Sistema
                      </p>
                    </div>
                    <div className="p-10 flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Inbox className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground">
                        Sua caixa de entrada está limpa.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="w-px h-6 bg-border/40 mx-1 hidden sm:block" />

                <button 
                  onClick={() => navigate("/profile")}
                  className="hidden sm:block h-11 w-11 rounded-full overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 ml-1"
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

          <main className="flex-1 overflow-x-hidden relative">
            <div
              className={cn(
                "w-full max-w-7xl mx-auto animate-in fade-in duration-500",
                "px-2 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8", // Resolvido a Síndrome das Caixas
                "pb-28 sm:pb-8" // Espaço extra no mobile por causa da Bottom Navigation
              )}
            >
              {children}
            </div>
          </main>
        </div>

        {/* BOTTOM NAVIGATION MOBILE (Navegação Premium para Celulares) */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="flex items-center justify-around bg-background/80 backdrop-blur-2xl border border-border/30 rounded-full py-2 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] pointer-events-auto">
            
            <button 
              onClick={() => navigate("/")}
              className={cn("flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90", isActive("/") ? "text-primary" : "text-muted-foreground")}
            >
              <Home className={cn("h-5 w-5 mb-1", isActive("/") && "fill-primary/20")} />
              <span className="text-[9px] font-medium">Início</span>
            </button>

            <button 
              onClick={() => navigate("/connect")}
              className={cn("flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90", isActive("/connect") ? "text-primary" : "text-muted-foreground")}
            >
              <Globe className={cn("h-5 w-5 mb-1", isActive("/connect") && "fill-primary/20")} />
              <span className="text-[9px] font-medium">Connect</span>
            </button>

            <button 
              onClick={() => navigate("/messages")}
              className={cn("relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90", isActive("/messages") ? "text-primary" : "text-muted-foreground")}
            >
              <MessageSquare className={cn("h-5 w-5 mb-1", isActive("/messages") && "fill-primary/20")} />
              <span className="text-[9px] font-medium">Chat</span>
              {hasUnreadMessages && (
                <span className="absolute top-1 right-2 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background" />
              )}
            </button>

            <button 
              onClick={() => navigate("/profile")}
              className="flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90"
            >
              <Avatar className={cn("h-7 w-7 mb-0.5 border-2", isActive("/profile") ? "border-primary" : "border-transparent")}>
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className={cn("text-[9px] font-medium", isActive("/profile") ? "text-primary" : "text-muted-foreground")}>Perfil</span>
            </button>

          </div>
        </div>

      </div>
    </SidebarProvider>
  );
}
