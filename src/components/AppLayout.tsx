import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, MessageSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useTheme } from "@/hooks/useTheme";
import { useSemester } from "@/hooks/useSemester";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { AppDrawer } from "@/components/AppDrawer";
import { EduAssistant } from "@/components/EduAssistant";
import { NotificationsBell } from "@/components/NotificationsBell";
import { cn } from "@/lib/utils";

/**
 * Estrutura fixa do app (montada uma única vez, sem recarregar a cada navegação):
 *  - cabeçalho com menu lateral, mensagens, notificações e perfil
 *  - 5 abas: barra inferior (celular/tablet) ou coluna lateral (computador)
 *  - Edu, a assistente flutuante
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { mode, primaryColor } = useTheme();
  const { currentLabel } = useSemester();
  const { user } = useAuth();
  const { profile, university } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?.id ?? null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Cor da barra de status do navegador/PWA acompanha o tema.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#030712" : "#f8fafc");
  }, [mode, primaryColor]);

  // Mensagens novas em tempo real (um único canal enquanto o app estiver aberto).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dm_alerts_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${userId}` },
        () => setHasUnreadMessages(true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Reconfere o indicador ao navegar (por exemplo, depois de ler as mensagens).
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("direct_messages")
      .select("id")
      .eq("receiver_id", userId)
      .is("read_at", null)
      .limit(1)
      .then(({ data }) => setHasUnreadMessages((data?.length ?? 0) > 0));
  }, [userId, location.pathname]);

  const subtitle = [university?.acronym, currentLabel].filter(Boolean).join(" • ");

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground selection:bg-primary/20">
      <BottomNavigation />

      <div className="flex min-h-[100dvh] flex-col lg:pl-20">
        <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-16 items-center border-b border-border/30 bg-background/70 px-3 backdrop-blur-2xl sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/40 transition-all hover:bg-primary/10 hover:text-primary active:scale-90"
              >
                <Menu className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/connect")}
                className="flex min-w-0 flex-col items-start text-left"
                aria-label="Ir para o Feed"
              >
                <span className="text-[17px] font-extrabold leading-none tracking-tight text-primary">EduConect</span>
                {subtitle && (
                  <span className="mt-1 max-w-[46vw] truncate text-[11px] font-semibold leading-none text-muted-foreground sm:max-w-none">
                    {subtitle}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => navigate("/messages")}
                aria-label={hasUnreadMessages ? "Mensagens (há novas)" : "Mensagens"}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-95",
                  location.pathname === "/messages" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <MessageSquare className="h-5 w-5" />
                {hasUnreadMessages && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />}
              </button>

              <NotificationsBell />

              <button
                type="button"
                onClick={() => navigate("/profile")}
                aria-label="Meu perfil"
                className="ml-1 h-10 w-10 overflow-hidden rounded-full border-2 border-border/50 shadow-sm transition-all hover:border-primary/50 active:scale-95"
              >
                <Avatar className="h-full w-full bg-card">
                  <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <EduAssistant />
    </div>
  );
}
