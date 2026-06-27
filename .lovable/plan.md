## EduFlow OS — Roadmap Estratégico (Visão CTO)

A diretriz é enorme e cobre meses de trabalho. Tentar implementar tudo em uma única entrega quebraria o app que já está em produção. Proponho executar em **6 fases incrementais**, cada uma estável e publicável, sem perder o que já funciona (Dashboard, Disciplinas, Connect, Mensagens, Admin).

Antes de iniciar, preciso da sua aprovação sobre a ordem e o escopo. Cada fase é uma entrega completa.

---

### Fase 0 — Fundação Arquitetural (1 entrega)
Objetivo: preparar o terreno sem mudar UI.
- Auditoria do schema atual (profiles, disciplines, posts, messages, notifications) e mapa de débito técnico.
- Padronização de hooks (`useAuth`, `useSemester`) e criação de `useProfile`, `useUniversity`.
- Camada de serviços (`src/services/`) isolando todas as chamadas Supabase — prepara troca futura de provedor e testes.
- Remoção de código morto (Index.tsx duplicado, followers vs follows, RLS off em `notifications` e `saved_posts`).
- Ativar RLS faltante + GRANTs em todas as tabelas públicas.

### Fase 1 — Hierarquia Acadêmica Nacional (núcleo do produto)
Modelo hierárquico que destrava tudo depois.
- Novas tabelas: `universities`, `campuses`, `courses`, `course_periods`, `subjects` (catálogo nacional, distinto de `disciplines` que é a "matrícula" do aluno).
- `profiles` ganha FKs: `university_id`, `campus_id`, `course_id`, `current_period`.
- Seed inicial com ~20 universidades brasileiras grandes (USP, UFRJ, UFMG, UnB, UFPE, etc.) + campi.
- Onboarding atualizado: aluno escolhe Universidade → Campus → Curso → Período (com busca).
- Disciplinas do aluno passam a referenciar `subjects` (catálogo) opcionalmente.

### Fase 2 — Comunidades Automáticas + Chat reorganizado
Depende da Fase 1.
- Tabela `communities` (tipo: universidade | campus | curso | periodo | disciplina) + `community_members` (auto-join baseado no perfil).
- Trigger: ao definir universidade/curso/período, usuário entra automaticamente nas comunidades correspondentes.
- Feed do Connect filtra por comunidade ativa (abas: Minha Universidade, Meu Curso, Meu Período, Geral).
- Chat: grupos automáticos por comunidade + DMs apenas por convite/aceite (`message_requests`).
- Tabela `community_posts` separa feed global de feed por comunidade (ou flag `community_id` em `posts`).

### Fase 3 — Central de Notícias Institucional
- Tabela `channels` (universidade, reitoria, atlética, PET, empresa júnior, departamento) + `channel_posts` + `channel_subscriptions`.
- Roles novos: `channel_admin` no `user_roles`.
- Painel Admin ganha aba "Canais Institucionais" para aprovar criação.
- Feed "Notícias" no Dashboard puxa apenas canais seguidos.
- IA opcional para resumir editais/PDFs publicados (já temos `LOVABLE_API_KEY`).

### Fase 4 — Assistente Acadêmico IA (camada transversal)
- Edge function `ai-assistant` com prompt-router (resumo, flashcards, mapa mental, questões, cronograma, cálculo de média).
- Tabelas: `ai_conversations`, `ai_messages`, `flashcards`, `mind_maps`, `study_plans`.
- Botão "IA" contextual em: Disciplina (resumir material), Notícia (resumir edital), Dashboard (planejar semana).
- Provider abstrato (`src/services/ai/provider.ts`) — permite trocar Gemini → outro sem refatorar UI.

### Fase 5 — Rede Acadêmica (perfil = currículo) + Monetização base
- Perfil expandido: `competencies`, `certificates`, `projects`, `monitorias`, `publications`, `languages`, `experiences` (tabelas relacionadas).
- Página `/profile/:id` pública com privacidade configurável (público | universidade | conexões | privado).
- Estrutura de `subscriptions` + plano Premium (Stripe) — apenas schema e gating, sem ativar cobrança ainda.
- Limites IA por plano (free: N requests/dia; premium: ilimitado).

### Fase 6 — Refino UX e Escalabilidade
- Bottom Navigation mobile dedicada (Dashboard, Connect, Chat, IA, Perfil).
- Layouts tablet/desktop diferenciados.
- Lazy loading de rotas, React Query com cache agressivo, índices de DB nas queries quentes.
- Documentação técnica em `/docs` (arquitetura, schema, fluxos, decisões).
- Acessibilidade (ARIA, contraste, navegação por teclado).

---

### Detalhes técnicos importantes

- **Não quebrar o existente**: cada migration é aditiva. Colunas novas nullable, FKs opcionais até backfill.
- **RLS rigoroso** em toda tabela nova (auth.uid scoping, has_role para admin/channel_admin).
- **Backend**: Lovable Cloud (Supabase) — já temos buckets, auth, IA gateway.
- **IA**: Gemini 3 Flash por padrão (já configurado), abstraído via provider.
- **Sem rate limiting custom** nesta fase (não há primitivo padrão); fica anotado para infra futura.

---

### Decisão que preciso de você

Confirma que devo seguir nesta ordem, **começando AGORA pela Fase 0 + Fase 1** (fundação + hierarquia universidades/cursos), que é o que destrava todo o restante?

Ou prefere que eu priorize uma fase específica primeiro (ex.: pular direto para Comunidades, ou para IA)?

Cada fase entrego como um marco isolado, com migrations + código + verificação, e só avanço para a próxima após seu OK.