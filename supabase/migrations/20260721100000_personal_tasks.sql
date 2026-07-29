-- =============================================================================
-- Tarefas pessoais do André — pipeline Kanban (5 colunas):
-- backlog · esta_semana · em_curso · a_espera · concluido.
-- Leitura a autenticados; escritas via service role (Route Handlers).
-- =============================================================================
create table if not exists public.personal_tasks (
  id          text primary key,
  title       text not null,
  description text,
  status      text not null default 'backlog'
              check (status in ('backlog','esta_semana','em_curso','a_espera','concluido')),
  priority    text not null default 'media'
              check (priority in ('baixa','media','alta','critica')),
  due_date    date,
  position    double precision not null default 0,   -- ordenação dentro da coluna
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists personal_tasks_board_idx on public.personal_tasks (status, position);

alter table public.personal_tasks enable row level security;
drop policy if exists personal_tasks_read on public.personal_tasks;
create policy personal_tasks_read on public.personal_tasks for select using (auth.role() = 'authenticated');

drop trigger if exists personal_tasks_touch on public.personal_tasks;
create trigger personal_tasks_touch before update on public.personal_tasks
  for each row execute function public.touch_updated_at();
