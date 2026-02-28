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
      staleTime: 1000 * 60 * 5, // Cache de 5 minutos: Inteligência para economia de dados
    },
  },
});

/**
 * ProtectedRoute: O guardião do app.
 * Garante que ninguém acesse os dados sem token ativo do Supabase.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/10 border-t-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <div className="absolute h-10 w-10 rounded-full bg-primary/20 blur-2xl animate-pulse" />
        </div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
          Criptografando Acesso
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
 * PublicRoute: Otimização de fluxo.
 * Se o aluno já está logado, ele não precisa ver a tela de Login novamente.
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
            {/* Rota de Entrada/Login */}
            <Route 
              path="/auth" 
              element={<PublicRoute><Auth /></PublicRoute>} 
            />

            {/* Core Acadêmico */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Grade e Gestão Detalhada */}
            <Route path="/disciplines" element={<ProtectedRoute><Disciplines /></ProtectedRoute>} />
            <Route path="/disciplines/:id" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
            
            {/* Cursos Extras e Nivelamento */}
            <Route 
              path="/extra-courses" 
              element={<ProtectedRoute><Disciplines extraOnly /></ProtectedRoute>} 
            />
            
            {/* Utilitários Profissionais */}
            <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Tratamento de Erro 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          {/* Engine de Notificações Dupla: UX de Desktop e Mobile */}
          <Toaster />
          <Sonner 
            position="bottom-center" 
            closeButton 
            richColors 
            theme="dark"
            toastOptions={{
              style: { borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', background: '#0f172a' }
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
