import { ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTheme } from "@/hooks/useTheme";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode } = useTheme();

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", mode === "dark" ? "#030712" : "#f8fafc");
    }
  }, [mode]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/80 backdrop-blur-md sticky top-0 z-20">
            <SidebarTrigger className="mr-4 hover:bg-accent/10 p-2 rounded-md transition-colors" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-muted-foreground italic">EduFlow Academy</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-auto safe-bottom">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
