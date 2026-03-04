import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";

// Importação das páginas
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Configuração do cache e requisições
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Componente de Splash Screen (Loading com visual de App Nativo)
const AppSplashScreen = () => (
  <div className="flex h-[100dvh] w-full items-center justify-center bg-slate-950">
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="h-8 w-8 bg-primary/20 rounded-full animate-pulse" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">
        Iniciando EduFlow...
      </p>
    </div>
  </div>
);

// Componente para rotas que exigem login
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <AppSplashScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  return <AppLayout>{children}</AppLayout>;
}

// Componente para rotas públicas (Login/Cadastro)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <AppSplashScreen />;
  if (user) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rota de Autenticação */}
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />

            {/* Rotas Protegidas (Dashboard e Gestão) */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
            <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
            
            {/* Cursos Extras */}
            <Route path="/extra-courses" element={<ProtectedRoute><Disciplines extraOnly /></ProtectedRoute>} />
            
            <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Página de Erro 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          {/* Sistemas de Notificação (Toasts) - Otimizados para Celular */}
          <Toaster />
          <Sonner position="top-center" closeButton richColors theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
