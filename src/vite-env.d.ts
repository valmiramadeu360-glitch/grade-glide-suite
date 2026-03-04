/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  // Nota: Geralmente o Supabase usa VITE_SUPABASE_ANON_KEY, 
  // mas se o seu projeto foi configurado com PUBLISHABLE_KEY, mantenha assim!
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  // Adicione outras variáveis aqui se criar novas no seu .env
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
