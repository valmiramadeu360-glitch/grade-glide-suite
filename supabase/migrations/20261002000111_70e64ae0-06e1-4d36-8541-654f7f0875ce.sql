create or replace function public.my_university_id()
returns uuid language sql stable security definer set search_path = public as $$
  select university_id from public.profiles where user_id = auth.uid() limit 1
$$;
revoke all on function public.my_university_id() from public, anon;
grant execute on function public.my_university_id() to authenticated, service_role;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  tipo text not null check (tipo in ('produto','servico','restaurante')),
  nome text not null check (char_length(trim(nome)) between 2 and 60),
  bio text check (bio is null or char_length(bio) <= 500),
  logo_url text, banner_url text,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  is_open boolean not null default true,
  forma_pagamento text[] not null default array['presencial'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, tipo)
);
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  tipo text not null check (tipo in ('produto','servico','prato')),
  titulo text not null check (char_length(trim(titulo)) between 2 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 2000),
  preco numeric(10,2) check (preco is null or preco >= 0),
  categoria text,
  condicao text check (condicao is null or condicao in ('novo','usado','seminovo')),
  prazo_entrega text,
  modalidade text check (modalidade is null or modalidade in ('presencial','remoto')),
  is_active boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null, ordem smallint not null default 0
);
create table if not exists public.shop_followers (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create table if not exists public.listing_favorites (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null,
  status text not null default 'pendente' check (status in ('pendente','revisado','removido')),
  created_at timestamptz not null default now()
);
create table if not exists public.listing_view_marks (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default current_date,
  primary key (listing_id, viewer_id, dia)
);

grant select, insert, update on public.shops to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, update, delete on public.listing_photos to authenticated;
grant select, insert, delete on public.shop_followers to authenticated;
grant select, insert, delete on public.listing_favorites to authenticated;
grant select, insert, update on public.listing_reports to authenticated;
grant all on public.shops, public.listings, public.listing_photos, public.shop_followers, public.listing_favorites, public.listing_reports, public.listing_view_marks to service_role;

create index if not exists idx_shops_university on public.shops (university_id) where is_active;
create index if not exists idx_listings_university_tipo on public.listings (university_id, tipo) where is_active;
create index if not exists idx_listings_shop on public.listings (shop_id);
create index if not exists idx_listing_photos_listing on public.listing_photos (listing_id, ordem);

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

create or replace function public.register_listing_view(_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings where id = _listing_id
                 and (university_id = public.my_university_id() or public.is_admin())) then return; end if;
  insert into public.listing_view_marks (listing_id, viewer_id) values (_listing_id, auth.uid()) on conflict do nothing;
  if found then update public.listings set view_count = view_count + 1 where id = _listing_id; end if;
end $$;
revoke all on function public.register_listing_view(uuid) from public, anon;
grant execute on function public.register_listing_view(uuid) to authenticated;

create or replace function public.shop_follower_count(_shop_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.shop_followers where shop_id = _shop_id
$$;
revoke all on function public.shop_follower_count(uuid) from public, anon;
grant execute on function public.shop_follower_count(uuid) to authenticated;

alter table public.shops enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.shop_followers enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.listing_reports enable row level security;
alter table public.listing_view_marks enable row level security;

drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated using (
  (is_active and university_id = public.my_university_id()) or owner_user_id = auth.uid() or public.is_admin());
drop policy if exists shops_insert on public.shops;
create policy shops_insert on public.shops for insert to authenticated with check (owner_user_id = auth.uid() and not public.is_user_banned(auth.uid()));
drop policy if exists shops_update on public.shops;
create policy shops_update on public.shops for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select to authenticated using (
  (is_active and university_id = public.my_university_id())
  or exists (select 1 from public.shops s where s.id = listings.shop_id and s.owner_user_id = auth.uid())
  or public.is_admin());
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated with check (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid() and s.is_active));
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated using (
  exists (select 1 from public.shops s where s.id = listings.shop_id and s.owner_user_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.shops s where s.id = listings.shop_id and s.owner_user_id = auth.uid()) or public.is_admin());
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete to authenticated using (public.is_admin());

drop policy if exists listing_photos_select on public.listing_photos;
create policy listing_photos_select on public.listing_photos for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_photos.listing_id));
drop policy if exists listing_photos_write on public.listing_photos;
create policy listing_photos_write on public.listing_photos for all to authenticated using (
  exists (select 1 from public.listings l join public.shops s on s.id = l.shop_id where l.id = listing_photos.listing_id and s.owner_user_id = auth.uid()))
  with check (
  exists (select 1 from public.listings l join public.shops s on s.id = l.shop_id where l.id = listing_photos.listing_id and s.owner_user_id = auth.uid()));

drop policy if exists shop_followers_select on public.shop_followers;
create policy shop_followers_select on public.shop_followers for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.shops s where s.id = shop_followers.shop_id and s.owner_user_id = auth.uid()));
drop policy if exists shop_followers_insert on public.shop_followers;
create policy shop_followers_insert on public.shop_followers for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.shops s where s.id = shop_id));
drop policy if exists shop_followers_delete on public.shop_followers;
create policy shop_followers_delete on public.shop_followers for delete to authenticated using (user_id = auth.uid());

drop policy if exists listing_favorites_select on public.listing_favorites;
create policy listing_favorites_select on public.listing_favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists listing_favorites_insert on public.listing_favorites;
create policy listing_favorites_insert on public.listing_favorites for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.listings l where l.id = listing_id));
drop policy if exists listing_favorites_delete on public.listing_favorites;
create policy listing_favorites_delete on public.listing_favorites for delete to authenticated using (user_id = auth.uid());

drop policy if exists listing_reports_insert on public.listing_reports;
create policy listing_reports_insert on public.listing_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists listing_reports_select on public.listing_reports;
create policy listing_reports_select on public.listing_reports for select to authenticated using (public.is_admin());
drop policy if exists listing_reports_update on public.listing_reports;
create policy listing_reports_update on public.listing_reports for update to authenticated using (public.is_admin());

drop policy if exists listing_view_marks_none on public.listing_view_marks;
create policy listing_view_marks_none on public.listing_view_marks for all to authenticated using (false) with check (false);