-- =============================================================================
-- Planeamento financeiro mensal — linhas de orçamento do André.
-- Cada linha é um custo recorrente OU uma entrada prevista, com periodicidade.
-- A projeção mensal (client-side) soma as linhas que "caem" em cada mês e junta
-- as faturas reais a pagar (company_invoices). Dados reais, introduzidos à mão.
-- Leitura a autenticados; escritas via service role (Route Handlers).
-- =============================================================================
create table if not exists public.budget_items (
  id          text primary key,
  name        text not null,
  kind        text not null default 'custo' check (kind in ('custo','entrada')),
  category    text not null default 'outros'
              check (category in (
                'salarios','renda','software','servicos','marketing',
                'impostos','seguros','financiamento','comissoes','outros')),
  amount      numeric(12,2) not null default 0,          -- € por ocorrência
  frequency   text not null default 'mensal'
              check (frequency in ('mensal','trimestral','semestral','anual','unica')),
  start_month text not null,                             -- 'YYYY-MM': âncora das periódicas / mês da 'unica'
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists budget_items_kind_idx on public.budget_items (kind, active);

alter table public.budget_items enable row level security;
drop policy if exists budget_items_read on public.budget_items;
create policy budget_items_read on public.budget_items for select using (auth.role() = 'authenticated');

drop trigger if exists budget_items_touch on public.budget_items;
create trigger budget_items_touch before update on public.budget_items
  for each row execute function public.touch_updated_at();
