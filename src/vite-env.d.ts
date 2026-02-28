/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de conexão do projeto Supabase */
  readonly VITE_SUPABASE_URL: string
  
  /** Chave anônima pública para acesso ao banco */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  
  // Caso adicione integrações futuras (ex: APIs de Economia ou BI),
  // registre as chaves VITE_ abaixo.
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
