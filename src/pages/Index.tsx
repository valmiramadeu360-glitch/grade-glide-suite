import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Componente Index
 * Serve como um roteador inteligente para a raiz da aplicação.
 */
const Index = () => {
  const { loading, user } = useAuth();

  // Se o Auth ainda estiver carregando a sessão do Supabase, 
  // mostramos um loader rápido para evitar piscada de redirecionamento.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  // Se houver usuário, vai para a Dashboard, senão vai para o Login (Auth)
  return <Navigate to={user ? "/" : "/auth"} replace />;
};

export default Index;
