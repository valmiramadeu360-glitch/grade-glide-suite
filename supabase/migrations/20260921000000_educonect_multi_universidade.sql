-- =====================================================================
-- EduConect — Fase 0: isolamento por universidade (multi-tenant)
--
-- O que esta migração faz:
--   1. Cadastro inteligente: o estudante digita a universidade / campus / curso
--      e o app reaproveita o que já existe (ignora acento, maiúscula e
--      pontuação) ou cria o que falta. Ninguém cria duplicatas.
--   2. Isolamento: usuários, posts, comentários, comunidades, notícias, RU,
--      transporte, biblioteca etc. de uma universidade NUNCA aparecem para
--      outra. Feito com políticas RESTRICTIVE, que se somam às políticas que
--      você já tem (nenhuma política antiga é apagada).
--   3. Fecha duas brechas que existiam hoje:
--        - posts sem comunidade eram visíveis para TODAS as universidades;
--        - qualquer usuário podia entrar em comunidade de outra universidade.
--
-- Como rodar: Supabase > SQL Editor > cole tudo > Run. É idempotente
-- (pode rodar mais de uma vez). Se algo falhar, nada é aplicado pela metade.
-- Para desfazer só o isolamento, veja o bloco ROLLBACK no final do arquivo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Normalização de texto (sem depender de extensões)
-- ---------------------------------------------------------------------
create or replace function public.edu_norm(_t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    lower(translate(
      coalesce(_t, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;


-- ---------------------------------------------------------------------
-- 2) Colunas novas
-- ---------------------------------------------------------------------
alter table public.universities add column if not exists name_key    text;
alter table public.universities add column if not exists is_verified boolean not null default true;
alter table public.universities add column if not exists created_by  uuid references auth.users(id) on delete set null;

alter table public.campuses add column if not exists name_key   text;
alter table public.campuses add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.courses add column if not exists name_key   text;
alter table public.courses add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.posts add column if not exists university_id uuid references public.universities(id) on delete set null;

-- Backfill (antes de criar os gatilhos de proteção)
update public.universities set name_key = public.edu_norm(name) where name_key is distinct from public.edu_norm(name);
update public.campuses     set name_key = public.edu_norm(name) where name_key is distinct from public.edu_norm(name);
update public.courses      set name_key = public.edu_norm(name) where name_key is distinct from public.edu_norm(name);

update public.posts p
   set university_id = pr.university_id
  from public.profiles pr
 where pr.user_id = p.user_id
   and p.university_id is distinct from pr.university_id;

create index if not exists idx_universities_name_key   on public.universities (name_key);
create index if not exists idx_campuses_uni_key        on public.campuses (university_id, name_key);
create index if not exists idx_courses_campus_key      on public.courses (campus_id, name_key);
create index if not exists idx_posts_university_recent on public.posts (university_id, created_at desc);

create or replace function public.tg_set_name_key()
returns trigger
language plpgsql
as $$
begin
  new.name_key := public.edu_norm(new.name);
  return new;
end $$;

drop trigger if exists trg_universities_name_key on public.universities;
create trigger trg_universities_name_key before insert or update of name on public.universities
  for each row execute function public.tg_set_name_key();

drop trigger if exists trg_campuses_name_key on public.campuses;
create trigger trg_campuses_name_key before insert or update of name on public.campuses
  for each row execute function public.tg_set_name_key();

drop trigger if exists trg_courses_name_key on public.courses;
create trigger trg_courses_name_key before insert or update of name on public.courses
  for each row execute function public.tg_set_name_key();


-- ---------------------------------------------------------------------
-- 3) Funções auxiliares de isolamento
-- ---------------------------------------------------------------------
create or replace function public.my_university_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select university_id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.same_university(_a uuid, _b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select pa.university_id is not null and pa.university_id = pb.university_id
      from public.profiles pa, public.profiles pb
     where pa.user_id = _a and pb.user_id = _b
  ), false)
$$;

create or replace function public.campus_in_my_university(_campus uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.university_id = public.my_university_id()
      from public.campuses c where c.id = _campus
  ), false)
$$;

create or replace function public.course_in_my_university(_course uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select ca.university_id = public.my_university_id()
      from public.courses co join public.campuses ca on ca.id = co.campus_id
     where co.id = _course
  ), false)
$$;

create or replace function public.restaurant_in_my_university(_restaurant uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select ca.university_id = public.my_university_id()
      from public.ru_restaurants r join public.campuses ca on ca.id = r.campus_id
     where r.id = _restaurant
  ), false)
$$;

create or replace function public.route_in_my_university(_route uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select ca.university_id = public.my_university_id()
      from public.transport_routes tr join public.campuses ca on ca.id = tr.campus_id
     where tr.id = _route
  ), false)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_university_id()', 'same_university(uuid, uuid)', 'campus_in_my_university(uuid)',
    'course_in_my_university(uuid)', 'restaurant_in_my_university(uuid)', 'route_in_my_university(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 4) Posts: a universidade vem do autor (não dá para forjar)
-- ---------------------------------------------------------------------
create or replace function public.tg_posts_set_university()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.university_id := (select university_id from public.profiles where user_id = new.user_id);
  elsif new.university_id is distinct from old.university_id
        and coalesce(current_setting('educonect.allow_post_uni_change', true), 'off') <> 'on' then
    new.university_id := old.university_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_posts_set_university on public.posts;
create trigger trg_posts_set_university before insert or update on public.posts
  for each row execute function public.tg_posts_set_university();

-- Se o estudante mudar de universidade, os posts dele acompanham.
create or replace function public.tg_profile_propagate_university()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.university_id is distinct from old.university_id then
    perform set_config('educonect.allow_post_uni_change', 'on', true);
    update public.posts set university_id = new.university_id where user_id = new.user_id;
    perform set_config('educonect.allow_post_uni_change', 'off', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_propagate_university on public.profiles;
create trigger trg_profile_propagate_university after update of university_id on public.profiles
  for each row execute function public.tg_profile_propagate_university();


-- ---------------------------------------------------------------------
-- 5) Perfil: campus e curso precisam pertencer à universidade escolhida
-- ---------------------------------------------------------------------
create or replace function public.tg_profiles_validate_institution()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.campus_id is not null
     and (tg_op = 'INSERT'
          or new.campus_id is distinct from old.campus_id
          or new.university_id is distinct from old.university_id) then
    if not exists (select 1 from public.campuses c
                    where c.id = new.campus_id
                      and c.university_id is not distinct from new.university_id) then
      raise exception 'O campus escolhido não pertence à universidade selecionada';
    end if;
  end if;

  if new.course_id is not null
     and (tg_op = 'INSERT'
          or new.course_id is distinct from old.course_id
          or new.campus_id is distinct from old.campus_id
          or new.university_id is distinct from old.university_id) then
    if not exists (select 1 from public.courses co join public.campuses ca on ca.id = co.campus_id
                    where co.id = new.course_id
                      and ca.university_id is not distinct from new.university_id
                      and (new.campus_id is null or co.campus_id = new.campus_id)) then
      raise exception 'O curso escolhido não pertence à universidade/campus selecionados';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_validate_institution on public.profiles;
create trigger trg_profiles_validate_institution before insert or update on public.profiles
  for each row execute function public.tg_profiles_validate_institution();


-- ---------------------------------------------------------------------
-- 6) Cadastro inteligente: encontrar ou criar universidade / campus / curso
-- ---------------------------------------------------------------------
create or replace function public.find_or_create_university(
  _name text, _acronym text default null, _state text default null, _city text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := regexp_replace(trim(coalesce(_name, '')), '\s+', ' ', 'g');
  v_key      text;
  v_acr_in   text := upper(regexp_replace(trim(coalesce(_acronym, '')), '\s+', '', 'g'));
  v_acr      text;
  v_state    text := upper(trim(coalesce(_state, '')));
  v_id       uuid;
  v_recent   int;
begin
  if v_uid is null then raise exception 'Faça login para continuar'; end if;
  if length(v_name) < 3 then raise exception 'Informe o nome da universidade'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'Informe a UF da universidade (ex.: AL)'; end if;

  v_key := public.edu_norm(v_name);
  perform pg_advisory_xact_lock(hashtext('edu_uni:' || v_key));

  -- 1) mesmo nome (sem acento, maiúscula ou pontuação)
  select id into v_id from public.universities where name_key = v_key limit 1;
  if v_id is not null then return v_id; end if;

  -- 2) mesma sigla na mesma UF (só quando o próprio usuário informou a sigla)
  if v_acr_in <> '' then
    select id into v_id from public.universities
     where upper(acronym) = v_acr_in and state = v_state limit 1;
    if v_id is not null then return v_id; end if;
  end if;

  -- Sigla: a do usuário ou iniciais das palavras principais
  v_acr := v_acr_in;
  if v_acr = '' then
    select coalesce(nullif(string_agg(upper(left(w, 1)), ''), ''), upper(left(v_key, 6)))
      into v_acr
      from regexp_split_to_table(v_key, ' ') as w
     where length(w) > 2;
    v_acr := left(coalesce(v_acr, 'UNI'), 10);
    while exists (select 1 from public.universities where acronym = v_acr and state = v_state) loop
      v_acr := left(v_acr, 8) || (10 + floor(random() * 90))::int::text;
    end loop;
  end if;

  -- Freio contra abuso: no máximo 3 universidades novas por usuário por dia
  select count(*) into v_recent from public.universities
   where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 3 then
    raise exception 'Limite diário de cadastros de universidade atingido. Tente novamente amanhã.';
  end if;

  insert into public.universities (name, acronym, state, city, is_verified, created_by)
  values (v_name, v_acr, v_state, nullif(trim(coalesce(_city, '')), ''), false, v_uid)
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.find_or_create_campus(
  _university_id uuid, _name text, _city text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := regexp_replace(trim(coalesce(_name, '')), '\s+', ' ', 'g');
  v_key    text;
  v_my     uuid;
  v_id     uuid;
  v_recent int;
begin
  if v_uid is null then raise exception 'Faça login para continuar'; end if;
  if length(v_name) < 2 then raise exception 'Informe o nome do campus'; end if;
  if not exists (select 1 from public.universities where id = _university_id) then
    raise exception 'Universidade não encontrada';
  end if;

  v_my := public.my_university_id();
  if v_my is not null and v_my <> _university_id and not public.is_admin() then
    raise exception 'Você só pode cadastrar campus na sua própria universidade';
  end if;

  v_key := public.edu_norm(v_name);
  perform pg_advisory_xact_lock(hashtext('edu_campus:' || _university_id::text || v_key));

  select id into v_id from public.campuses
   where university_id = _university_id and name_key = v_key limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_recent from public.campuses
   where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 5 then
    raise exception 'Limite diário de cadastros de campus atingido. Tente novamente amanhã.';
  end if;

  insert into public.campuses (university_id, name, city, created_by)
  values (_university_id, v_name, nullif(trim(coalesce(_city, '')), ''), v_uid)
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.find_or_create_course(
  _campus_id uuid, _name text, _degree text default 'graduacao', _total_periods int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := regexp_replace(trim(coalesce(_name, '')), '\s+', ' ', 'g');
  v_key    text;
  v_degree text := lower(coalesce(nullif(trim(_degree), ''), 'graduacao'));
  v_uni    uuid;
  v_my     uuid;
  v_id     uuid;
  v_recent int;
begin
  if v_uid is null then raise exception 'Faça login para continuar'; end if;
  if length(v_name) < 2 then raise exception 'Informe o nome do curso'; end if;
  if v_degree not in ('tecnico', 'graduacao', 'especializacao', 'mestrado', 'doutorado') then
    raise exception 'Tipo de curso inválido';
  end if;

  select university_id into v_uni from public.campuses where id = _campus_id;
  if v_uni is null then raise exception 'Campus não encontrado'; end if;

  v_my := public.my_university_id();
  if v_my is not null and v_my <> v_uni and not public.is_admin() then
    raise exception 'Você só pode cadastrar curso na sua própria universidade';
  end if;

  v_key := public.edu_norm(v_name);
  perform pg_advisory_xact_lock(hashtext('edu_course:' || _campus_id::text || v_key || v_degree));

  select id into v_id from public.courses
   where campus_id = _campus_id and name_key = v_key and degree = v_degree limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_recent from public.courses
   where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 5 then
    raise exception 'Limite diário de cadastros de curso atingido. Tente novamente amanhã.';
  end if;

  insert into public.courses (campus_id, name, degree, total_periods, created_by)
  values (_campus_id, v_name, v_degree, greatest(1, least(coalesce(_total_periods, 8), 20)), v_uid)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.find_or_create_university(text, text, text, text) from public, anon;
revoke all on function public.find_or_create_campus(uuid, text, text)            from public, anon;
revoke all on function public.find_or_create_course(uuid, text, text, int)       from public, anon;
grant execute on function public.find_or_create_university(text, text, text, text) to authenticated, service_role;
grant execute on function public.find_or_create_campus(uuid, text, text)            to authenticated, service_role;
grant execute on function public.find_or_create_course(uuid, text, text, int)       to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 7) Limpeza: remove vínculos antigos com comunidades de OUTRA universidade
--    (a brecha de "entrar em qualquer comunidade" permitia isso).
--    O gatilho existente recria os vínculos certos ao salvar o perfil.
-- ---------------------------------------------------------------------
delete from public.community_members cm
 using public.communities c, public.profiles p
 where cm.community_id = c.id
   and p.user_id = cm.user_id
   and c.university_id is not null
   and c.university_id is distinct from p.university_id;


-- ---------------------------------------------------------------------
-- 8) Políticas RESTRICTIVE (somam-se às existentes; nunca liberam nada)
--    Ajudante temporário: só cria a política se a tabela existir e tiver RLS.
-- ---------------------------------------------------------------------
create or replace function public.edu_tenant_policy(_table text, _name text, _cmd text, _expr text)
returns void
language plpgsql as $$
declare v_oid regclass := to_regclass('public.' || quote_ident(_table));
begin
  if v_oid is null then
    raise notice 'EduConect: tabela public.% não existe — política % ignorada', _table, _name;
    return;
  end if;
  if not (select relrowsecurity from pg_class where oid = v_oid) then
    raise notice 'EduConect: RLS desligado em public.% — política % ignorada (ligue o RLS antes)', _table, _name;
    return;
  end if;

  execute format('drop policy if exists %I on public.%I', _name, _table);
  if upper(_cmd) = 'INSERT' then
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)', _name, _table, _expr);
  else
    execute format('create policy %I on public.%I as restrictive for select to authenticated using (%s)', _name, _table, _expr);
  end if;
exception
  when undefined_column or undefined_table then
    raise notice 'EduConect: estrutura diferente do esperado em public.% — política % ignorada (%)', _table, _name, sqlerrm;
end $$;

-- ===== Posts e interações =====
select public.edu_tenant_policy('posts', 'tenant_posts_select', 'select', $p$
  university_id = (select public.my_university_id())
  or user_id = auth.uid()
  or (select public.is_admin())
$p$);
select public.edu_tenant_policy('posts', 'tenant_posts_insert', 'insert', $p$
  community_id is null
  or (select public.is_admin())
  or public.is_community_member(community_id, auth.uid())
$p$);

select public.edu_tenant_policy('post_comments', 'tenant_post_comments_select', 'select',
  $p$ exists (select 1 from public.posts p where p.id = post_comments.post_id) $p$);
select public.edu_tenant_policy('post_comments', 'tenant_post_comments_insert', 'insert',
  $p$ exists (select 1 from public.posts p where p.id = post_comments.post_id) $p$);

select public.edu_tenant_policy('post_likes', 'tenant_post_likes_select', 'select',
  $p$ exists (select 1 from public.posts p where p.id = post_likes.post_id) $p$);
select public.edu_tenant_policy('post_likes', 'tenant_post_likes_insert', 'insert',
  $p$ exists (select 1 from public.posts p where p.id = post_likes.post_id) $p$);

select public.edu_tenant_policy('post_polls', 'tenant_post_polls_select', 'select',
  $p$ exists (select 1 from public.posts p where p.id = post_polls.post_id) $p$);
select public.edu_tenant_policy('post_poll_votes', 'tenant_post_poll_votes_select', 'select',
  $p$ exists (select 1 from public.post_polls pp where pp.id = post_poll_votes.poll_id) $p$);
select public.edu_tenant_policy('post_poll_votes', 'tenant_post_poll_votes_insert', 'insert',
  $p$ exists (select 1 from public.post_polls pp where pp.id = post_poll_votes.poll_id) $p$);

select public.edu_tenant_policy('post_reports', 'tenant_post_reports_insert', 'insert',
  $p$ exists (select 1 from public.posts p where p.id = post_reports.post_id) $p$);

-- ===== Pessoas =====
select public.edu_tenant_policy('profiles', 'tenant_profiles_select', 'select', $p$
  user_id = auth.uid()
  or university_id = (select public.my_university_id())
  or (select public.is_admin())
$p$);

select public.edu_tenant_policy('follows', 'tenant_follows_insert', 'insert',
  $p$ public.same_university(follower_id, following_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('followers', 'tenant_followers_insert', 'insert',
  $p$ public.same_university(follower_id, following_id) or (select public.is_admin()) $p$);

select public.edu_tenant_policy('direct_messages', 'tenant_direct_messages_insert', 'insert',
  $p$ public.same_university(sender_id, receiver_id) or (select public.is_admin()) $p$);

-- ===== Comunidades =====
select public.edu_tenant_policy('communities', 'tenant_communities_select', 'select', $p$
  university_id = (select public.my_university_id())
  or public.is_community_member(communities.id, auth.uid())
  or (select public.is_admin())
$p$);

select public.edu_tenant_policy('community_members', 'tenant_community_members_select', 'select',
  $p$ exists (select 1 from public.communities c where c.id = community_members.community_id) $p$);
select public.edu_tenant_policy('community_members', 'tenant_community_members_insert', 'insert', $p$
  (select public.is_admin())
  or exists (select 1 from public.communities c
              where c.id = community_members.community_id
                and c.university_id = (select public.my_university_id()))
$p$);

select public.edu_tenant_policy('community_messages', 'tenant_community_messages_select', 'select',
  $p$ public.is_community_member(community_messages.community_id, auth.uid()) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('community_messages', 'tenant_community_messages_insert', 'insert',
  $p$ public.is_community_member(community_messages.community_id, auth.uid()) or (select public.is_admin()) $p$);

-- ===== Notícias (canais "global" continuam visíveis para todos) =====
select public.edu_tenant_policy('news_channels', 'tenant_news_channels_select', 'select', $p$
  scope::text = 'global'
  or university_id = (select public.my_university_id())
  or public.campus_in_my_university(campus_id)
  or public.course_in_my_university(course_id)
  or created_by = auth.uid()
  or (select public.is_admin())
$p$);
select public.edu_tenant_policy('news_posts', 'tenant_news_posts_select', 'select',
  $p$ exists (select 1 from public.news_channels c where c.id = news_posts.channel_id) $p$);
select public.edu_tenant_policy('news_subscriptions', 'tenant_news_subscriptions_insert', 'insert',
  $p$ exists (select 1 from public.news_channels c where c.id = news_subscriptions.channel_id) $p$);

-- ===== Utilitários do campus =====
select public.edu_tenant_policy('ru_restaurants', 'tenant_ru_restaurants_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_status_reports', 'tenant_ru_status_reports_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_status_reports', 'tenant_ru_status_reports_insert', 'insert',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);

select public.edu_tenant_policy('ru_menus', 'tenant_ru_menus_select', 'select',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_menus', 'tenant_ru_menus_insert', 'insert',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_ratings', 'tenant_ru_ratings_select', 'select',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_ratings', 'tenant_ru_ratings_insert', 'insert',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_notices', 'tenant_ru_notices_select', 'select',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_queue_reports', 'tenant_ru_queue_reports_select', 'select',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('ru_queue_reports', 'tenant_ru_queue_reports_insert', 'insert',
  $p$ public.restaurant_in_my_university(restaurant_id) or (select public.is_admin()) $p$);

select public.edu_tenant_policy('transport_routes', 'tenant_transport_routes_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('transport_stops', 'tenant_transport_stops_select', 'select',
  $p$ public.route_in_my_university(route_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('transport_departures', 'tenant_transport_departures_select', 'select',
  $p$ public.route_in_my_university(route_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('transport_reports', 'tenant_transport_reports_select', 'select',
  $p$ public.route_in_my_university(route_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('transport_reports', 'tenant_transport_reports_insert', 'insert',
  $p$ public.route_in_my_university(route_id) or (select public.is_admin()) $p$);

select public.edu_tenant_policy('library_rooms', 'tenant_library_rooms_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('library_room_reports', 'tenant_library_room_reports_select', 'select',
  $p$ exists (select 1 from public.library_rooms r where r.id = library_room_reports.room_id) $p$);
select public.edu_tenant_policy('library_room_reports', 'tenant_library_room_reports_insert', 'insert',
  $p$ exists (select 1 from public.library_rooms r where r.id = library_room_reports.room_id) $p$);

select public.edu_tenant_policy('campus_buildings', 'tenant_campus_buildings_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);
select public.edu_tenant_policy('campus_blocks', 'tenant_campus_blocks_select', 'select',
  $p$ public.campus_in_my_university(campus_id) or (select public.is_admin()) $p$);

select public.edu_tenant_policy('scholarship_calls', 'tenant_scholarship_calls_select', 'select', $p$
  university_id = (select public.my_university_id())
  or public.campus_in_my_university(campus_id)
  or (university_id is null and campus_id is null)
  or (select public.is_admin())
$p$);

drop function public.edu_tenant_policy(text, text, text, text);


-- =====================================================================
-- VERIFICAÇÃO (rode separadamente, depois de aplicar)
-- =====================================================================
-- 1) Políticas criadas (esperado: uma lista com ~45 linhas):
--    select tablename, policyname, cmd
--      from pg_policies
--     where schemaname = 'public' and policyname like 'tenant\_%'
--     order by tablename, policyname;
--
-- 2) Tabelas essenciais SEM política de isolamento (esperado: 0 linhas):
--    select t as tabela_sem_isolamento
--      from unnest(array['posts','profiles','communities','community_members',
--                        'news_channels','ru_restaurants','transport_routes']) t
--     where not exists (select 1 from pg_policies
--                        where schemaname = 'public' and tablename = t
--                          and policyname like 'tenant\_%');
--
-- 3) Teste de isolamento com um usuário (troque pelo UUID de um aluno real):
--    begin;
--      set local role authenticated;
--      select set_config('request.jwt.claims', '{"sub":"COLE-O-UUID-AQUI","role":"authenticated"}', true);
--      select count(*) as posts_que_ele_ve from public.posts;
--      select count(*) as perfis_que_ele_ve from public.profiles;
--    rollback;
--    -- Repita com um aluno de OUTRA universidade: os números devem ser diferentes
--    -- e nenhum post/perfil de uma universidade pode aparecer na outra.
--
-- =====================================================================
-- ROLLBACK (só se precisar desligar o isolamento — não apaga dados)
-- =====================================================================
-- do $$ declare r record; begin
--   for r in select schemaname, tablename, policyname from pg_policies
--             where schemaname = 'public' and policyname like 'tenant\_%' loop
--     execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
--   end loop;
-- end $$;
