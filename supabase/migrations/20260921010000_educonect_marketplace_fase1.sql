-- =====================================================================
-- EduConect — Marketplace, Fase 1: Lojas e Itens (fundação comum)
--
-- Cria shops/listings do zero, já isolados por universidade. Não altera
-- nenhuma tabela existente (posts, profiles etc. seguem intactos).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Helper de isolamento (auto-contido: funciona mesmo se a migração
--    geral de isolamento — ISOL-001 — ainda não tiver sido aplicada).
--    CREATE OR REPLACE é seguro mesmo que a outra migração já a tenha criado.
-- ---------------------------------------------------------------------
create or replace function public.my_university_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select university_id from public.profiles where user_id = auth.uid() limit 1
$$;
revoke all on function public.my_university_id() from public, anon;
grant execute on function public.my_university_id() to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.shops (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references auth.users(id) on delete cascade,
  university_id   uuid references public.universities(id) on delete set null,
  tipo            text not null check (tipo in ('produto', 'servico', 'restaurante')),
  nome            text not null check (char_length(trim(nome)) between 2 and 60),
  bio             text check (bio is null or char_length(bio) <= 500),
  logo_url        text,
  banner_url      text,
  is_verified     boolean not null default false,
  is_active       boolean not null default true,
  is_open         boolean not null default true, -- relevante só para 'restaurante'
  forma_pagamento text[] not null default array['presencial'], -- 'presencial' e/ou 'pelo_app'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_user_id, tipo)
);

create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  tipo          text not null check (tipo in ('produto', 'servico', 'prato')),
  titulo        text not null check (char_length(trim(titulo)) between 2 and 80),
  descricao     text check (descricao is null or char_length(descricao) <= 2000),
  preco         numeric(10,2) check (preco is null or preco >= 0),
  categoria     text,
  condicao      text check (condicao is null or condicao in ('novo', 'usado', 'seminovo')),
  prazo_entrega text,
  modalidade    text check (modalidade is null or modalidade in ('presencial', 'remoto')),
  is_active     boolean not null default true,
  view_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.listing_photos (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url        text not null,
  ordem      smallint not null default 0
);

create table if not exists public.shop_followers (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table if not exists public.listing_favorites (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.listing_reports (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  motivo     text not null,
  status     text not null default 'pendente' check (status in ('pendente', 'revisado', 'removido')),
  created_at timestamptz not null default now()
);

-- 1 visualização contabilizada por pessoa por dia (evita inflar estatística)
create table if not exists public.listing_view_marks (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id  uuid not null references auth.users(id) on delete cascade,
  dia        date not null default current_date,
  primary key (listing_id, viewer_id, dia)
);

create index if not exists idx_shops_university        on public.shops (university_id) where is_active;
create index if not exists idx_listings_university_tipo on public.listings (university_id, tipo) where is_active;
create index if not exists idx_listings_shop            on public.listings (shop_id);
create index if not exists idx_listing_photos_listing   on public.listing_photos (listing_id, ordem);


-- ---------------------------------------------------------------------
-- 2) university_id nunca vem do cliente — sempre calculado no banco
-- ---------------------------------------------------------------------
create or replace function public.tg_shops_set_university()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.university_id := (select university_id from public.profiles where user_id = new.owner_user_id);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_shops_set_university on public.shops;
create trigger trg_shops_set_university before insert or update on public.shops
  for each row execute function public.tg_shops_set_university();

create or replace function public.tg_listings_set_university()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.university_id := (select university_id from public.shops where id = new.shop_id);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_listings_set_university on public.listings;
create trigger trg_listings_set_university before insert or update on public.listings
  for each row execute function public.tg_listings_set_university();


-- ---------------------------------------------------------------------
-- 3) Contabilizar visualização (1x por pessoa por dia) — função a chamar
--    do front ao abrir a página do item.
-- ---------------------------------------------------------------------
create or replace function public.register_listing_view(_listing_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.listing_view_marks (listing_id, viewer_id)
  values (_listing_id, auth.uid())
  on conflict do nothing;

  if found then
    update public.listings set view_count = view_count + 1 where id = _listing_id;
  end if;
end $$;
revoke all on function public.register_listing_view(uuid) from public, anon;
grant execute on function public.register_listing_view(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.shop_followers enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.listing_reports enable row level security;
alter table public.listing_view_marks enable row level security;

-- shops
drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated using (
  is_active and university_id = public.my_university_id()
  or owner_user_id = auth.uid()
  or public.is_admin()
);
drop policy if exists shops_insert on public.shops;
create policy shops_insert on public.shops for insert to authenticated with check (owner_user_id = auth.uid());
drop policy if exists shops_update on public.shops;
create policy shops_update on public.shops for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin());

-- listings
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select to authenticated using (
  (is_active and university_id = public.my_university_id())
  or exists (select 1 from public.shops s where s.id = listings.shop_id and s.owner_user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated with check (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid() and s.is_active)
);
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated using (
  exists (select 1 from public.shops s where s.id = listings.shop_id and s.owner_user_id = auth.uid())
  or public.is_admin()
);

-- listing_photos (segue a visibilidade do item)
drop policy if exists listing_photos_select on public.listing_photos;
create policy listing_photos_select on public.listing_photos for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_photos.listing_id)
);
drop policy if exists listing_photos_write on public.listing_photos;
create policy listing_photos_write on public.listing_photos for all to authenticated using (
  exists (
    select 1 from public.listings l join public.shops s on s.id = l.shop_id
     where l.id = listing_photos.listing_id and s.owner_user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.listings l join public.shops s on s.id = l.shop_id
     where l.id = listing_photos.listing_id and s.owner_user_id = auth.uid()
  )
);

-- shop_followers
drop policy if exists shop_followers_select on public.shop_followers;
create policy shop_followers_select on public.shop_followers for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.shops s where s.id = shop_followers.shop_id and s.owner_user_id = auth.uid())
);
drop policy if exists shop_followers_insert on public.shop_followers;
create policy shop_followers_insert on public.shop_followers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists shop_followers_delete on public.shop_followers;
create policy shop_followers_delete on public.shop_followers for delete to authenticated using (user_id = auth.uid());

-- listing_favorites
drop policy if exists listing_favorites_select on public.listing_favorites;
create policy listing_favorites_select on public.listing_favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists listing_favorites_insert on public.listing_favorites;
create policy listing_favorites_insert on public.listing_favorites for insert to authenticated with check (user_id = auth.uid());
drop policy if exists listing_favorites_delete on public.listing_favorites;
create policy listing_favorites_delete on public.listing_favorites for delete to authenticated using (user_id = auth.uid());

-- listing_reports (qualquer um denuncia, só admin lê)
drop policy if exists listing_reports_insert on public.listing_reports;
create policy listing_reports_insert on public.listing_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists listing_reports_select on public.listing_reports;
create policy listing_reports_select on public.listing_reports for select to authenticated using (public.is_admin());
drop policy if exists listing_reports_update on public.listing_reports;
create policy listing_reports_update on public.listing_reports for update to authenticated using (public.is_admin());

-- listing_view_marks (só a função register_listing_view mexe aqui; sem select de ninguém)
drop policy if exists listing_view_marks_none on public.listing_view_marks;
create policy listing_view_marks_none on public.listing_view_marks for all to authenticated using (false) with check (false);


-- =====================================================================
-- VERIFICAÇÃO
-- =====================================================================
-- 1) select tablename from pg_tables where schemaname='public'
--     and tablename in ('shops','listings','listing_photos','shop_followers',
--                        'listing_favorites','listing_reports','listing_view_marks');
--    (esperado: as 7 linhas)
--
-- 2) Teste de isolamento (troque os UUIDs por alunos reais de universidades
--    diferentes, como no teste do isolamento geral):
--    begin;
--      set local role authenticated;
--      select set_config('request.jwt.claims', '{"sub":"UUID-ALUNO-A","role":"authenticated"}', true);
--      select count(*) from public.shops;   -- só deve contar lojas da universidade dele
--      select count(*) from public.listings;
--    rollback;
-- =====================================================================
