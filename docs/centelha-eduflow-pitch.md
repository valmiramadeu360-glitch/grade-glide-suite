# EduFlow Academy — Submissão ao Programa Centelha Alagoas

## Resumo executivo

O **EduFlow Academy** é um sistema operacional acadêmico brasileiro que combina, em um único aplicativo mobile-first (PWA), a organização da vida universitária, uma rede social educacional, um centro de notícias institucionais e um **assistente de inteligência artificial contextual** que aprende com a rotina do aluno para oferecer suporte personalizado. Nosso objetivo é reduzir a evasão, aumentar o rendimento acadêmico e conectar estudantes, cursos e instituições em uma única infraestrutura digital.

## Problema

Os universitários brasileiros convivem com uma rotina fragmentada: usam WhatsApp para grupos, Google Sala de Aula para materiais, planilhas para notas, Instagram para socialização e ChatGPT para estudo. Essa dispersão causa **perda de prazos, baixo engajamento com a universidade, falta de senso de comunidade e alta taxa de evasão**, sobretudo entre estudantes do interior de Alagoas e do Nordeste, que ainda enfrentam barreiras de acesso a ferramentas de produtividade acadêmica de qualidade.

## Solução

O EduFlow reúne, em um só lugar:

1. **Vida Acadêmica Inteligente** — cadastro de disciplinas, cronograma, sistema de notas, checklists de conteúdo, cursos extras, lembretes com urgência automática e “máquina do tempo semestral” para arquivar/reativar períodos inteiros.
2. **Comunidades Automáticas** — ao informar universidade, campus, curso e período, o aluno é automaticamente incluído em comunidades correspondentes (via triggers no banco), estimulando pertencimento e colaboração.
3. **Central de Notícias Institucional** — canais oficiais por universidade, campus e curso, com publicação restrita a administradores e responsáveis, permitindo comunicados verificados chegarem diretamente ao estudante.
4. **Rede Social Acadêmica (Connect)** — feed de posts com fotos, vídeos, artigos, documentos e enquetes, filtros por comunidade, marcadores acadêmicos (Dúvida, Resumo, Evento) e marketplace (livros, repúblicas, estágios).
5. **Mensagens Diretas em tempo real** — via Supabase Realtime, para reforçar redes de estudo.
6. **Assistente EduFlow AI (Gemini)** — chat, resumos, flashcards e planos de estudos personalizados que **consomem o contexto real do aluno** (universidade, curso, período, disciplinas ativas, notas e próximos prazos) para responder de forma prática e adaptada.
7. **Perfil Acadêmico-Profissional** — bio, objetivos, links externos e trajetória, preparando o aluno para o mercado.

## Diferenciais competitivos

- **IA contextual**: diferente de tutores genéricos, o EduFlow AI conhece o aluno, suas matérias e prazos, tornando-se um verdadeiro copiloto acadêmico.
- **Hierarquia nacional pronta**: 20 universidades brasileiras já modeladas com campi, cursos e períodos, permitindo escalar para qualquer instituição pública ou privada.
- **Arquitetura offline-first + PWA otimizada para iOS/Android**, funcionando mesmo em regiões com internet instável — crítico para o interior alagoano.
- **Backend em Supabase (Lovable Cloud)** com Row-Level Security por usuário, garantindo LGPD desde a origem.
- **Assistente com custo baixo** via Lovable AI Gateway (Gemini), viabilizando gratuidade para o aluno em fase inicial.

## Mercado

O Brasil conta com **mais de 8,9 milhões de estudantes de ensino superior** (INEP/2023). Em Alagoas, são cerca de **130 mil universitários** distribuídos entre UFAL, IFAL, UNCISAL, UNEAL e mais de 20 instituições privadas. O mercado brasileiro de EdTechs superou **R$ 3 bilhões em 2024** e cresce a dois dígitos ao ano, com forte demanda por soluções que unam gestão acadêmica, comunidade e IA.

## Modelo de negócio

- **Freemium** para o estudante: funcionalidades essenciais gratuitas; IA avançada, armazenamento maior e integrações premium em plano pago (R$ 14,90/mês ou R$ 119,90/ano).
- **B2B institucional**: contratos com universidades e coordenações para canais oficiais verificados, dashboards de engajamento e módulos administrativos.
- **Marketplace acadêmico** com pequena taxa sobre transações (livros, monitorias, republica).

## Impacto esperado em Alagoas

- Piloto com **UFAL e IFAL** em até 12 meses, atingindo pelo menos **10.000 estudantes** ativos no primeiro ano.
- Redução mensurável na perda de prazos e melhora do engajamento (metas: +30% de disciplinas concluídas com nota acompanhada e −20% de evasão nas turmas piloto).
- Geração de empregos qualificados em tecnologia no estado, com equipe majoritariamente alagoana.

## Tecnologia

- **Frontend**: React 18 + Vite + TypeScript + Tailwind + shadcn/ui, arquitetura PWA mobile-first.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions Deno), com RLS granular e triggers para automações (comunidades, notificações, contadores).
- **IA**: Lovable AI Gateway com modelos Gemini (chat, resumos, flashcards, planos de estudo) recebendo contexto do aluno em cada chamada.
- **Segurança**: autenticação Supabase, controle de banimentos, RLS em todas as tabelas públicas, buckets de storage isolados por usuário.

## Estágio atual

- MVP funcional em produção (`https://grade-glide-suite.lovable.app`) com todos os módulos citados operando.
- 20 universidades cadastradas, comunidades automáticas ativas, notícias, feed social, mensagens em tempo real e assistente IA integrado.
- Base de código pronta para escalar horizontalmente via Supabase.

## Uso dos recursos do Centelha

- **40%** — expansão comercial e parcerias institucionais em Alagoas (UFAL, IFAL, UNCISAL, faculdades privadas).
- **30%** — evolução da IA (personalização, análise preditiva de desempenho, tutoria por disciplina).
- **20%** — equipe técnica e produto (dev mobile nativo, designer, especialista em dados).
- **10%** — infraestrutura, LGPD, marketing digital e onboarding de escolas.

## Time

Fundadores com experiência em desenvolvimento full-stack, produto digital e vivência universitária em Alagoas, comprometidos em transformar a experiência acadêmica brasileira a partir do Nordeste.

## Visão de longo prazo

Tornar o EduFlow o **sistema operacional oficial do estudante brasileiro**: um único aplicativo onde ele estuda, se organiza, se conecta, se informa e se prepara para o mercado — com um assistente de IA que o acompanha do primeiro período à formatura.
