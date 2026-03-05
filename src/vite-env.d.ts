/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  // Adicione outras variáveis aqui se criar novas no seu .env
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
