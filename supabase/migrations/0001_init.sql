-- =============================================================================
-- Piquet — Schema inicial (Fase 0)
-- Foco: módulo Serviços/Reservas + entidades núcleo partilhadas + staff (auth).
-- Convenção: snake_case nas colunas; os adaptadores no Next.js mapeiam para os
-- tipos camelCase do frontend. Estados usam CHECK a espelhar as unions TS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Staff (utilizadores do backoffice) — ligados à Auth do Supabase.
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'operacoes'
              check (role in ('ceo','cto')),
  department  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categorias de serviço.
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id    text primary key,
  name  text not null,
  icon  text
);

-- ---------------------------------------------------------------------------
-- Clientes (campos base; métricas derivadas ficam na vista _enriched).
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id             text primary key,
  name           text not null,
  email          text not null,
  phone          text,
  registered_at  timestamptz not null default now(),
  location       text,
  city           text,
  status         text not null default 'novo',
  source         text,
  created_at     timestamptz not null default now()
);
create index if not exists customers_city_idx on public.customers (city);

-- ---------------------------------------------------------------------------
-- Técnicos (campos base; métricas derivadas na vista _enriched).
-- ---------------------------------------------------------------------------
create table if not exists public.technicians (
  id                     text primary key,
  name                   text not null,
  email                  text,
  phone                  text,
  categories             text[] not null default '{}',
  specializations        text[] not null default '{}',
  location               text,
  city                   text,
  status                 text not null default 'registado'
                         check (status in ('registado','perfil_incompleto','em_validacao','aprovado',
                                           'disponivel','indisponivel','ativo','inativo','suspenso','rejeitado')),
  documentation_complete boolean not null default false,
  hourly_rate            numeric,
  verified               boolean not null default false,
  registered_at          timestamptz not null default now(),
  approved_at            timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists technicians_city_idx on public.technicians (city);
create index if not exists technicians_status_idx on public.technicians (status);

-- ---------------------------------------------------------------------------
-- Serviços / Reservas (ServiceRequest). piquet_revenue é coluna calculada.
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id                               text primary key,
  customer_id                      text references public.customers(id) on delete set null,
  technician_id                    text references public.technicians(id) on delete set null,
  category_id                      text references public.categories(id) on delete set null,
  service_name                     text not null,
  location                         text,
  city                             text,
  source                           text,
  status                           text not null default 'pedido_recebido'
                                   check (status in ('pedido_recebido','a_procurar_tecnico','tecnico_encontrado',
                                     'a_aguardar_orcamento','orcamento_enviado','a_aguardar_pagamento','pago',
                                     'agendado','em_execucao','concluido','cancelado_cliente','cancelado_tecnico',
                                     'sem_tecnico_disponivel','reembolsado','em_reclamacao')),
  requested_at                     timestamptz not null default now(),
  scheduled_at                     timestamptz,
  started_at                       timestamptz,
  completed_at                     timestamptz,
  total_customer_value             numeric not null default 0,
  technician_value                 numeric not null default 0,
  piquet_revenue                   numeric generated always as (greatest(total_customer_value - technician_value, 0)) stored,
  vat_value                        numeric not null default 0,
  payment_status                   text not null default 'pendente'
                                   check (payment_status in ('pendente','pago','parcial','reembolsado','falhado')),
  invoice_status                   text not null default 'nao_emitida'
                                   check (invoice_status in ('nao_emitida','emitida','com_erro','anulada')),
  rating                           numeric,
  has_complaint                    boolean not null default false,
  cancellation_reason              text,
  response_time_minutes            int,
  technician_assignment_time_min   int,
  campaign_id                      text,
  internal_notes                   text[] not null default '{}',
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);
create index if not exists services_status_idx on public.services (status);
create index if not exists services_customer_idx on public.services (customer_id);
create index if not exists services_technician_idx on public.services (technician_id);
create index if not exists services_requested_idx on public.services (requested_at);

-- ---------------------------------------------------------------------------
-- updated_at automático em services.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists services_touch on public.services;
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vistas "enriched" — repõem a forma denormalizada que o frontend espera,
-- calculando as métricas a partir dos serviços (fonte única de verdade).
-- ---------------------------------------------------------------------------
create or replace view public.customers_enriched as
select
  c.*,
  count(s.id)                                          as service_count,
  coalesce(sum(s.total_customer_value), 0)             as total_spent,
  coalesce(sum(s.piquet_revenue), 0)                   as piquet_revenue,
  max(s.completed_at)                                  as last_service_at,
  count(s.id) filter (where s.has_complaint)           as complaint_count,
  coalesce(round(avg(s.rating)::numeric, 2), 0)        as average_rating
from public.customers c
left join public.services s on s.customer_id = c.id
group by c.id;

create or replace view public.technicians_enriched as
select
  t.*,
  count(s.id) filter (where s.status = 'concluido')    as services_completed,
  coalesce(sum(s.piquet_revenue), 0)                   as piquet_revenue,
  coalesce(sum(s.technician_value), 0)                 as amount_received,
  coalesce(round(avg(s.rating)::numeric, 2), 0)        as average_rating,
  max(s.completed_at)                                  as last_activity_at
from public.technicians t
left join public.services s on s.technician_id = t.id
group by t.id;

-- =============================================================================
-- Row Level Security
-- Backoffice interno: leitura só para utilizadores autenticados (staff).
-- As escritas passam pelas Route Handlers (service role — ignora RLS).
-- =============================================================================
alter table public.staff       enable row level security;
alter table public.categories  enable row level security;
alter table public.customers   enable row level security;
alter table public.technicians enable row level security;
alter table public.services    enable row level security;

-- Cada staff vê o seu próprio registo.
drop policy if exists staff_self_read on public.staff;
create policy staff_self_read on public.staff
  for select using (auth.uid() = id);

-- Leitura das tabelas de negócio por qualquer utilizador autenticado.
drop policy if exists categories_read  on public.categories;
drop policy if exists customers_read   on public.customers;
drop policy if exists technicians_read on public.technicians;
drop policy if exists services_read    on public.services;
create policy categories_read  on public.categories  for select using (auth.role() = 'authenticated');
create policy customers_read   on public.customers   for select using (auth.role() = 'authenticated');
create policy technicians_read on public.technicians for select using (auth.role() = 'authenticated');
create policy services_read    on public.services    for select using (auth.role() = 'authenticated');
