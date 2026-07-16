-- =============================================================================
-- Piquet — Suporte a notificações ao vivo.
-- =============================================================================

-- Saber QUEM alterou uma tarefa de dev, para não notificar o próprio autor da
-- alteração. E replica identity full → o payload de UPDATE traz a linha antiga
-- (para detetar mudanças de coluna vs. simples reordenações).
alter table public.dev_tasks add column if not exists updated_by uuid references public.staff(id) on delete set null;
alter table public.dev_tasks replica identity full;

-- Difundir também as reuniões da equipa (para notificar novas marcações).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_meetings'
  ) then
    alter publication supabase_realtime add table public.team_meetings;
  end if;
end $$;
