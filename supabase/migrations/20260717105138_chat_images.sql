-- =============================================================================
-- Piquet — Imagens no chat da equipa: coluna image_url + bucket de Storage.
-- =============================================================================

-- Imagem opcional por mensagem (uma mensagem pode ter texto e/ou imagem).
alter table public.team_messages add column if not exists image_url text;

-- Bucket público para as imagens do chat.
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- Upload: só utilizadores autenticados; leitura: pública (bucket public).
drop policy if exists chat_images_upload on storage.objects;
create policy chat_images_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images');

drop policy if exists chat_images_read on storage.objects;
create policy chat_images_read on storage.objects
  for select using (bucket_id = 'chat-images');
