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
import { User, Bell, MessageSquare, Inbox, Home, Globe, Plus, Library, Sparkles, Image as ImageIcon, BookOpen, Calendar, Store, HelpCircle, PenLine, Building2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/BottomNavigation";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode, primaryColor } = useTheme();
  const { currentLabel } = useSemester();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  
  // Controle do Menu Inteligente e AI
  const [isCreationMenuOpen, setIsCreationMenuOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = mode === "dark" ? "#030712" : "#f8fafc";
      metaThemeColor.setAttribute("content", color);
    }
  }, [mode, primaryColor]);

  useEffect(() => {
    if (!user) return;

    supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });

    const checkMessages = async () => {
      const { data } = await supabase.from('direct_messages').select('id').eq('receiver_id', user.id).is('read_at', null).limit(1);
      setHasUnreadMessages((data?.length || 0) > 0);
    };

    const checkNotifications = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      setHasUnreadNotifications((count || 0) > 0);
    };

    checkMessages(); checkNotifications();

    const channel = supabase.channel('realtime_alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` }, () => setHasUnreadMessages(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => setHasUnreadNotifications(true))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => setAvatarUrl(e.detail);
    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    return () => window.removeEventListener("avatarUpdated", handleAvatarUpdate);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // Atalhos de Criação Inteligente
  const handleQuickCreate = (type: string) => {
    setIsCreationMenuOpen(false);
    switch (type) {
      case 'post': navigate('/connect'); break;
      case 'market': navigate('/connect?tab=market'); break;
      case 'question': navigate('/connect'); break;
      default: navigate('/connect');
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background text-foreground selection:bg-primary/20 transition-colors duration-500 relative">
        
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* HEADER PREMIUM COM GLASSMORPHISM */}
          <header className="h-16 sm:h-20 flex items-center border-b border-border/20 px-4 sm:px-6 bg-background/60 backdrop-blur-2xl sticky top-0 z-30 transition-all shadow-sm">
            <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
              
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger className="h-12 w-12 sm:h-11 sm:w-11 flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-90 rounded-2xl transition-all bg-muted/30 border border-border/30 sm:border-transparent sm:bg-transparent" />

                <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-primary leading-none">EduFlow</span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground italic leading-tight mt-1">Academy • {currentLabel || "Geral"}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate("/messages")} className={cn("hidden sm:flex relative h-11 w-11 rounded-2xl transition-all active:scale-95", isActive("/messages") ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground")} title="Mensagens Diretas">
                  <MessageSquare className="h-5 w-5" />
                  {hasUnreadMessages && <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background animate-bounce" />}
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center hover:bg-muted/50 text-muted-foreground transition-all active:scale-95" title="Notificações">
                      <Bell className="h-5 w-5" />
                      {hasUnreadNotifications && <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[85vw] sm:w-80 rounded-[32px] bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl p-0 overflow-hidden mt-2">
                    <div className="p-5 border-b border-border/40 bg-muted/30">
                      <p className="text-xs font-black uppercase tracking-widest text-foreground">Alertas do Sistema</p>
                    </div>
                    <div className="p-10 flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Inbox className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-bold text-muted-foreground">Caixa de entrada limpa.</p>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                {/* Desktop User Avatar */}
                <button onClick={() => navigate("/profile")} className="hidden sm:block h-11 w-11 rounded-full overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 ml-1" title="Meu Perfil">
                  <Avatar className="h-full w-full bg-card">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden relative">
            <div className={cn("w-full max-w-7xl mx-auto animate-in fade-in duration-500 px-2 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8", "pb-32 sm:pb-8")}>
              {children}
            </div>
          </main>
        </div>

        {/* BOTÃO FLUTUANTE EDUFLOW AI (Visível em Desktop e Mobile) */}
        <button 
          onClick={() => setIsAiOpen(true)}
          className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-110 active:scale-95 transition-all group"
          title="Falar com a IA"
        >
          <Sparkles className="h-6 w-6 group-hover:animate-pulse" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 border-2 border-background rounded-full"></span>
        </button>

        {/* BARRA DE NAVEGAÇÃO INFERIOR MOBILE - SUBSTITUÍDA PELA NOVA BOTTOM NAVIGATION */}
        <BottomNavigation />

        {/* MODAL DO MENU INTELIGENTE DE CRIAÇÃO (Botão Central) */}
        <Dialog open={isCreationMenuOpen} onOpenChange={setIsCreationMenuOpen}>
          <DialogContent className="sm:max-w-md rounded-[32px] p-6 border-0 shadow-2xl bg-background/95 backdrop-blur-2xl">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl font-black text-center">O que vamos criar hoje?</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              
              <button onClick={() => handleQuickCreate('post')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/50 hover:border-primary/50 transition-all active:scale-95">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center"><PenLine className="h-5 w-5" /></div>
                <span className="text-xs font-bold text-foreground">Criar Publicação</span>
              </button>

              <button onClick={() => handleQuickCreate('market')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/50 hover:border-emerald-500/50 transition-all active:scale-95">
                <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center"><Store className="h-5 w-5" /></div>
                <span className="text-xs font-bold text-foreground">Criar Anúncio</span>
              </button>

              <button onClick={() => handleQuickCreate('summary')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/50 hover:border-blue-500/50 transition-all active:scale-95">
                <div className="h-10 w-10 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center"><BookOpen className="h-5 w-5" /></div>
                <span className="text-xs font-bold text-foreground">Compartilhar Resumo</span>
              </button>

              <button onClick={() => handleQuickCreate('question')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/50 hover:border-amber-500/50 transition-all active:scale-95">
                <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center"><HelpCircle className="h-5 w-5" /></div>
                <span className="text-xs font-bold text-foreground">Fazer Pergunta</span>
              </button>

            </div>
          </DialogContent>
        </Dialog>

        {/* MODAL TEMPORÁRIO DA EDUFLOW AI */}
        <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
          <DialogContent className="sm:max-w-md rounded-[32px] p-6 border border-primary/20 shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)] bg-background">
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-black">EduFlow AI</h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                A inteligência artificial que entende o seu contexto acadêmico será conectada aqui em breve.
              </p>
              <Button onClick={() => setIsAiOpen(false)} className="rounded-full mt-4 h-12 px-8 font-black">
                Entendi!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </SidebarProvider>
  );
}
