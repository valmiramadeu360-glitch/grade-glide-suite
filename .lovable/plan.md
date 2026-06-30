## Ordem de execução

Vou em 3 ondas. Cada onda só começa quando a anterior compila verde.

### Onda 1 — Caça-bugs e estabilização

Varredura objetiva nos pontos que historicamente quebraram nesta base:

- **Typecheck completo** (`tsgo`) e correção de tudo que aparecer.
- **RLS check** via linter do Supabase — fechar buracos em `followers`, `notifications`, `saved_posts` (estão com RLS off no schema atual).
- **Avatar não propaga**: revisar evento `avatarUpdated` em `Profile.tsx` ↔ `AppLayout.tsx` (cache busting na URL).
- **Calendário Dashboard**: confirmar que os dots aparecem e o filtro por data realmente filtra `filteredClasses`/`filteredReminders`.
- **Connect**: bucket `post-media`, contagem de likes/comments em tempo real, filtro por comunidade não sumir ao trocar de aba.
- **Disciplinas**: restaurar período move para o `currentLabel` atual, não para texto digitado errado.
- **Messages**: marcar como lidas ao abrir a conversa (zera o badge azul).
- **Admin**: confirmar que `has_role('admin')` protege a rota (hoje só protege via UI).
- **Console/network**: rodar Playwright no `/`, `/connect`, `/disciplines`, `/profile`, capturar erros.

### Onda 2 — Modernização visual (Atual refinado)

Mantém Indigo `#4f46e5` + Plus Jakarta. Sobe o nível de polimento sem trocar a identidade.

- **Densidade**: reduzir padding dos `Card` (`p-8` → `p-6`), apertar tipografia dos headers (`text-xs` uppercase fica, mas com `tracking-[0.18em]` em vez de `0.3em` em títulos longos).
- **Micro-animações**: `framer-motion` já não está instalado — vou usar `tailwindcss-animate` (já presente) + classes `animate-in fade-in-50 slide-in-from-bottom-2 duration-500` em listas e modais. Hover states com `transition-transform hover:-translate-y-0.5` em cards clicáveis.
- **Glass refinement**: `.glass-card` ganha borda gradiente sutil (`before:` pseudo) só em surfaces principais (header, sidebar, cards de stats).
- **Sidebar**: itens ativos com barra vertical à esquerda + leve glow `shadow-primary/10`.
- **Header**: badge de notificações com animação `animate-pulse` substituída por `animate-bounce` discreto só quando count > 0.
- **Empty states**: padronizar — ícone em círculo `bg-muted/50`, título bold uppercase, descrição sentence-case, CTA opcional.
- **Loading**: skeletons em `Dashboard`, `Connect`, `Disciplines` substituindo os `Loader2`.
- **Botões**: variante `soft` ganha hover com leve scale; primary com `shadow-primary/30` em hover.

### Onda 3 — Fase 3: Central de Notícias

Migration nova:

- `news_channels` (id, scope: `university|campus|course|global`, scope_id, name, description, banner_url, created_by, member_count)
- `news_posts` (id, channel_id, author_id, title, content, cover_url, link_url, pinned, published_at)
- `news_subscriptions` (channel_id, user_id) — opt-in/opt-out por canal
- Auto-subscribe via trigger: ao entrar numa community, é inscrito no canal correspondente.
- RLS: leitura aberta para inscritos; escrita apenas para `admin` + `channel_owner` (nova role no `user_roles`).

UI:

- Rota `/news` + item no sidebar (ícone `Newspaper`).
- Header com tabs: **Para você** (canais inscritos) / **Explorar** / **Pinned**.
- Card de notícia: capa 16:9, título serifado opcional, badge do canal, data relativa.
- Detalhe modal/drawer com conteúdo rich-text (reusa `DisciplineNotes`).
- Widget no Dashboard: "Últimas notícias" mostrando 3 cards do canal mais ativo do usuário.

### Detalhes técnicos

- Não toco em `src/integrations/supabase/client.ts` nem em `types.ts`.
- Migration única na Onda 3, com `GRANT` + `RLS` + policies completas (lição da Fase 2).
- Cada onda termina com `tsgo` verde antes de seguir.
- Sem framer-motion novo — só tailwindcss-animate que já está no projeto.
- Não mexo no conteúdo institucional (cadeira, perfil, lembretes) — só refino.

### Fora de escopo desta rodada

- Fase 4 (IA), Fase 5 (network profissional/Stripe), Fase 6 (bottom nav).
- Renomeação de tabelas existentes.
- Tradução de strings técnicas.
