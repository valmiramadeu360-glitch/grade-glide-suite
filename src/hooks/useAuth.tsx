import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // 1. Inicialização veloz e segura
    const initializeAuth = async () => {
      try {
        // Buscamos a sessão atual (o Supabase checa o LocalStorage automaticamente)
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Erros de rede não devem impedir o app de abrir em modo offline
          if (error.message.includes("fetch")) {
             console.warn("Auth: Modo offline detectado na inicialização.");
          } else {
             throw error;
          }
        }
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error("Auth: Erro fatal na inicialização:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Ouvinte de estado global (Crucial para multi-abas e renovação de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
      
      // Se o token expirar e falhar ao renovar, avisamos o usuário
      if (_event === 'USER_UPDATED' && !currentSession) {
        toast({
          title: "Sessão Expirada",
          description: "Por favor, faça login novamente para sincronizar.",
          variant: "destructive"
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Sincronização offline: avisamos o usuário se o logout for apenas local
      if (!navigator.onLine) {
        toast({ 
          title: "Logout Local", 
          description: "Você saiu do dispositivo, mas a sessão no servidor permanece até você conectar.", 
          variant: "default" 
        });
      } else {
        toast({ 
          title: "Até logo!", 
          description: "Sua sessão foi encerrada com segurança." 
        });
      }

      // Tentamos avisar o servidor
      await supabase.auth.signOut();
      
    } catch (error) {
      console.error("Auth: Erro ao comunicar saída ao servidor:", error);
    } finally {
      // GARANTIA TOTAL: Limpamos o estado local não importa o que aconteça
      setSession(null);
      setUser(null);
      setLoading(false);
      // Redirecionamento forçado para a home para limpar rotas protegidas
      window.location.href = "/auth";
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};

