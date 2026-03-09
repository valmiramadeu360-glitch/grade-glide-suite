import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { SemesterProvider } from "@/hooks/useSemester";
import { AppLayout } from "@/components/AppLayout";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import Connect from "./pages/Connect";
import NotFound from "./pages/NotFound";

// Configuração do motor de dados (Performance BI)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false, // Evita recargas desnecessárias ao trocar de aba
      staleTime: 1000 * 60 * 5,    // Mantém os dados frescos por 5 minutos
    },
  },
});

/**
 * Filtro de Segurança: Impede acesso de deslogados
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background transition-colors duration-500">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
          <div className="relative flex items-center justify-center">
            <div className="animate-spin h-14 w-14 border-[3px] border-primary/20 border-t-primary rounded-full shadow-inner" />
            <div className="absolute h-6 w-6 bg-primary/10 rounded-full animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary leading-none">
              EduFlow Academy
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 italic">
              Sincronizando sua jornada...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <AppLayout>{children}</AppLayout>;
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
                
                {/* Rotas Acadêmicas Protegidas */}
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
                <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
                <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
                <Route path="/extra-courses" element={<ProtectedRoute><Disciplines extraOnly /></ProtectedRoute>} />
                <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                
                {/* Fallback de Erro */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              {/* Notificações do Sistema */}
              <Toaster />
              <Sonner 
                position="top-center" // Melhor visibilidade no mobile (fica no topo)
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

