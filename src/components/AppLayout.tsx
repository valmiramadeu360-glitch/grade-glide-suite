import { ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode, primaryColor } = useTheme();

  // Sincroniza a cor da barra de sistema do celular com o tema do EduFlow
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      // No modo escuro usamos o fundo quase preto, no claro o fundo suave
      const color = mode === "dark" ? "#030712" : "#f8fafc";
      metaThemeColor.setAttribute("content", color);
    }
  }, [mode, primaryColor]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground selection:bg-primary/20 transition-colors duration-500">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header com efeito Glassmorphism e borda sutil */}
          <header className="h-16 flex items-center border-b border-border/40 px-4 sm:px-6 bg-background/60 backdrop-blur-xl sticky top-0 z-30 transition-all">
            <div className="flex items-center gap-4 w-full max-w-7xl mx-auto">
              <SidebarTrigger 
                className="h-11 w-11 flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-90 rounded-xl transition-all" 
              />
              
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary leading-none">
                  EduFlow
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground italic leading-tight">
                  Academy • 2026.1
                </span>
              </div>
            </div>
          </header>

          {/* Área principal com scroll suave e preenchimento seguro */}
          <main className="flex-1 overflow-x-hidden">
            <div className={cn(
              "p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full animate-fade-in",
              "safe-bottom" // Classe que definimos no CSS para o iPhone/Android
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

