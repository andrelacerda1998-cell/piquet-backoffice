-- Repetição das tarefas pessoais (quinzenal, mensal, trimestral…).
-- Ao concluir uma tarefa recorrente, a app gera a próxima ocorrência.
alter table public.personal_tasks
  add column if not exists recurrence text not null default 'nenhuma'
  check (recurrence in ('nenhuma','quinzenal','mensal','trimestral','semestral','anual'));
