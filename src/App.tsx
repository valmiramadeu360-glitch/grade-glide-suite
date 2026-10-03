import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
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
import CampusLibrary from "./pages/campus/Library";
import CampusTransport from "./pages/campus/Transport";
import CampusScholarships from "./pages/campus/Scholarships";
import NotFound from "./pages/NotFound";
import Marketplace from "./pages/marketplace/Marketplace";
import ListingDetail from "./pages/marketplace/ListingDetail";
import ShopPage from "./pages/marketplace/ShopPage";
import MyShop from "./pages/marketplace/MyShop";
import AdminDashboard from "./pages/AdminDashboard";
import AdminInstitutions from "./pages/AdminInstitutions";
import Assistant from "./pages/Assistant";
import ResetPassword from "./pages/ResetPassword";
import Community from "./pages/Community";
import Communities from "./pages/Communities";
import { UniversityOnboarding } from "./pages/UniversityOnboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

/** Tela de carregamento padrão do app. */
function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background transition-colors duration-500">
      <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin h-14 w-14 border-[3px] border-primary/20 border-t-primary rounded-full shadow-inner" />
          <div className="absolute h-6 w-6 bg-primary/10 rounded-full animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary leading-none">EduConect</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 italic">
            {label ?? "Sincronizando segurança..."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Filtro de Segurança Avançado: impede acesso de deslogados, de usuários BANIDOS
 * e de quem ainda não escolheu a universidade (onboarding).
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: tenantLoading, needsOnboarding } = useTenant();
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

  if (loading || checkingBan || tenantLoading) return <FullScreenLoader />;

  if (!user || isBanned) return <Navigate to="/auth" replace />;

  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <AppLayout>{children}</AppLayout>;
}

/**
 * Rota do onboarding: tela cheia, sem cabeçalho nem abas.
 * Quem já escolheu a universidade é devolvido para o feed.
 */
function OnboardingRoute() {
  const { user, loading } = useAuth();
  const { loading: tenantLoading, needsOnboarding } = useTenant();

  if (loading || tenantLoading) return <FullScreenLoader label="Preparando seu cadastro..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;

  return <UniversityOnboarding />;
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
            <TenantProvider>
              <SemesterProvider>
                <Routes>
                  {/* Rotas de Acesso */}
                  <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/onboarding" element={<OnboardingRoute />} />

                  {/* As 5 abas do EduConect */}
                  <Route path="/" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
                  <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
                  <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
                  <Route path="/community/:id" element={<ProtectedRoute><Community /></ProtectedRoute>} />
                  <Route path="/news" element={<Navigate to="/connect?tab=news" replace />} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

                  <Route path="/shop/:id" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
                  <Route path="/listing/:id" element={<ProtectedRoute><ListingDetail /></ProtectedRoute>} />

                  {/* Marketplace */}
                  <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
                  <Route path="/marketplace/item/:id" element={<ProtectedRoute><ListingDetail /></ProtectedRoute>} />
                  <Route path="/marketplace/loja/:id" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
                  <Route path="/marketplace/minha-loja" element={<ProtectedRoute><MyShop /></ProtectedRoute>} />
                  <Route path="/my-shop" element={<Navigate to="/marketplace/minha-loja" replace />} />

                  {/* Utilitários do campus */}
                  <Route path="/campus" element={<ProtectedRoute><Campus /></ProtectedRoute>} />
                  <Route path="/campus/ru" element={<ProtectedRoute><Ru /></ProtectedRoute>} />
                  <Route path="/campus/map" element={<ProtectedRoute><CampusMap /></ProtectedRoute>} />
                  <Route path="/campus/library" element={<ProtectedRoute><CampusLibrary /></ProtectedRoute>} />
                  <Route path="/campus/transport" element={<ProtectedRoute><CampusTransport /></ProtectedRoute>} />
                  <Route path="/campus/scholarships" element={<ProtectedRoute><CampusScholarships /></ProtectedRoute>} />

                  {/* Área acadêmica (menu lateral) */}
                  <Route path="/academico" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
                  <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
                  <Route path="/extra-courses" element={<Navigate to="/disciplines?tab=extra" replace />} />
                  <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
                  <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />

                  {/* Conta */}
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />

                  {/* Rota Protegida Administrativa */}
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin/institutions" element={<AdminRoute><AdminInstitutions /></AdminRoute>} />

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
            </TenantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
