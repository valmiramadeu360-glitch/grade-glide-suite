import { ReactNode, useEffect } from "react"; // Adicionei useEffect
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  
  // Script para melhorar a experiência mobile (PWA)
  useEffect(() => {
    // Define a cor da barra de status no celular para combinar com o Card do seu app
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#0f172a"); // Cor azul escuro/slate
    }
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/80 backdrop-blur-md sticky top-0 z-20">
            <SidebarTrigger className="mr-4 hover:bg-accent p-2 rounded-md transition-colors" />
            <div className="flex-1">
              {/* Você pode adicionar um título dinâmico aqui depois */}
              <span className="text-sm font-semibold opacity-70 italic">EduFlow Academy</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/10 via-background to-background">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
