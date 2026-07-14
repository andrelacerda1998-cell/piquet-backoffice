-- =============================================================================
-- Piquet — Quadro de desenvolvimento: tarefas do site e da app em Kanban.
-- secção = 'site' | 'app'; estado = 'todo' | 'doing' | 'done'.
-- =============================================================================
create table if not exists public.dev_tasks (
  id              text primary key,
  section         text not null check (section in ('site','app')),
  status          text not null default 'todo' check (status in ('todo','doing','done')),
  title           text not null,
  description     text,
  priority        text not null default 'media' check (priority in ('baixa','media','alta','critica')),
  assignee        text,
  created_by      uuid references public.staff(id) on delete set null,
  created_by_name text,
  position        double precision not null default 0,   -- ordenação dentro da coluna
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists dev_tasks_board_idx on public.dev_tasks (section, status, position);

-- ---------------------------------------------------------------------------
-- RLS — leitura a autenticados; escritas via service role (Route Handlers).
-- ---------------------------------------------------------------------------
alter table public.dev_tasks enable row level security;
drop policy if exists dev_tasks_read on public.dev_tasks;
create policy dev_tasks_read on public.dev_tasks for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Realtime — difunde INSERT/UPDATE/DELETE para o quadro ao vivo (idempotente).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dev_tasks'
  ) then
    alter publication supabase_realtime add table public.dev_tasks;
  end if;
end $$;
