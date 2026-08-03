import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { SemesterProvider } from "@/hooks/useSemester";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Importação das Páginas
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import Connect from "./pages/Connect";
import Messages from "./pages/Messages";
import Campus from "./pages/Campus";
import Ru from "./pages/Ru";
import { CampusMap } from "@/components/Campus/CampusMap";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import Assistant from "./pages/Assistant";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

/**
 * Filtro de Segurança Avançado: Impede acesso de deslogados e usuários BANIDOS
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isBanned, setIsBanned] = useState<boolean | null>(null);
  const [checkingBan, setCheckingBan] = useState(true);

  useEffect(() => {
    async function checkUserStatus() {
      if (!user) {
        setCheckingBan(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("profiles")
          .select("is_banned")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.is_banned) {
          setIsBanned(true);
          await supabase.auth.signOut();
          toast({
            title: "Acesso Negado 🚫",
            description: "Esta conta foi suspensa por violar as diretrizes da comunidade.",
            variant: "destructive",
          });
        } else {
          setIsBanned(false);
        }
      } catch (err) {
        console.error("Erro ao verificar status do usuário:", err);
        setIsBanned(false);
      } finally {
        setCheckingBan(false);
      }
    }

    checkUserStatus();
  }, [user, toast]);

  if (loading || checkingBan) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background transition-colors duration-500">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
          <div className="relative flex items-center justify-center">
            <div className="animate-spin h-14 w-14 border-[3px] border-primary/20 border-t-primary rounded-full shadow-inner" />
            <div className="absolute h-6 w-6 bg-primary/10 rounded-full animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary leading-none">EduFlow Academy</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 italic">Sincronizando segurança...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || isBanned) return <Navigate to="/auth" replace />;

  return <AppLayout>{children}</AppLayout>;
}

/**
 * Filtro exclusivo para rotas de Administrador
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function verifyAdmin() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data } = await supabase.rpc("is_admin");
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    }

    if (!loading) {
      verifyAdmin();
    }
  }, [user, loading]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <div className="animate-spin h-10 w-10 border-[3px] border-primary/20 border-t-primary rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/**
 * Filtro de Segurança: Impede acesso de logados na tela de Login
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <SemesterProvider>
              <Routes>
                {/* Rotas de Acesso */}
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Rotas Acadêmicas Protegidas */}
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
                <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
                <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
                <Route path="/news" element={<Navigate to="/connect?tab=news" replace />} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/campus" element={<ProtectedRoute><Campus /></ProtectedRoute>} />
                <Route path="/campus/ru" element={<ProtectedRoute><Ru /></ProtectedRoute>} />
                <Route path="/campus/map" element={<ProtectedRoute><CampusMap /></ProtectedRoute>} />
                <Route path="/extra-courses" element={<Navigate to="/disciplines?tab=extra" replace />} />
                <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
                
                {/* Rota Protegida Administrativa Corrigida */}
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                
                {/* Fallback de Erro */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              <Toaster />
              <Sonner 
                position="top-center"
                closeButton 
                richColors 
                expand={false}
                theme="system"
                className="font-bold"
              />
            </SemesterProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

