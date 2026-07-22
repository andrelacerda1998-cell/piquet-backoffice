-- =============================================================================
-- Piquet — Dev board: aceitar a nova secção 'vendor' (App Vendor).
-- (A secção 'app' passa a ser rotulada "App Cliente" no frontend; o id mantém-se
--  para não mexer nas tarefas existentes.)
-- =============================================================================
alter table public.dev_tasks drop constraint if exists dev_tasks_section_check;
alter table public.dev_tasks add constraint dev_tasks_section_check
  check (section in ('site', 'app', 'vendor'));
