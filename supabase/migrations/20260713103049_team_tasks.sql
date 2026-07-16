-- =============================================================================
-- Piquet — Tarefas atribuídas a membros da equipa (team_tasks).
-- =============================================================================

create table if not exists public.team_tasks (
  id          text primary key,
  title       text not null,
  assignee    text not null,
  department  text,
  priority    text not null default 'media'
              check (priority in ('critica', 'alta', 'media', 'baixa')),
  status      text not null default 'aberta'
              check (status in ('aberta', 'em_curso', 'concluida')),
  due         date,
  created_by  uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists team_tasks_assignee_idx on public.team_tasks (assignee, status);

alter table public.team_tasks enable row level security;
drop policy if exists team_tasks_read on public.team_tasks;
create policy team_tasks_read on public.team_tasks for select using (auth.role() = 'authenticated');
