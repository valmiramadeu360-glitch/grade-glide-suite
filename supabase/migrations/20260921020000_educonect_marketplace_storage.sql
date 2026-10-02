-- =====================================================================
-- EduConect — Marketplace, Fase 1: storage de fotos (loja e anúncio)
-- Idempotente.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('marketplace-media', 'marketplace-media', true)
on conflict (id) do nothing;

-- Qualquer pessoa autenticada pode VER (bucket público — igual post-media).
drop policy if exists marketplace_media_read on storage.objects;
create policy marketplace_media_read on storage.objects for select
  using (bucket_id = 'marketplace-media');

-- Só o dono do arquivo pode enviar/trocar/remover. Convenção de caminho:
-- <user_id>/shops/<shop_id>/logo.jpg, <user_id>/listings/<listing_id>/1.jpg
drop policy if exists marketplace_media_write on storage.objects;
create policy marketplace_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists marketplace_media_update on storage.objects;
create policy marketplace_media_update on storage.objects for update to authenticated
  using (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists marketplace_media_delete on storage.objects;
create policy marketplace_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);
