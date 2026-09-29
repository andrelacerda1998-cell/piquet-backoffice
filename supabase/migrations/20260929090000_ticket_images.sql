-- =============================================================================
-- Piquet — Imagens nos tickets de suporte.
--
-- Um cliente a descrever uma torneira a pingar ou um quadro queimado gasta três
-- parágrafos no que uma foto resolve. As imagens viajam com o ticket e ficam
-- neste bucket; no ticket fica só o CAMINHO, não um URL.
-- =============================================================================

-- PRIVADO, ao contrário do `chat-images`. Estas são fotos de dentro de casa de
-- clientes: quem as vê tem de ser staff. O backoffice recebe URLs assinados,
-- válidos por pouco tempo, gerados no servidor quando abre o ticket.
insert into storage.buckets (id, name, public)
values ('ticket-images', 'ticket-images', false)
on conflict (id) do update set public = false;

-- O upload do cliente NÃO usa estas políticas: entra pelo /api/tickets, que
-- corre no servidor com a service role e escreve depois de validar tipo,
-- tamanho e número. Nunca há uma credencial de escrita no telemóvel de ninguém.
-- Estas existem para o staff, a partir do backoffice.
drop policy if exists ticket_images_upload on storage.objects;
create policy ticket_images_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-images');

drop policy if exists ticket_images_read on storage.objects;
create policy ticket_images_read on storage.objects
  for select to authenticated using (bucket_id = 'ticket-images');
