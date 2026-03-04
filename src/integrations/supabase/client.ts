// Configuração otimizada para o App de Gestão Acadêmica (EduFlow PWA)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Verificação de segurança para evitar "telas brancas" silenciosas
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "🔥 ERRO CRÍTICO: Chaves do Supabase não encontradas! " +
    "Verifique se o arquivo .env está configurado corretamente na raiz do projeto."
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "", 
  SUPABASE_PUBLISHABLE_KEY || "", 
  {
    auth: {
      storage: window.localStorage,
      persistSession: true, // Mantém o usuário logado ao fechar o app
      autoRefreshToken: true, // Renova o token automaticamente em background
      detectSessionInUrl: true, // Essencial para o login via Google OAuth no celular
    }
  }
);
