-- Remove a coluna "Esta semana" do pipeline de tarefas pessoais.
-- Estados passam a: backlog · em_curso · a_espera · concluido.
update public.personal_tasks set status = 'backlog' where status = 'esta_semana';
alter table public.personal_tasks drop constraint if exists personal_tasks_status_check;
alter table public.personal_tasks add constraint personal_tasks_status_check
  check (status in ('backlog','em_curso','a_espera','concluido'));
