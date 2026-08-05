# Project Memory

## Core
- EduFlow (SaaS de Gestão Acadêmica). Supabase Auth + RLS. PWA Mobile-first.
- Font: Plus Jakarta Sans. UI: `.glass-card` for backdrop-blur.
- NEVER translate technical terms, Tailwind classes, or Shadcn keywords to Portuguese.
- UX/Data: Inline editing, auto-save (800-1000ms debounce), mandatory confirmation for deletions.
- Content: Always use universal academic examples (e.g., Anatomy, Criminal Law) for mock data.

## Memories
- [Design System & Theming](mem://style/design-system) — Shadcn UI, semantic Tailwind, 20 dynamic colors, overlay rules
- [PWA & Offline Architecture](mem://project/platform-pwa) — iOS optimized PWA, offline-first sync queue, auto-save
- [Mobile Usability](mem://ux/mobile-interaction) — One-handed usage, oversized back buttons, iOS safe areas
- [Discipline Management](mem://features/discipline-management) — Rich text editor, A4 print system, inline checklist
- [Academic Lifecycle](mem://features/academic-lifecycle) — Time machine semester global filter, end-of-semester flow
- [Reminders System](mem://features/reminders-system) — Deadlines strictly named 'Data de Entrega', urgency badges
- [Bibliographic Management](mem://features/bibliographic-management) — Books CRUD with reading status and format categorization
- [Academic Profile](mem://features/academic-profile) — Bio, career goals, external links, auto-saving inputs
- [Feedback System](mem://features/feedback-system) — Categorized feedback sent to admin email, allows anonymous
- [Storage Infrastructure](mem://infrastructure/storage) — Supabase avatars bucket strict user RLS rules
- [Notifications Management](mem://features/notifications-management) — Push/Email config, time windows, frequencies
- [Materials Support](mem://features/materials-support) — Repo for external links, images, data/spreadsheets
- [Extra Courses](mem://features/extra-courses) — Extracurricular courses isolated from regular curriculum
- [Native mobile (Capacitor)](mem://project/mobile-native) — Android/iOS packaging, native bridge, pending EduFlow OS phases
