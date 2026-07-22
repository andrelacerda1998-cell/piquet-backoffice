-- =============================================================================
-- Piquet — Tarefas da equipa ao vivo: ativa o Realtime na tabela team_tasks.
-- Sem isto, os INSERT/UPDATE/DELETE não são difundidos (era preciso reload).
-- Idempotente.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_tasks'
  ) then
    alter publication supabase_realtime add table public.team_tasks;
  end if;
end $$;
