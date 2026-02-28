// Optimized for EduFlow Academy - Supabase Client
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Verificação rigorosa para evitar falhas silenciosas na pré-visualização
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "ERRO CRÍTICO: Chaves do Supabase ausentes no arquivo .env. " +
    "Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "", 
  SUPABASE_PUBLISHABLE_KEY || "", 
  {
    auth: {
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    // Adicionado para melhor estabilidade em redes móveis (PWA)
    global: {
      headers: { 'x-application-name': 'eduflow-academy' },
    },
  }
);
