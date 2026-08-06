---
name: Native mobile (Capacitor)
description: Capacitor Android/iOS packaging, native bridge in src/lib/native.ts, and pending EduFlow OS phases
type: feature
---
- Empacotamento nativo via Capacitor (appId `app.lovable.d06f46ccc4934603ac9010326f248b25`, webDir `dist`), com `server.url` apontando ao preview para hot reload.
- Toda API nativa passa por `src/lib/native.ts` (import dinâmico + guarda `isNative()`), para o web/PWA nunca quebrar.
- Geolocalização do RU e câmera do cardápio usam plugins nativos quando no app; caem no browser API/input file no web.
- Guia de build e permissões: `docs/mobile-capacitor.md`.

Decisões do usuário para as próximas fases:
- Chat: apenas nota de voz (áudio) por agora; sem chamadas de vídeo (nem Daily nem Agora).
- Push: Web Push nativo com VAPID (não Firebase).
- Módulos Campus (biblioteca/transporte/editais): modelo misto — admin cadastra estrutura, alunos reportam status em tempo real.
- Feito: notas de voz no chat direto (bucket privado `chat-audio`, colunas `audio_url`/`audio_duration`) e aba Comunidades do chat linkando `/community/:id`.
- Fase pendente maior: página dedicada `/community/:id` com 9 abas (Avisos, Conversas, Dúvidas, Materiais, Resumos, Trabalhos, Calendário, Integrantes, Assistente IA).
