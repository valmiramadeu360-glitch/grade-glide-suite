
## Escopo desta rodada

Continuo a evolução ininterrupta que combinamos, mas agrupando os módulos como você pediu — menos rotas soltas, mais coerência.

### 1. Connect vira o hub social + Central de Notícias

Fundir `/news` dentro de `/connect` como uma aba, e reforçar o composer estilo LinkedIn/Instagram.

- Aba nova no topo do Connect: **Feed | Comunidades | Notícias | Salvos**
- A antiga rota `/news` passa a redirecionar para `/connect?tab=news` (mantém compatibilidade).
- Composer com botão `+` central que abre um `Popover` com as opções:
  - **Foto** (upload imagem, bucket `post-media`)
  - **Vídeo** (upload mp4/webm até 50 MB, mesmo bucket)
  - **Artigo** (título + rich-text via Tiptap — reusa `DisciplineNotes`)
  - **Documento** (PDF, bucket novo `post-documents` privado com signed URL)
  - **Enquete** (pergunta + 2-4 opções — tabela `post_polls` + `post_poll_votes`)
- Card de post ganha renderização por tipo: player nativo para vídeo, preview do PDF com botão baixar, artigo com capa + trecho + "Ler mais" abre `Sheet` lateral.
- Chip de comunidade e chip do canal de notícias no topo do card, para o usuário saber a origem.
- Feed de Notícias reusa `news_posts` mas renderizado com o mesmo card visual (unificação estética).

### 2. Cursos Extras dentro de Disciplinas

Hoje "Cursos Extras" está na memória mas não existe UI. Vou entrar em `Disciplines.tsx` e criar uma **terceira tab**: `Em curso | Arquivadas | Cursos Extras`.

- Tabela nova `extra_courses` (nome, instituição, carga horária, url do certificado, status, data conclusão).
- Card compacto com badge de status (em andamento / concluído) e link para o certificado.
- CRUD inline no mesmo padrão das disciplinas.

### 3. Configurações = central de conta, privacidade e app

Reorganizo `Settings.tsx` em seções colapsáveis (Accordion):

- **Aparência** — tema, paleta (já existe, só reorganiza).
- **Notificações** — push/email/janelas (já existe).
- **Privacidade** — quem vê perfil (público/seguidores/privado), quem pode me mandar DM, quem vê meus posts. Coluna `privacy_profile`, `privacy_dm`, `privacy_posts` em `profiles`.
- **Conta** — trocar email, redefinir senha, sessões ativas, exportar dados (JSON).
- **Zona de perigo** — deletar conta (já existe, só realoca).

Rotas soltas como acesso admin continuam em `/admin`, mas o link "Painel Admin" vira um item da seção Conta (visível só se `has_role('admin')`).

### 4. Continuação da modernização

- Skeletons nos feeds (Connect / Notícias) substituindo `Loader2`.
- Animações `animate-in fade-in slide-in-from-bottom-2` em listas.
- Empty states padronizados.
- Barra flutuante de composer no mobile no Connect (botão `+` grande no canto inferior direito).

### Migrations (uma única)

- `extra_courses` (RLS: dono lê/escreve)
- `post_polls`, `post_poll_votes` (RLS: leitura pública, voto autenticado 1x)
- `posts.media_type` (`image | video | article | document | poll`), `posts.title`, `posts.link_url` (nullable)
- `profiles.privacy_profile`, `profiles.privacy_dm`, `profiles.privacy_posts` (enum `public|followers|private`, default `public`)
- Bucket `post-documents` (privado) — criado via tool.

### Fora de escopo

- Fase 4 IA, Fase 5 monetização — próxima rodada.
- Reescrever a rota `/news` (fica só como redirect).

Confirma que sigo assim? Ao aprovar, executo tudo em sequência sem parar entre etapas.
