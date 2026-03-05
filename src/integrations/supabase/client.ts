// This file is optimized for Academic Management App (EduFlow)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Verificação de segurança para evitar que o app quebre sem aviso
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("Atenção: As chaves do Supabase não foram encontradas no arquivo .env");
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "", 
  SUPABASE_PUBLISHABLE_KEY || "", 
  {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Importante para redirecionamento de login no mobile
    }
  }
);
