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

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // 1. Função para buscar a sessão inicial de forma segura
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error("Erro ao recuperar sessão inicial:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Escuta mudanças no estado (Login, Logout, Token renovado)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // Limpeza de segurança caso o evento seja de logout disparado por outra aba
      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Aviso se estiver tentando deslogar sem internet
      if (!navigator.onLine) {
        toast({ 
          title: "Modo Offline", 
          description: "Você foi deslogado localmente do aplicativo.", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Deslogado com sucesso", 
          description: "Até logo! Suas anotações estão seguras." 
        });
      }

      await supabase.auth.signOut();
      
    } catch (error) {
      console.error("Erro ao deslogar no servidor:", error);
    } finally {
      // GARANTIA: Limpa os estados locais imediatamente, 
      // mesmo se o Supabase falhar por falta de rede
      setSession(null);
      setUser(null);
      setLoading(false);
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
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
