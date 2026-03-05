import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Configuração otimizada para Business Intelligence e performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2, // Aumentado para lidar melhor com oscilações de rede
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // Mantém dados de BI frescos por 5 minutos
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background transition-colors duration-500">
        <div className="flex flex-col items-center gap-4">
          {/* O spinner agora segue a cor primária escolhida pelo usuário */}
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full shadow-lg shadow-primary/20" />
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
              EduFlow Academy
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground italic">
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

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Se já estiver logado, joga para o Dashboard 2026.1
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* ThemeProvider no topo garante que as cores Neon/Pastel carreguem primeiro */}
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
              <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
              <Route path="/extra-courses" element={<ProtectedRoute><Disciplines extraOnly /></ProtectedRoute>} />
              <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              {/* Rota 404 personalizada */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            
            {/* Sistema de Notificações Duplo */}
            <Toaster />
            <Sonner 
              position="top-right" 
              closeButton 
              richColors 
              expand={false}
              theme="inherit" // Segue automaticamente o modo Light/Dark do app
            />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

