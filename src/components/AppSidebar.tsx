import { useEffect, useState } from "react";
import { 
  LayoutDashboard, BookOpen, Bell, Settings, Sparkles, 
  LogOut, User, MessageSquare, Globe, Building2, HelpCircle 
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Lista de navegação atualizada com a nova Arquitetura do Super App
const mainItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Campus", url: "/campus", icon: Building2 },
  { title: "Connect", url: "/connect", icon: Globe },
  { title: "Chat", url: "/messages", icon: MessageSquare },
  { title: "Disciplinas", url: "/disciplines", icon: BookOpen },
  { title: "Cronograma", url: "/reminders", icon: Bell },
  { title: "Assistente IA", url: "/assistant", icon: Sparkles },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Ajuda", url: "/feedback", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  
  const [avatarUrl, setAvatarUrl] = useState("");

  // Carrega a foto de perfil e escuta atualizações
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

    const handleAvatarUpdate = (e: any) => setAvatarUrl(e.detail);
    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    
    return () => window.removeEventListener("avatarUpdated", handleAvatarUpdate);
  }, [user]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar shadow-2xl">
      <SidebarContent className="custom-scrollbar">
        {/* Header do App */}
        <div className={cn(
          "flex items-center gap-3.5 px-4 py-6 transition-all",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <h2 className="text-xl font-black leading-none text-foreground tracking-tight">EduFlow</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mt-1.5 truncate">Academy</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5 px-2">
              {mainItems.map((item) => {
                const isActive = location.pathname === item.url || 
                                 (item.url !== "/" && location.pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title}
                      className={cn(
                        "relative h-14 flex items-center gap-3.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.98]",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-black before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-7 before:w-1 before:rounded-r-full before:bg-primary-foreground/80" 
                          : "hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold"
                      )}
                    >
                      <NavLink to={item.url}>
                        <item.icon className={cn("h-5 w-5 shrink-0 transition-transform", isActive && "scale-110")} />
                        {!collapsed && <span className="text-sm tracking-wide">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer com Perfil e Logout */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar/80 p-4 backdrop-blur-md">
        {!collapsed && user && (
          <div 
            onClick={() => navigate("/profile")}
            className="mb-3 flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border/50 group"
          >
            <Avatar className="h-10 w-10 shrink-0 border border-border shadow-sm group-hover:scale-105 transition-transform bg-card">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">Meu Perfil</p>
              <p className="text-[10px] text-muted-foreground font-bold truncate tracking-wide">{user.email}</p>
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut()} 
              className={cn(
                "h-14 flex items-center gap-3.5 px-4 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors font-bold",
                collapsed && "justify-center"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="text-sm">Encerrar Sessão</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
