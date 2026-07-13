-- =============================================================================
-- Piquet — Chat ao vivo: ativa o Supabase Realtime na tabela team_messages.
-- Sem isto, os INSERTs não são difundidos aos clientes subscritos.
-- Idempotente: só adiciona a tabela à publicação se ainda não estiver lá.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;
