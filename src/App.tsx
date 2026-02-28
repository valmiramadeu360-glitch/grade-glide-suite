import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

// Importação das páginas
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos para otimizar BI e Analytics
    },
  },
});

/**
 * Componente de Proteção de Rota Otimizado
 * Resolve o erro de tela branca garantindo que o AppLayout 
 * só monte após a confirmação do usuário.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute h-8 w-8 rounded-full bg-primary/10 blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Sincronizando EduFlow
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

/**
 * Componente de Rota Pública
 * Impede que usuários logados voltem para a tela de login acidentalmente.
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Fluxo de Autenticação */}
            <Route 
              path="/auth" 
              element={<PublicRoute><Auth /></PublicRoute>} 
            />

            {/* Core do Aplicativo (Rotas Protegidas) */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Gestão de Disciplinas e Detalhes */}
            <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
            <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
            
            {/* Cursos Extras (Matemática, Inglês, etc) */}
            <Route 
              path="/extra-courses" 
              element={<ProtectedRoute><Disciplines extraOnly /></ProtectedRoute>} 
            />
            
            {/* Utilidades e Configurações */}
            <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Fallback 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          {/* Componentes Globais de Feedback */}
          <Toaster />
          <Sonner position="bottom-center" closeButton richColors expand={false} />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
