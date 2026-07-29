-- =============================================================================
-- Custo mensal manual por colaborador (pedido do André 2026-07-22).
-- Quando preenchido (> 0), substitui o custo médio calculado em TODO o lado:
-- Planeamento, lista de colaboradores, dashboard de equipa e gráficos.
-- NULL = usar o cálculo automático (salário + TSU + subsídios, defaults PT).
-- =============================================================================
alter table public.employees
  add column if not exists monthly_company_cost numeric(12,2);
