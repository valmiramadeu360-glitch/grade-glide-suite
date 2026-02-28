import { LayoutDashboard, BookOpen, Bell, Settings, GraduationCap, Sparkles, LogOut, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom"; // Importado useLocation diretamente
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Disciplinas", url: "/disciplines", icon: BookOpen },
  { title: "Cursos Extras", url: "/extra-courses", icon: Sparkles },
  { title: "Lembretes", url: "/reminders", icon: Bell },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar shadow-xl">
      <SidebarContent>
        {/* Header do Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-6 transition-all",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h2 className="text-base font-bold leading-none text-foreground">EduFlow</h2>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-1">Gestão Acadêmica</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = location.pathname === item.url || 
                                 (item.url !== "/" && location.pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title}
                      className={cn(
                        "flex items-center gap-3 px-4 py-6 transition-all duration-200",
                        isActive ? "bg-primary/10 text-primary" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavLink to={item.url}>
                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar/50 p-4 backdrop-blur-sm">
        {!collapsed && user && (
          <div className="mb-4 flex items-center gap-3 px-2">
             <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
             </div>
             <div className="flex flex-col min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">Minha Conta</p>
                <p className="text-[10px] text-muted-foreground truncate italic">{user.email}</p>
             </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut()} 
              className="flex items-center gap-3 px-4 py-5 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Sair do App</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
