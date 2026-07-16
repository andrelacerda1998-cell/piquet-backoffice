-- =============================================================================
-- Piquet — Impostos e RH (employees + tax_obligations) e Marketing (campaigns).
-- Desbloqueia também /finance/summary e /finance/operational-result (opex real).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Colaboradores (custo total de emprego — todos os componentes salariais).
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id                                     text primary key,
  full_name                              text not null,
  email                                  text,
  phone                                  text,
  job_title                              text,
  department                             text,
  contract_type                          text not null default 'sem_termo',
  employment_status                      text not null default 'ativo',
  start_date                             timestamptz,
  end_date                               timestamptz,
  gross_monthly_salary                   numeric not null default 0,
  annual_salary_payments                 int not null default 14,
  meal_allowance_monthly                 numeric not null default 0,
  meal_allowance_months                  int not null default 11,
  fixed_allowances_monthly               numeric not null default 0,
  variable_compensation_monthly          numeric not null default 0,
  annual_bonus                           numeric not null default 0,
  employer_social_security_rate          numeric not null default 0.2375,
  employee_social_security_rate          numeric not null default 0.11,
  workers_compensation_insurance_monthly numeric not null default 0,
  health_insurance_monthly               numeric not null default 0,
  equipment_annual_cost                  numeric not null default 0,
  software_annual_cost                   numeric not null default 0,
  training_annual_cost                   numeric not null default 0,
  recruitment_cost                       numeric not null default 0,
  other_monthly_costs                    numeric not null default 0,
  other_annual_costs                     numeric not null default 0,
  notes                                  text,
  created_at                             timestamptz not null default now()
);
create index if not exists employees_department_idx on public.employees (department);

-- ---------------------------------------------------------------------------
-- Obrigações fiscais.
-- ---------------------------------------------------------------------------
create table if not exists public.tax_obligations (
  id                   text primary key,
  name                 text not null,
  category             text,
  description          text,
  reference_period     text,
  amount_estimated     numeric not null default 0,
  amount_confirmed     numeric,
  due_date             timestamptz,
  payment_date         timestamptz,
  status               text not null default 'estimado',
  recurrence           text not null default 'mensal'
                       check (recurrence in ('mensal','trimestral','anual','unica')),
  responsible_user_id  text,
  payment_reference    text,
  supporting_document  text,
  notes                text,
  reminder_days        int not null default 7,
  is_estimated         boolean not null default true,
  created_at           timestamptz not null default now()
);
create index if not exists tax_obligations_status_idx on public.tax_obligations (status);

-- ---------------------------------------------------------------------------
-- Campanhas de marketing.
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id             text primary key,
  platform       text not null,
  campaign_name  text not null,
  ad_set         text,
  creative       text,
  investment     numeric not null default 0,
  impressions    bigint not null default 0,
  reach          bigint not null default 0,
  frequency      numeric not null default 0,
  clicks         int not null default 0,
  ctr            numeric not null default 0,
  cpc            numeric not null default 0,
  leads          int not null default 0,
  cpl            numeric not null default 0,
  customers      int not null default 0,
  cac            numeric not null default 0,
  piquet_revenue numeric not null default 0,
  roas           numeric not null default 0,
  status         text not null default 'ativa'
                 check (status in ('ativa','pausada','concluida')),
  start_date     timestamptz,
  end_date       timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists campaigns_platform_idx on public.campaigns (platform);

-- =============================================================================
-- RLS — leitura só a autenticados; escritas via service role (Route Handlers).
-- =============================================================================
alter table public.employees       enable row level security;
alter table public.tax_obligations enable row level security;
alter table public.campaigns       enable row level security;

drop policy if exists employees_read       on public.employees;
drop policy if exists tax_obligations_read  on public.tax_obligations;
drop policy if exists campaigns_read        on public.campaigns;
create policy employees_read      on public.employees       for select using (auth.role() = 'authenticated');
create policy tax_obligations_read on public.tax_obligations for select using (auth.role() = 'authenticated');
create policy campaigns_read       on public.campaigns       for select using (auth.role() = 'authenticated');
