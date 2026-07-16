-- =============================================================================
-- 0006 — Métricas das lojas de apps (App Store Connect + Google Play Console).
-- Alimentada pelo cron diário `/api/cron/app-metrics` (service role).
-- Leitura: staff autenticado, via Route Handler `/api/product/growth`.
-- =============================================================================

create table if not exists public.app_metrics (
  date        date not null,
  platform    text not null check (platform in ('ios', 'android')),
  app         text not null check (app in ('cliente', 'profissional')),
  downloads   integer not null default 0,
  source      text not null default 'api',   -- 'api' | 'manual'
  fetched_at  timestamptz not null default now(),
  primary key (date, platform, app)
);

comment on table public.app_metrics is
  'Downloads diários por app/plataforma, ingeridos das APIs das lojas (upsert idempotente).';

alter table public.app_metrics enable row level security;

-- Leitura para qualquer utilizador autenticado (staff); escrita só via service role.
drop policy if exists "app_metrics_read" on public.app_metrics;
create policy "app_metrics_read" on public.app_metrics
  for select to authenticated using (true);
